"""
AI 챗봇 서버 스모크 테스트.
실제 OpenRouter 호출 없이 Flask 테스트 클라이언트로 엔드포인트를 검증한다.
"""
import pytest
from unittest.mock import patch
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# 환경변수를 실제 API 호출 없이 테스트할 수 있도록 미리 설정
os.environ.setdefault("OPENROUTER_API_KEY", "test-key")
os.environ.setdefault("AI_INTERNAL_TOKEN", "test-token")

import app as ai_app


@pytest.fixture
def client():
    ai_app.app.config["TESTING"] = True
    with ai_app.app.test_client() as c:
        yield c


# ── /health ──────────────────────────────────────────────────────────────────

def test_health_returns_200(client):
    res = client.get("/health")
    assert res.status_code == 200


def test_health_body(client):
    res = client.get("/health")
    data = res.get_json()
    assert "status" in data


# ── /chat 인증 ────────────────────────────────────────────────────────────────

def test_chat_missing_token_returns_401(client):
    res = client.post("/chat", json={"user_id": "U001", "message": "안녕"})
    assert res.status_code == 401


def test_chat_wrong_token_returns_401(client):
    res = client.post(
        "/chat",
        json={"user_id": "U001", "message": "안녕"},
        headers={"X-Internal-Token": "wrong-token"},
    )
    assert res.status_code == 401


# ── /chat 입력 검증 ───────────────────────────────────────────────────────────

def test_chat_empty_message_returns_400(client):
    res = client.post(
        "/chat",
        json={"user_id": "U001", "message": "   "},
        headers={"X-Internal-Token": "test-token"},
    )
    assert res.status_code == 400


def test_chat_no_body_returns_400(client):
    res = client.post(
        "/chat",
        data="not-json",
        content_type="application/json",
        headers={"X-Internal-Token": "test-token"},
    )
    assert res.status_code == 400


# ── /chat 정상 응답 (AI 호출 mock) ────────────────────────────────────────────

def test_chat_success(client):
    with patch("app.ask_ai", return_value="테스트 응답입니다."):
        res = client.post(
            "/chat",
            json={"user_id": "U001", "message": "교육 일정 알려줘"},
            headers={"X-Internal-Token": "test-token"},
        )
    assert res.status_code == 200
    data = res.get_json()
    assert data["reply"] == "테스트 응답입니다."
    assert data["user_id"] == "U001"


def test_chat_history_accumulates(client):
    """같은 user_id로 두 번 요청하면 대화 히스토리가 누적된다."""
    with patch("app.ask_ai", return_value="응답1"):
        client.post(
            "/chat",
            json={"user_id": "hist-test", "message": "첫 번째 질문"},
            headers={"X-Internal-Token": "test-token"},
        )
    with patch("app.ask_ai", return_value="응답2"):
        client.post(
            "/chat",
            json={"user_id": "hist-test", "message": "두 번째 질문"},
            headers={"X-Internal-Token": "test-token"},
        )

    history = list(ai_app.conversation_history.get("hist-test", []))
    roles = [m["role"] for m in history]
    assert "user" in roles
    assert "assistant" in roles
