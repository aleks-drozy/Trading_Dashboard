"""
Binance WebSocket feed for crypto symbols.
BinanceFeed.run() is started as an asyncio task in the FastAPI lifespan.
Implements Pattern 4: proactive 23-hour reconnect to avoid Binance's hard 24-hour disconnect.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from binance import AsyncClient, BinanceSocketManager

from backend.data.bar_store import Bar, BarStore, bar_store as _default_bar_store

logger = logging.getLogger(__name__)

RECONNECT_INTERVAL_SECONDS = 23 * 3600  # 23 hours — proactive restart before 24h limit
WATCHDOG_TIMEOUT_SECONDS = 180  # 3 minutes


class BinanceFeed:
    """
    Manages Binance kline WebSocket streams with a proactive 23-hour reconnect outer loop.

    Args:
        symbols: List of trading pairs to subscribe to (e.g. ["BTCUSDT", "ETHUSDT"])
        bar_store: BarStore instance (defaults to module-level singleton; injectable for tests)
    """

    def __init__(
        self,
        symbols: list[str] | None = None,
        bar_store: BarStore | None = None,
    ):
        self.symbols = symbols or ["BTCUSDT"]
        self._bar_store = bar_store if bar_store is not None else _default_bar_store
        self._last_bar_time: dict[str, datetime] = {}

    def _on_closed_bar(self, kline: dict) -> None:
        """
        Process a closed kline dict into BarStore.

        Called only when kline["x"] is True (bar is closed).
        Appends the new bar to existing bars, capping at 500 per symbol.
        """
        symbol = kline["s"]
        bar = Bar(
            timestamp=datetime.fromtimestamp(kline["t"] / 1000, tz=timezone.utc),
            open=float(kline["o"]),
            high=float(kline["h"]),
            low=float(kline["l"]),
            close=float(kline["c"]),
            volume=float(kline["v"]),
        )
        current = self._bar_store.get(symbol)
        self._bar_store.update(symbol, (current + [bar])[-500:])  # keep last 500 bars
        self._last_bar_time[symbol] = bar.timestamp
        logger.info(
            "Binance closed bar: %s @ %s close=%s",
            symbol,
            bar.timestamp,
            bar.close,
        )

    def _check_watchdog(self, symbol: str) -> None:
        """Log an error if no bar has been received for `symbol` in >3 minutes."""
        last = self._last_bar_time.get(symbol)
        if last is None:
            return
        age = datetime.now(timezone.utc) - last
        if age > timedelta(seconds=WATCHDOG_TIMEOUT_SECONDS):
            logger.error(
                "WATCHDOG: No bar received for %s in >3 minutes. Last: %s",
                symbol,
                last,
            )

    async def run(self) -> None:
        """
        Outer loop: proactive 23-hour restart to avoid Binance's hard 24-hour WebSocket limit.

        Inner loop: receive kline messages per symbol, call _on_closed_bar on closed bars,
        break inner loop on error messages (triggers outer loop restart with back-off).
        """
        client = None
        while True:
            try:
                client = await AsyncClient.create(api_key=None, api_secret=None)
                bm = BinanceSocketManager(client)

                for symbol in self.symbols:
                    async with bm.kline_socket(symbol, interval="1m") as stream:
                        deadline = (
                            asyncio.get_event_loop().time() + RECONNECT_INTERVAL_SECONDS
                        )
                        while asyncio.get_event_loop().time() < deadline:
                            try:
                                msg = await asyncio.wait_for(
                                    stream.recv(),
                                    timeout=WATCHDOG_TIMEOUT_SECONDS,
                                )
                            except asyncio.TimeoutError:
                                logger.error(
                                    "Binance stream timeout for %s — no message in %ds",
                                    symbol,
                                    WATCHDOG_TIMEOUT_SECONDS,
                                )
                                break

                            if msg is None or msg.get("e") == "error":
                                logger.warning(
                                    "Binance stream error for %s, restarting", symbol
                                )
                                break

                            kline = msg.get("k", {})
                            self._check_watchdog(symbol)
                            if kline.get("x"):  # closed bar only
                                self._on_closed_bar(kline)

            except asyncio.CancelledError:
                logger.info("BinanceFeed cancelled — shutting down")
                raise
            except Exception as exc:
                logger.error("Binance feed error: %s — restarting in 5s", exc)
                await asyncio.sleep(5)
            finally:
                if client is not None:
                    try:
                        await client.close_connection()
                    except Exception:
                        pass
                    client = None

            await asyncio.sleep(1)


# Module-level singleton — wired into lifespan by main.py
binance_feed = BinanceFeed()
