"""
Tests for the paper trading module (Plan 02-03).

Tests:
  1. test_paper_trade_model_fields — PaperTrade model has all required fields
  2. test_entry_detection_long — on_signal() places Long trade when IFVG+CISD+EMA all bullish
  3. test_entry_detection_no_signal — on_signal() returns None when indicators don't align
  4. test_max_one_trade_per_day — second signal for same symbol same day is ignored
  5. test_auto_close_on_target — open Long trade closes as Win when bar high >= target
  6. test_auto_close_on_stop — open Long trade closes as Loss when bar low <= stop
  7. test_portfolio_endpoint — GET /paper/portfolio returns starting_balance, total_pnl, current_balance
  8. test_trades_endpoint_empty — GET /paper/trades returns empty list when no closed trades
"""
import bcrypt
import pytest
from datetime import datetime
from unittest.mock import MagicMock, patch
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool
from fastapi.testclient import TestClient

from backend.data.bar_store import Bar
from dataclasses import dataclass
from typing import Literal


# ---------------------------------------------------------------------------
# Minimal StrategyResult mock — avoids importing backend.strategy.engine which
# pulls in pandas_ta -> numba -> llvmlite (broken in this environment).
# Mirrors the frozen dataclass from backend/strategy/engine.py exactly.
# ---------------------------------------------------------------------------

IFVGState = Literal["Bullish", "Bearish", "None", "Expired"]
CISDState = Literal["Bullish", "Bearish"]
EMACondition = Literal["above", "below"]


@dataclass(frozen=True)
class _MockStrategyResult:
    ifvg_state: IFVGState
    cisd_state: CISDState
    ema_condition: EMACondition
    ema_value: float
    bar_index: int


# ---------------------------------------------------------------------------
# Shared test settings
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
# In-memory DB fixtures
# ---------------------------------------------------------------------------

def _make_test_engine():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    return engine


def _make_session():
    engine = _make_test_engine()
    return Session(engine)


def _get_token(client) -> str:
    response = client.post(
        "/auth/login",
        data={"username": TEST_EMAIL, "password": TEST_PASSWORD},
    )
    assert response.status_code == 200
    return response.json()["access_token"]


# ---------------------------------------------------------------------------
# Helper: build a list of test Bar objects
# ---------------------------------------------------------------------------

def _make_bars(count: int = 10, close: float = 100.0, high: float = 105.0, low: float = 95.0) -> list[Bar]:
    return [
        Bar(
            timestamp=datetime(2024, 1, 1, 9, 30 + i),
            open=close - 1,
            high=high,
            low=low,
            close=close,
            volume=1000.0,
        )
        for i in range(count)
    ]


# ---------------------------------------------------------------------------
# Test 1: PaperTrade model fields
# ---------------------------------------------------------------------------

def test_paper_trade_model_fields():
    """PaperTrade model accepts all required fields and stores them correctly."""
    from backend.paper.models import PaperTrade

    trade = PaperTrade(
        symbol="SPY",
        direction="Long",
        entry_price=450.0,
        stop_price=445.0,
        target_price=457.5,
        risk_amount=1000.0,
        quantity=200.0,
        trade_date="2024-01-15",
    )

    assert trade.symbol == "SPY"
    assert trade.direction == "Long"
    assert trade.entry_price == 450.0
    assert trade.exit_price is None
    assert trade.stop_price == 445.0
    assert trade.target_price == 457.5
    assert trade.risk_amount == 1000.0
    assert trade.quantity == 200.0
    assert trade.pnl is None
    assert trade.outcome is None
    assert trade.status == "open"
    assert trade.closed_at is None
    assert trade.trade_date == "2024-01-15"


# ---------------------------------------------------------------------------
# Test 2: Entry detection — Long
# ---------------------------------------------------------------------------

def test_entry_detection_long():
    """on_signal() places Long trade when IFVG=Bullish, CISD=Bullish, EMA=above during NY session."""
    from backend.paper.engine import PaperTradingEngine

    test_engine = _make_test_engine()

    result = _MockStrategyResult(
        ifvg_state="Bullish",
        cisd_state="Bullish",
        ema_condition="above",
        ema_value=99.0,
        bar_index=10,
    )

    bars = _make_bars(count=10, close=102.0, high=108.0, low=94.0)

    engine = PaperTradingEngine()

    with patch("backend.paper.engine.is_ny_session_active", return_value=True), \
         patch("backend.paper.engine.get_engine", return_value=test_engine):
        trade = engine.on_signal("SPY", result, bars)

    assert trade is not None
    assert trade.direction == "Long"
    assert trade.entry_price == 102.0
    # Stop = min(low) of last 8 bars = 94.0
    assert trade.stop_price == 94.0
    # Risk = 102.0 - 94.0 = 8.0; Target = 102.0 + 8.0 * 1.5 = 114.0
    assert trade.target_price == pytest.approx(114.0)
    assert trade.risk_amount == 1000.0
    # Quantity = 1000.0 / 8.0 = 125.0
    assert trade.quantity == pytest.approx(125.0)
    assert trade.symbol == "SPY"
    assert trade.status == "open"


# ---------------------------------------------------------------------------
# Test 3: Entry detection — no signal (indicators don't align)
# ---------------------------------------------------------------------------

def test_entry_detection_no_signal():
    """on_signal() returns None when ifvg_state='None' (no aligned condition)."""
    from backend.paper.engine import PaperTradingEngine

    test_engine = _make_test_engine()

    result = _MockStrategyResult(
        ifvg_state="None",
        cisd_state="Bearish",
        ema_condition="above",
        ema_value=99.0,
        bar_index=10,
    )

    bars = _make_bars()

    engine = PaperTradingEngine()

    with patch("backend.paper.engine.is_ny_session_active", return_value=True), \
         patch("backend.paper.engine.get_engine", return_value=test_engine):
        trade = engine.on_signal("SPY", result, bars)

    assert trade is None


# ---------------------------------------------------------------------------
# Test 4: Max 1 trade per day per symbol
# ---------------------------------------------------------------------------

def test_max_one_trade_per_day():
    """Second on_signal() call for same symbol on same trade_date returns None."""
    from backend.paper.engine import PaperTradingEngine

    test_engine = _make_test_engine()

    result = _MockStrategyResult(
        ifvg_state="Bullish",
        cisd_state="Bullish",
        ema_condition="above",
        ema_value=99.0,
        bar_index=10,
    )

    bars = _make_bars(count=10, close=102.0, high=108.0, low=94.0)

    engine = PaperTradingEngine()

    fixed_date = datetime(2024, 1, 15, 9, 45, tzinfo=__import__("zoneinfo").ZoneInfo("America/New_York"))

    with patch("backend.paper.engine.is_ny_session_active", return_value=True), \
         patch("backend.paper.engine.get_engine", return_value=test_engine), \
         patch("backend.paper.engine.datetime") as mock_dt:
        mock_dt.now.return_value = fixed_date
        first_trade = engine.on_signal("SPY", result, bars)

    assert first_trade is not None

    with patch("backend.paper.engine.is_ny_session_active", return_value=True), \
         patch("backend.paper.engine.get_engine", return_value=test_engine), \
         patch("backend.paper.engine.datetime") as mock_dt:
        mock_dt.now.return_value = fixed_date
        second_trade = engine.on_signal("SPY", result, bars)

    assert second_trade is None


# ---------------------------------------------------------------------------
# Test 5: Auto-close on target
# ---------------------------------------------------------------------------

def test_auto_close_on_target():
    """Open Long trade closes as Win when latest bar high >= target_price."""
    from backend.paper.engine import PaperTradingEngine
    from backend.paper.models import PaperTrade
    from backend.paper.repository import PaperTradeRepository

    test_engine = _make_test_engine()

    with Session(test_engine) as session:
        repo = PaperTradeRepository(session)
        trade = repo.create(PaperTrade(
            symbol="SPY",
            direction="Long",
            entry_price=100.0,
            stop_price=95.0,
            target_price=107.5,
            risk_amount=1000.0,
            quantity=200.0,
            trade_date="2024-01-15",
            status="open",
        ))
        trade_id = trade.id

    # Bar with high >= target (107.5)
    mock_bar_store = MagicMock()
    mock_bar_store.get.return_value = [
        Bar(timestamp=datetime(2024, 1, 15, 10, 0), open=100, high=110.0, low=98.0, close=108.0, volume=1000)
    ]

    engine = PaperTradingEngine()

    with patch("backend.paper.engine.bar_store", mock_bar_store), \
         patch("backend.paper.engine.get_engine", return_value=test_engine):
        engine.check_and_close_open_trades()

    with Session(test_engine) as session:
        repo = PaperTradeRepository(session)
        closed = session.get(PaperTrade, trade_id)
        assert closed.status == "closed"
        assert closed.outcome == "Win"
        assert closed.exit_price == 107.5
        assert closed.pnl == pytest.approx((107.5 - 100.0) * 200.0)


# ---------------------------------------------------------------------------
# Test 6: Auto-close on stop
# ---------------------------------------------------------------------------

def test_auto_close_on_stop():
    """Open Long trade closes as Loss when latest bar low <= stop_price."""
    from backend.paper.engine import PaperTradingEngine
    from backend.paper.models import PaperTrade
    from backend.paper.repository import PaperTradeRepository

    test_engine = _make_test_engine()

    with Session(test_engine) as session:
        repo = PaperTradeRepository(session)
        trade = repo.create(PaperTrade(
            symbol="SPY",
            direction="Long",
            entry_price=100.0,
            stop_price=95.0,
            target_price=107.5,
            risk_amount=1000.0,
            quantity=200.0,
            trade_date="2024-01-15",
            status="open",
        ))
        trade_id = trade.id

    # Bar with low <= stop (95.0)
    mock_bar_store = MagicMock()
    mock_bar_store.get.return_value = [
        Bar(timestamp=datetime(2024, 1, 15, 10, 0), open=100, high=101.0, low=93.0, close=94.0, volume=1000)
    ]

    engine = PaperTradingEngine()

    with patch("backend.paper.engine.bar_store", mock_bar_store), \
         patch("backend.paper.engine.get_engine", return_value=test_engine):
        engine.check_and_close_open_trades()

    with Session(test_engine) as session:
        closed = session.get(PaperTrade, trade_id)
        assert closed.status == "closed"
        assert closed.outcome == "Loss"
        assert closed.exit_price == 95.0
        assert closed.pnl == pytest.approx((95.0 - 100.0) * 200.0)


# ---------------------------------------------------------------------------
# Test 7: Portfolio endpoint
# ---------------------------------------------------------------------------

def test_portfolio_endpoint(client):
    """GET /paper/portfolio with valid auth returns starting_balance, total_pnl, current_balance."""
    token = _get_token(client)
    response = client.get("/paper/portfolio", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body["starting_balance"] == 100_000.0
    assert "total_pnl" in body
    assert "current_balance" in body
    assert body["current_balance"] == body["starting_balance"] + body["total_pnl"]


# ---------------------------------------------------------------------------
# Test 8: Trades endpoint returns empty list
# ---------------------------------------------------------------------------

def test_trades_endpoint_empty(client):
    """GET /paper/trades with valid auth returns empty list when no closed trades."""
    token = _get_token(client)
    response = client.get("/paper/trades", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json() == []
