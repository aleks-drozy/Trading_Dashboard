"""
Auth endpoint tests — all 8 behaviors from plan 01-01.
"""
import bcrypt
import jwt
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException

# ---------------------------------------------------------------------------
# Fixtures / helpers
# ---------------------------------------------------------------------------

TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpass"
# Low rounds=4 for test speed (still a valid bcrypt hash)
TEST_HASH = bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
TEST_SECRET = "testsecret1234567890abcdef123456"


class TestSettings:
    admin_email = TEST_EMAIL
    admin_password_hash = TEST_HASH
    secret_key = TEST_SECRET
    database_url = "sqlite://"


@pytest.fixture(autouse=True)
def override_settings(monkeypatch):
    """Override get_settings to return controlled test credentials in all modules."""
    from backend import config
    from backend.auth import service as auth_service
    from backend.auth import router as auth_router
    from backend import database as db_module

    monkeypatch.setattr(config, "get_settings", lambda: TestSettings())
    monkeypatch.setattr(auth_service, "get_settings", lambda: TestSettings())
    monkeypatch.setattr(auth_router, "get_settings", lambda: TestSettings())
    monkeypatch.setattr(db_module, "get_settings", lambda: TestSettings())
    yield


# ---------------------------------------------------------------------------
# Test 1: Valid login returns 200 + access_token
# ---------------------------------------------------------------------------

def test_login_valid_credentials(client):
    response = client.post(
        "/auth/login",
        data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    body = response.json()
    assert "access_token" in body
    assert isinstance(body["access_token"], str)
    assert len(body["access_token"]) > 0


# ---------------------------------------------------------------------------
# Test 2: Wrong password returns 401
# ---------------------------------------------------------------------------

def test_login_wrong_password(client):
    response = client.post(
        "/auth/login",
        data={"username": TEST_EMAIL, "password": "wrongpass"},
    )
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Test 3: Unknown email returns 401
# ---------------------------------------------------------------------------

def test_login_unknown_email(client):
    response = client.post(
        "/auth/login",
        data={"username": "unknown@example.com", "password": TEST_PASSWORD},
    )
    assert response.status_code == 401
    assert "Invalid credentials" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Test 4: Protected route without Authorization header returns 401
# ---------------------------------------------------------------------------

def test_protected_route_no_token(client):
    response = client.get("/watchlist")
    assert response.status_code == 401


# ---------------------------------------------------------------------------
# Test 5: Protected route with valid Bearer token — NOT 401
# ---------------------------------------------------------------------------

def test_protected_route_with_valid_token(client):
    # Get a token first
    login_resp = client.post(
        "/auth/login",
        data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]
    response = client.get("/watchlist", headers={"Authorization": f"Bearer {token}"})
    # Watchlist route not implemented yet — expect 404 (NOT 401)
    assert response.status_code != 401


# ---------------------------------------------------------------------------
# Test 6: POST /auth/logout returns 200
# ---------------------------------------------------------------------------

def test_logout_returns_200(client):
    response = client.post("/auth/logout")
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# Test 7: decode_token with expired token raises HTTPException(401)
# ---------------------------------------------------------------------------

def test_decode_expired_token_raises_401():
    from backend.auth.service import decode_token
    expired_payload = {
        "sub": TEST_EMAIL,
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
    }
    expired_token = jwt.encode(expired_payload, TEST_SECRET, algorithm="HS256")
    with pytest.raises(HTTPException) as exc_info:
        decode_token(expired_token)
    assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# Test 8: decode_token with tampered token raises HTTPException(401)
# ---------------------------------------------------------------------------

def test_decode_tampered_token_raises_401():
    from backend.auth.service import decode_token
    tampered_token = "tampered.token.value"
    with pytest.raises(HTTPException) as exc_info:
        decode_token(tampered_token)
    assert exc_info.value.status_code == 401
