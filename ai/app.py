from flask import Flask, request, jsonify
import requests
from dotenv import load_dotenv
import os

load_dotenv()  # .env 파일 읽어오기

app = Flask(__name__)

API_KEY = os.getenv("OPENROUTER_API_KEY")  # .env에서 키 가져오기

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
너는 사내 교육 안내 챗봇이야.
아래 사내 교육 자료를 참고해서 질문에 답해줘.
자료에 없는 내용은 "확인이 필요합니다"라고 답해줘.
답변은 친절하고 간결하게 해줘.
{education_data}
"""

MODELS = [
    "openai/gpt-oss-20b:free",
    "openai/gpt-oss-120b:free",
    "tencent/hunyuan-a13b-instruct:free",
]

# ✅ 대화 기록 저장 (사용자별로 관리하려면 나중에 세션 추가)
conversation_history = {}

def ask_ai(messages):
    for model in MODELS:
        response = requests.post(
            url="https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json={"model": model, "messages": messages}
        )
        data = response.json()
        if 'choices' in data:
            return data['choices'][0]['message']['content']
    return "죄송합니다, 현재 서버가 혼잡합니다. 잠시 후 다시 시도해주세요."

# ✅ 챗봇 API 엔드포인트
# 백엔드(Spring Boot)가 이 주소로 POST 요청 보내면 됨
@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_id = data.get('user_id', 'default')   # 사용자 구분용 ID
    user_message = data.get('message', '')       # 사용자 질문

    # 사용자별 대화 기록 관리
    if user_id not in conversation_history:
        conversation_history[user_id] = [
            {"role": "system", "content": system_prompt}
        ]

    # 질문 추가
    conversation_history[user_id].append(
        {"role": "user", "content": user_message}
    )

    # AI 답변 요청
    ai_reply = ask_ai(conversation_history[user_id])

    # 답변 기록 저장
    conversation_history[user_id].append(
        {"role": "assistant", "content": ai_reply}
    )

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
    app.run(host='0.0.0.0', port=5000, debug=True)