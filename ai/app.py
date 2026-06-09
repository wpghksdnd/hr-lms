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
    logger.warning("[보안] OPENROUTER_API_KEY가 설정되지 않았습니다. 모든 AI 요청이 실패합니다.")

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


def ask_ai(messages: list) -> str:
    """OpenRouter API를 호출한다. 모든 모델 실패 시 안내 메시지를 반환한다."""
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

    return "죄송합니다, 현재 서버가 혼잡합니다. 잠시 후 다시 시도해주세요."


# ✅ 챗봇 API 엔드포인트
# 백엔드(Spring Boot)가 이 주소로 POST 요청 보내면 됨
@app.route('/chat', methods=['POST'])
@require_internal_token
def chat():
    data = request.json
    if not data:
        return jsonify({"error": "요청 본문이 없습니다"}), 400

    user_id = str(data.get('user_id', 'default'))   # 사용자 구분용 ID
    user_message = data.get('message', '').strip()   # 사용자 질문

    if not user_message:
        return jsonify({"error": "message 필드가 비어있습니다"}), 400

    # 히스토리 조회 (system 포함) 후 사용자 메시지 추가
    messages = _get_or_create_history(user_id)
    messages.append({"role": "user", "content": user_message})

    # AI 답변 요청
    ai_reply = ask_ai(messages)

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