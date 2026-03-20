"""
SignalBroadcaster — computes strategy signals for all watchlist symbols on a
60-second loop and pushes them to connected WebSocket clients.

Broadcast payload schema:
{
    "type": "signal_update",
    "ny_session_active": bool,
    "signals": [
        {
            "symbol": str,
            "ifvg_state": IFVGState,
            "cisd_state": CISDState,
            "ema_condition": EMACondition,
            "ema_value": float,
            "updated_at": str  (ISO-8601 with timezone)
        },
        ...
    ]
}
"""

import asyncio
import logging
from datetime import datetime
from zoneinfo import ZoneInfo

import pandas as pd
from fastapi import WebSocket
from sqlmodel import Session

from backend.database import get_engine
from backend.data.bar_store import bar_store
from backend.strategy.engine import StrategyEngine
from backend.watchlist.repository import WatchlistRepository
from backend.signals.session import is_ny_session_active

logger = logging.getLogger(__name__)

_NY_TZ = ZoneInfo("America/New_York")
_MIN_BARS = 22  # 20 for EMA warmup + 2 for IFVG (need at least one open bar to drop)


class SignalBroadcaster:
    """Manages WebSocket clients and pushes signal state on each compute cycle."""

    def __init__(self) -> None:
        self._clients: list[WebSocket] = []
        self._engine = StrategyEngine()

    def connect(self, ws: WebSocket) -> None:
        """Register a new WebSocket client."""
        self._clients.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        """Remove a WebSocket client (no-op if not present)."""
        try:
            self._clients.remove(ws)
        except ValueError:
            pass

    async def broadcast(self, message: dict) -> None:
        """Send a JSON message to all connected clients. Silently remove dead clients."""
        disconnected: list[WebSocket] = []
        for ws in list(self._clients):
            try:
                await ws.send_json(message)
            except Exception:
                logger.warning("Failed to send to WebSocket client — removing from pool")
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect(ws)

    async def compute_and_broadcast(self) -> None:
        """Compute StrategyResult for each watchlist symbol and broadcast results."""
        with Session(get_engine()) as session:
            repo = WatchlistRepository(session)
            symbols = [ws_item.symbol for ws_item in repo.get_all()]

        signals: list[dict] = []

        for symbol in symbols:
            bars = bar_store.get(symbol)
            if len(bars) < _MIN_BARS:
                logger.debug("Skipping %s: only %d bars (need %d)", symbol, len(bars), _MIN_BARS)
                continue

            df = pd.DataFrame(
                {
                    "open": [b.open for b in bars],
                    "high": [b.high for b in bars],
                    "low": [b.low for b in bars],
                    "close": [b.close for b in bars],
                    "volume": [b.volume for b in bars],
                },
                index=[b.timestamp for b in bars],
            )

            try:
                result = self._engine.run(df)
            except Exception:
                logger.exception("StrategyEngine.run() failed for %s", symbol)
                continue

            signals.append(
                {
                    "symbol": symbol,
                    "ifvg_state": result.ifvg_state,
                    "cisd_state": result.cisd_state,
                    "ema_condition": result.ema_condition,
                    "ema_value": result.ema_value,
                    "updated_at": datetime.now(ZoneInfo("America/New_York")).isoformat(),
                }
            )

        payload = {
            "type": "signal_update",
            "ny_session_active": is_ny_session_active(),
            "signals": signals,
        }
        await self.broadcast(payload)

    async def run(self, interval_s: float = 60.0) -> None:
        """Run the broadcast loop indefinitely at ~interval_s cadence."""
        try:
            while True:
                try:
                    await self.compute_and_broadcast()
                except Exception:
                    logger.exception("compute_and_broadcast() raised an unhandled exception")
                await asyncio.sleep(interval_s)
        except asyncio.CancelledError:
            logger.info("SignalBroadcaster loop cancelled — shutting down cleanly")


# Module-level singleton — imported by router and main
broadcaster = SignalBroadcaster()
