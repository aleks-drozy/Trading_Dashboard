"""
Tests for the signals module:
  - NY session check (session.py)
  - SignalBroadcaster connect/disconnect/broadcast (broadcaster.py)
  - WebSocket endpoint auth rejection (router.py)
"""
import asyncio
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_ny_dt(weekday: int, hour: int, minute: int) -> datetime:
    """Build a timezone-aware datetime in America/New_York with the given params.

    weekday: 0=Monday, 6=Sunday
    """
    from datetime import date, timedelta
    base = date(2024, 1, 1)  # Monday (weekday=0)
    target_date = base + timedelta(days=weekday)
    return datetime(
        target_date.year,
        target_date.month,
        target_date.day,
        hour,
        minute,
        0,
        tzinfo=ZoneInfo("America/New_York"),
    )


# ---------------------------------------------------------------------------
# Session tests
# ---------------------------------------------------------------------------


def test_is_ny_session_active_weekday_in_range():
    """Patch datetime.now to Wednesday 09:45 ET -> should return True."""
    from backend.signals.session import is_ny_session_active

    wednesday_in_session = _make_ny_dt(weekday=2, hour=9, minute=45)

    with patch("backend.signals.session.datetime") as mock_dt:
        mock_dt.now.return_value = wednesday_in_session
        result = is_ny_session_active()

    assert result is True


def test_is_ny_session_active_weekend():
    """Patch datetime.now to Saturday 10:00 ET -> should return False (weekend)."""
    from backend.signals.session import is_ny_session_active

    saturday_in_hours = _make_ny_dt(weekday=5, hour=10, minute=0)

    with patch("backend.signals.session.datetime") as mock_dt:
        mock_dt.now.return_value = saturday_in_hours
        result = is_ny_session_active()

    assert result is False


def test_is_ny_session_active_outside_hours():
    """Patch datetime.now to Wednesday 11:00 ET -> should return False (after session)."""
    from backend.signals.session import is_ny_session_active

    wednesday_after_session = _make_ny_dt(weekday=2, hour=11, minute=0)

    with patch("backend.signals.session.datetime") as mock_dt:
        mock_dt.now.return_value = wednesday_after_session
        result = is_ny_session_active()

    assert result is False


def test_is_ny_session_active_exact_start():
    """Patch datetime.now to Wednesday 09:30 ET -> start is inclusive, returns True."""
    from backend.signals.session import is_ny_session_active

    at_start = _make_ny_dt(weekday=2, hour=9, minute=30)

    with patch("backend.signals.session.datetime") as mock_dt:
        mock_dt.now.return_value = at_start
        result = is_ny_session_active()

    assert result is True


def test_is_ny_session_active_exact_end():
    """Patch datetime.now to Wednesday 10:30 ET -> end is exclusive, returns False."""
    from backend.signals.session import is_ny_session_active

    at_end = _make_ny_dt(weekday=2, hour=10, minute=30)

    with patch("backend.signals.session.datetime") as mock_dt:
        mock_dt.now.return_value = at_end
        result = is_ny_session_active()

    assert result is False


# ---------------------------------------------------------------------------
# SignalBroadcaster tests (StrategyEngine lazily initialized; mock _get_engine)
# ---------------------------------------------------------------------------


def test_broadcaster_connect_disconnect():
    """Connect a mock WebSocket, verify it is in clients; disconnect, verify removed."""
    from backend.signals.broadcaster import SignalBroadcaster

    bc = SignalBroadcaster()
    mock_ws = MagicMock()

    bc.connect(mock_ws)
    assert mock_ws in bc._clients

    bc.disconnect(mock_ws)
    assert mock_ws not in bc._clients


def test_broadcaster_disconnect_nonexistent_is_safe():
    """Disconnect a WebSocket that was never connected should not raise."""
    from backend.signals.broadcaster import SignalBroadcaster

    bc = SignalBroadcaster()
    mock_ws = MagicMock()

    # Should not raise
    bc.disconnect(mock_ws)
    assert mock_ws not in bc._clients


@pytest.mark.asyncio
async def test_broadcaster_compute_and_broadcast_empty_watchlist():
    """With empty watchlist, broadcast is called with empty signals list and ny_session_active field."""
    with patch("backend.signals.broadcaster.bar_store"), patch(
        "backend.signals.broadcaster.get_engine"
    ), patch("backend.signals.broadcaster.WatchlistRepository") as mock_repo_cls, patch(
        "backend.signals.broadcaster.Session"
    ):
        from backend.signals.broadcaster import SignalBroadcaster

        # Watchlist returns empty
        mock_repo_instance = MagicMock()
        mock_repo_instance.get_all.return_value = []
        mock_repo_cls.return_value = mock_repo_instance

        bc = SignalBroadcaster()
        bc.broadcast = AsyncMock()

        await bc.compute_and_broadcast()

        bc.broadcast.assert_called_once()
        payload = bc.broadcast.call_args[0][0]
        assert payload["type"] == "signal_update"
        assert "ny_session_active" in payload
        assert payload["signals"] == []


# ---------------------------------------------------------------------------
# WebSocket endpoint tests
# ---------------------------------------------------------------------------


def test_ws_endpoint_rejects_invalid_token():
    """Connecting with an invalid token should result in WebSocket close (4001)."""
    from fastapi import FastAPI
    from backend.signals.router import router as signals_router

    test_app = FastAPI()
    test_app.include_router(signals_router, tags=["signals"])

    with TestClient(test_app) as client:
        with pytest.raises(Exception):
            # decode_token raises HTTPException on invalid token;
            # the endpoint closes with code 4001 before accepting the connection
            with client.websocket_connect("/ws/signals?token=invalid_token") as ws:
                pass
