from flask import Flask, request, jsonify
import requests
from dotenv import load_dotenv
import os
import logging
from collections import deque
from threading import Lock
from functools import wraps

load_dotenv()  # .env 파일 읽어오기

app = Flask(__name__)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_KEY = os.getenv("OPENROUTER_API_KEY")  # .env에서 키 가져오기
if not API_KEY:
    logger.warning("[보안] OPENROUTER_API_KEY가 설정되지 않았습니다. 규칙 기반 응답으로 동작합니다.")

# 내부 서비스 간 인증 토큰 — 환경변수 미설정 시 인증 생략 (개발 환경 편의)
AI_INTERNAL_TOKEN = os.getenv("AI_INTERNAL_TOKEN", "")
if not AI_INTERNAL_TOKEN:
    logger.warning("[보안] AI_INTERNAL_TOKEN이 설정되지 않았습니다. 운영 환경에서는 반드시 설정하세요.")


def require_internal_token(f):
    """Spring 백엔드만 호출할 수 있도록 내부 토큰 검증."""
    @wraps(f)
    def decorated(*args, **kwargs):
        if AI_INTERNAL_TOKEN:
            token = request.headers.get("X-Internal-Token", "")
            if token != AI_INTERNAL_TOKEN:
                logger.warning("AI 서버 인증 실패 — X-Internal-Token 불일치")
                return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

# 대화 기록 최대 유지 건수 (system 메시지 1개 + 사용자/AI 메시지 N개)
MAX_HISTORY_PER_USER = int(os.getenv("MAX_HISTORY_PER_USER", "20"))
# 서버 전체 최대 사용자 수 (메모리 보호)
MAX_USERS = int(os.getenv("MAX_USERS", "500"))

_history_lock = Lock()  # conversation_history 동시 접근 보호

education_data = """
[사내 교육 자료 - 법정의무교육 및 추가교육]

▶ 법정의무교육 5가지
1. 성희롱 예방 교육: 연 1회 필수 / 1시간 이상 / 전 직원
2. 산업안전보건 교육: 연 2회 필수 / 사무직 반기 6h, 그 외 12h / 전 직원
3. 장애인 인식개선 교육: 연 1회 필수 / 1시간 이상 / 전 직원
4. 개인정보보호 교육: 연 1회 필수 / 1시간 이상 / 개인정보 처리 전 직원
5. 퇴직연금 교육: 연 1회 필수 / 1시간 이상 / 퇴직연금 가입 직원

▶ 추가 교육
6. 직장 내 괴롭힘 예방 교육: 연 1회 권장 / 1시간 이상 / 전 직원
7. 화재예방 교육: 연 2회 필수 / 1시간 이상 / 전 직원

▶ 공통 수료 기준
- 100% 시청 완료
- 시험 평균 70점 이상
"""

system_prompt = f"""
너는 사내 LMS 교육 안내 챗봇이야.

【역할】
- 사내 교육 정책, 수료 기준 등 교육 관련 질문에 답변한다.
- 사용자 메시지 앞에 "[수강 현황]" 또는 "[이름님의 수강 현황]" 형태로 개인 수강 데이터가 제공될 수 있다.
  이 데이터를 활용해 "내 진도", "내 수강 현황", "나 몇 % 들었어?" 같은 질문에 정확히 답해줘.
- 수강 현황 데이터가 없거나 "[현재 수강 중인 강좌 없음]"이면 수강 중인 강좌가 없다고 안내해줘.
- 사내 교육 자료에 없는 내용은 "확인이 필요합니다"라고 답해줘.
- 답변은 친절하고 간결하게 해줘.

【사내 교육 자료】
{education_data}
"""

MODELS = [
    "openai/gpt-oss-20b:free",
    "openai/gpt-oss-120b:free",
    "tencent/hunyuan-a13b-instruct:free",
]

# ✅ 사용자별 대화 기록 — deque(maxlen)으로 자동 크기 제한, Lock으로 동시성 보호
# {user_id: deque([{"role": ..., "content": ...}, ...])}
conversation_history: dict[str, deque] = {}


def _get_or_create_history(user_id: str) -> list:
    """스레드 안전하게 사용자 히스토리를 가져온다 (없으면 초기화)."""
    with _history_lock:
        if user_id not in conversation_history:
            # 서버 메모리 보호: 사용자 수 상한 초과 시 가장 오래된 사용자 삭제
            if len(conversation_history) >= MAX_USERS:
                oldest_user = next(iter(conversation_history))
                del conversation_history[oldest_user]
                logger.warning("최대 사용자 수 초과 — 오래된 세션 삭제: %s", oldest_user)

            history = deque(maxlen=MAX_HISTORY_PER_USER)
            history.append({"role": "system", "content": system_prompt})
            conversation_history[user_id] = history

        return list(conversation_history[user_id])


def _append_history(user_id: str, role: str, content: str) -> None:
    """스레드 안전하게 메시지를 히스토리에 추가한다."""
    with _history_lock:
        if user_id in conversation_history:
            conversation_history[user_id].append({"role": role, "content": content})


def ask_ai(messages: list) -> str | None:
    """OpenRouter API를 호출한다. API 키 미설정 또는 모든 모델 실패 시 None을 반환한다."""
    if not API_KEY:
        return None

    for model in MODELS:
        try:
            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {API_KEY}"},
                json={"model": model, "messages": messages},
                timeout=15,  # 15초 타임아웃
            )
            response.raise_for_status()
            data = response.json()
            if "choices" in data and data["choices"]:
                return data["choices"][0]["message"]["content"]
            logger.warning("모델 %s 응답에 choices 없음: %s", model, data)
        except requests.exceptions.Timeout:
            logger.warning("모델 %s 타임아웃", model)
        except requests.exceptions.HTTPError as e:
            logger.warning("모델 %s HTTP 오류: %s", model, e)
        except requests.exceptions.RequestException as e:
            logger.warning("모델 %s 연결 오류: %s", model, e)
        except (KeyError, ValueError) as e:
            logger.warning("모델 %s 응답 파싱 오류: %s", model, e)

    return None


def rule_based_fallback(enriched_message: str) -> str:
    """OpenRouter API 사용 불가 시 키워드 기반 응답을 반환한다."""
    # Spring 백엔드가 "[이름님의 수강 현황]\n...\n\n사용자 질문: ..." 형태로 전송
    if "사용자 질문: " in enriched_message:
        parts = enriched_message.split("사용자 질문: ", 1)
        question = parts[1].strip()
        context = parts[0].strip()
    else:
        question = enriched_message.strip()
        context = ""

    q = question  # 편의상 단축 변수

    # ── 수강 현황 / 진도 관련 ──────────────────────────────────────
    if any(k in q for k in ["수강 중인 강좌", "수강중인 강좌", "내 강좌", "내 수업",
                             "수강 현황", "진도율", "진도", "몇 % 들었", "얼마나 들었",
                             "얼마나 봤", "수강현황", "강좌 알려"]):
        if "[현재 수강 중인 강좌 없음]" in context:
            return "현재 수강 중인 강좌가 없습니다. 교육 신청을 원하시면 관리자에게 문의해 주세요."
        if context and "님의 수강 현황" in context:
            # 수강 현황 텍스트만 추출 (앞 10줄)
            lines = [l for l in context.split("\n") if l.strip()]
            context_text = "\n".join(lines[:12])
            return f"현재 수강 현황을 안내해 드릴게요:\n\n{context_text}\n\n자세한 내용은 마이페이지에서 확인하실 수 있습니다."
        return "수강 현황을 확인하려면 마이페이지를 이용해 주세요."

    # ── 이수증 / 수료증 ────────────────────────────────────────────
    if any(k in q for k in ["이수증", "이수 증", "수료증", "발급"]):
        return (
            "이수증은 아래 두 조건을 모두 충족하면 자동으로 발급됩니다.\n\n"
            "✅ 강의 영상 100% 시청 완료\n"
            "✅ 시험 평균 70점 이상\n\n"
            "발급된 이수증은 마이페이지 → 이수증 탭에서 확인 및 다운로드할 수 있습니다."
        )

    # ── 진도율 올리는 방법 ─────────────────────────────────────────
    if any(k in q for k in ["진도율 올리", "진도 올리", "진도율을 올리", "진도를 올리",
                             "어떻게 해야", "수강 방법", "수강방법"]):
        return (
            "강의 진도율을 올리는 방법:\n\n"
            "1. 강의 영상을 끝까지 시청해 주세요 (배속 재생 가능).\n"
            "2. 모든 강의(섹션)를 순서대로 완료해야 다음 강의가 활성화됩니다.\n"
            "3. 각 강의 시청 후 퀴즈가 있다면 퀴즈도 완료해 주세요.\n"
            "4. 마지막으로 시험(최종평가)에서 70점 이상 받으면 이수 완료입니다.\n\n"
            "마이페이지 → 내 강좌에서 현재 진도를 확인할 수 있습니다."
        )

    # ── 성희롱 예방 교육 ───────────────────────────────────────────
    if any(k in q for k in ["성희롱", "직장 내 성희롱", "성희롱 예방"]):
        return (
            "직장 내 성희롱 예방 교육은 법정의무교육 중 하나입니다.\n\n"
            "📌 이수 조건\n"
            "- 연 1회 필수\n"
            "- 1시간 이상\n"
            "- 대상: 전 직원\n\n"
            "성희롱 예방 교육은 안전하고 존중받는 직장 문화를 만들기 위해 필수적이며, "
            "미이수 시 사업주에게 과태료가 부과될 수 있습니다."
        )

    # ── 산업안전보건 교육 ──────────────────────────────────────────
    if any(k in q for k in ["산업안전", "안전보건", "안전 교육"]):
        return (
            "산업안전보건 교육은 법정의무교육 중 하나입니다.\n\n"
            "📌 이수 조건\n"
            "- 연 2회 필수 (반기 1회)\n"
            "- 사무직: 반기당 6시간 이상\n"
            "- 현장직(비사무직): 반기당 12시간 이상\n"
            "- 대상: 전 직원\n\n"
            "산업재해 예방을 위한 핵심 교육으로, 미이수 시 법적 제재를 받을 수 있습니다."
        )

    # ── 장애인 인식개선 ────────────────────────────────────────────
    if any(k in q for k in ["장애인", "인식개선"]):
        return (
            "장애인 인식개선 교육은 법정의무교육 중 하나입니다.\n\n"
            "📌 이수 조건\n"
            "- 연 1회 필수\n"
            "- 1시간 이상\n"
            "- 대상: 전 직원\n\n"
            "장애인에 대한 올바른 이해와 포용적인 직장 문화를 위한 중요한 교육입니다."
        )

    # ── 개인정보보호 ───────────────────────────────────────────────
    if any(k in q for k in ["개인정보", "개인 정보"]):
        return (
            "개인정보보호 교육은 법정의무교육 중 하나입니다.\n\n"
            "📌 이수 조건\n"
            "- 연 1회 필수\n"
            "- 1시간 이상\n"
            "- 대상: 개인정보를 처리하는 모든 직원\n\n"
            "개인정보 유출은 법적 처벌 대상이므로 반드시 이수해 주세요."
        )

    # ── 퇴직연금 ──────────────────────────────────────────────────
    if any(k in q for k in ["퇴직연금", "퇴직 연금"]):
        return (
            "퇴직연금 교육은 법정의무교육 중 하나입니다.\n\n"
            "📌 이수 조건\n"
            "- 연 1회 필수\n"
            "- 1시간 이상\n"
            "- 대상: 퇴직연금 가입 직원"
        )

    # ── 직장 내 괴롭힘 ────────────────────────────────────────────
    if any(k in q for k in ["괴롭힘", "직장 내 괴롭힘"]):
        return (
            "직장 내 괴롭힘 예방 교육은 권장 교육입니다.\n\n"
            "📌 이수 조건\n"
            "- 연 1회 권장\n"
            "- 1시간 이상\n"
            "- 대상: 전 직원\n\n"
            "건강한 직장 문화를 위해 적극적인 참여를 권장합니다."
        )

    # ── 화재예방 ──────────────────────────────────────────────────
    if any(k in q for k in ["화재", "소방", "화재예방"]):
        return (
            "화재예방 교육은 필수 교육입니다.\n\n"
            "📌 이수 조건\n"
            "- 연 2회 필수\n"
            "- 1시간 이상\n"
            "- 대상: 전 직원"
        )

    # ── 수료 / 이수 기준 ───────────────────────────────────────────
    if any(k in q for k in ["수료 기준", "이수 기준", "수료기준", "이수기준",
                             "합격 기준", "통과 조건", "몇 점", "점수"]):
        return (
            "교육 수료 기준은 다음과 같습니다:\n\n"
            "✅ 강의 영상 100% 시청 완료\n"
            "✅ 시험(최종평가) 평균 70점 이상\n\n"
            "두 조건을 모두 충족해야 이수 완료로 처리됩니다."
        )

    # ── 법정의무교육 전체 ─────────────────────────────────────────
    if any(k in q for k in ["법정", "의무교육", "필수교육", "필수 교육", "교육 종류", "어떤 교육"]):
        return (
            "법정의무교육 5가지:\n\n"
            "1. 성희롱 예방 교육 (연 1회)\n"
            "2. 산업안전보건 교육 (연 2회)\n"
            "3. 장애인 인식개선 교육 (연 1회)\n"
            "4. 개인정보보호 교육 (연 1회)\n"
            "5. 퇴직연금 교육 (연 1회)\n\n"
            "추가 교육:\n"
            "6. 직장 내 괴롭힘 예방 교육 (연 1회 권장)\n"
            "7. 화재예방 교육 (연 2회)\n\n"
            "법정의무교육 미이수 시 과태료 등 법적 제재를 받을 수 있습니다."
        )

    # ── 인사말 ────────────────────────────────────────────────────
    if any(k in q for k in ["안녕", "반가워", "반갑", "고마워", "감사", "고맙"]):
        return "안녕하세요! LMS AI 학습 도우미입니다. 교육 정책, 수강 현황, 이수증 등에 대해 질문해 주세요. 😊"

    # ── 기본 fallback ─────────────────────────────────────────────
    return (
        "해당 내용은 확인이 필요합니다.\n\n"
        "교육 정책이나 수강 현황에 대해 구체적으로 질문해 주시면 더 정확하게 안내해 드릴 수 있습니다.\n"
        "예) '수강 중인 강좌 알려줘', '이수증 받는 방법', '성희롱 예방 교육 기준은?'\n\n"
        "더 자세한 사항은 관리자에게 문의하거나 마이페이지를 확인해 주세요."
    )


# ✅ 챗봇 API 엔드포인트
# 백엔드(Spring Boot)가 이 주소로 POST 요청 보내면 됨
@app.route('/chat', methods=['POST'])
@require_internal_token
def chat():
    data = request.json
    if not data:
        return jsonify({"error": "요청 본문이 없습니다"}), 400

    user_id = str(data.get('user_id', 'default'))   # 사용자 구분용 ID
    user_message = data.get('message', '').strip()   # 사용자 질문 (수강 현황 컨텍스트 포함)

    if not user_message:
        return jsonify({"error": "message 필드가 비어있습니다"}), 400

    # 히스토리 조회 (system 포함) 후 사용자 메시지 추가
    messages = _get_or_create_history(user_id)
    messages.append({"role": "user", "content": user_message})

    # AI 답변 요청 (실패 시 None 반환)
    ai_reply = ask_ai(messages)

    # OpenRouter 실패 → 규칙 기반 응답으로 폴백
    if ai_reply is None:
        logger.info("OpenRouter 미사용 — 규칙 기반 응답 반환 (user_id=%s)", user_id)
        ai_reply = rule_based_fallback(user_message)

    # 히스토리에 사용자 질문 + AI 답변 저장
    _append_history(user_id, "user", user_message)
    _append_history(user_id, "assistant", ai_reply)

    # 백엔드에 JSON으로 반환
    return jsonify({
        "user_id": user_id,
        "reply": ai_reply
    })

# ✅ 서버 상태 확인용 (브라우저에서 주소 치면 확인 가능)
@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "챗봇 서버 정상 작동 중"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
