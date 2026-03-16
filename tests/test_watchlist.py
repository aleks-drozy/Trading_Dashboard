"""
Watchlist tests — 13 behaviors from plan 01-02.
Repository tests (1-6) + API tests (7-13).
"""
import bcrypt
import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

# ---------------------------------------------------------------------------
# Shared test credentials (same as auth tests)
# ---------------------------------------------------------------------------

TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "testpass"
TEST_HASH = bcrypt.hashpw(TEST_PASSWORD.encode(), bcrypt.gensalt(rounds=4)).decode()
TEST_SECRET = "testsecret1234567890abcdef123456"


class TestSettings:
    admin_email = TEST_EMAIL
    admin_password_hash = TEST_HASH
    secret_key = TEST_SECRET
    database_url = "sqlite://"


@pytest.fixture(autouse=True)
def override_settings(monkeypatch):
    """Override get_settings for all modules that use it."""
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
# Repository tests (Tests 1–6)
# ---------------------------------------------------------------------------

class TestWatchlistRepository:
    """Test WatchlistRepository directly against in-memory SQLite."""

    def _make_session(self):
        engine = create_engine(
            "sqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        SQLModel.metadata.create_all(engine)
        return Session(engine)

    def test_get_all_empty_returns_empty_list(self):
        """Test 1: get_all() on empty DB returns []."""
        from backend.watchlist.repository import WatchlistRepository
        session = self._make_session()
        repo = WatchlistRepository(session)
        result = repo.get_all()
        assert result == []

    def test_add_returns_watchlist_symbol(self):
        """Test 2: add("SPY", "stock") returns WatchlistSymbol with symbol="SPY"."""
        from backend.watchlist.repository import WatchlistRepository
        session = self._make_session()
        repo = WatchlistRepository(session)
        item = repo.add("SPY", "stock")
        assert item.symbol == "SPY"
        assert item.asset_type == "stock"

    def test_get_all_after_two_adds_returns_length_2(self):
        """Test 3: get_all() after two adds returns list of length 2."""
        from backend.watchlist.repository import WatchlistRepository
        session = self._make_session()
        repo = WatchlistRepository(session)
        repo.add("SPY", "stock")
        repo.add("AAPL", "stock")
        result = repo.get_all()
        assert len(result) == 2

    def test_remove_existing_symbol_returns_true(self):
        """Test 4: remove("SPY") returns True when symbol exists."""
        from backend.watchlist.repository import WatchlistRepository
        session = self._make_session()
        repo = WatchlistRepository(session)
        repo.add("SPY", "stock")
        result = repo.remove("SPY")
        assert result is True

    def test_remove_nonexistent_symbol_returns_false(self):
        """Test 5: remove("AAPL") returns False when symbol not in DB."""
        from backend.watchlist.repository import WatchlistRepository
        session = self._make_session()
        repo = WatchlistRepository(session)
        result = repo.remove("AAPL")
        assert result is False

    def test_add_duplicate_raises_integrity_error(self):
        """Test 6: add("SPY") twice raises IntegrityError (unique constraint)."""
        from sqlalchemy.exc import IntegrityError
        from backend.watchlist.repository import WatchlistRepository
        session = self._make_session()
        repo = WatchlistRepository(session)
        repo.add("SPY", "stock")
        with pytest.raises(IntegrityError):
            repo.add("SPY", "stock")


# ---------------------------------------------------------------------------
# Helpers to get auth token
# ---------------------------------------------------------------------------

def _get_token(client) -> str:
    response = client.post(
        "/auth/login",
        data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


# ---------------------------------------------------------------------------
# API tests (Tests 7–13)
# ---------------------------------------------------------------------------

def test_get_watchlist_without_auth_returns_401(client):
    """Test 7: GET /watchlist without auth → 401."""
    response = client.get("/watchlist")
    assert response.status_code == 401


def test_get_watchlist_with_valid_jwt_returns_200(client):
    """Test 8: GET /watchlist with valid JWT → 200, returns list."""
    token = _get_token(client)
    response = client.get("/watchlist", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_post_watchlist_adds_symbol_returns_201(client):
    """Test 9: POST /watchlist {"symbol": "AAPL", "asset_type": "stock"} → 201."""
    token = _get_token(client)
    response = client.post(
        "/watchlist",
        json={"symbol": "AAPL", "asset_type": "stock"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["symbol"] == "AAPL"


def test_post_watchlist_duplicate_returns_409(client):
    """Test 10: POST duplicate symbol → 409."""
    token = _get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/watchlist", json={"symbol": "AAPL", "asset_type": "stock"}, headers=headers)
    response = client.post(
        "/watchlist",
        json={"symbol": "AAPL", "asset_type": "stock"},
        headers=headers,
    )
    assert response.status_code == 409


def test_delete_watchlist_existing_symbol_returns_200(client):
    """Test 11: DELETE /watchlist/AAPL (exists) → 200."""
    token = _get_token(client)
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/watchlist", json={"symbol": "AAPL", "asset_type": "stock"}, headers=headers)
    response = client.delete("/watchlist/AAPL", headers=headers)
    assert response.status_code == 200


def test_delete_watchlist_nonexistent_symbol_returns_404(client):
    """Test 12: DELETE /watchlist/NONEXISTENT → 404."""
    token = _get_token(client)
    response = client.delete(
        "/watchlist/NONEXISTENT",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 404


def test_get_watchlist_after_seeding_contains_spy_and_btcusdt(client):
    """Test 13: GET /watchlist after seeding → SPY and BTCUSDT present."""
    from backend.watchlist.repository import WatchlistRepository
    from backend.database import get_session

    # Seed directly into the test session (same session used by the client)
    session = next(client.app.dependency_overrides[get_session]())
    repo = WatchlistRepository(session)
    if not repo.get_all():
        repo.add("SPY", "stock")
        repo.add("BTCUSDT", "crypto")

    token = _get_token(client)
    response = client.get("/watchlist", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    symbols = [item["symbol"] for item in response.json()]
    assert "SPY" in symbols
    assert "BTCUSDT" in symbols
