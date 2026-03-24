"""Alpaca WebSocket feed for US stock symbols. Replaces yfinance polling."""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Callable

from alpaca.data.live import StockDataStream
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from alpaca.data.enums import DataFeed

from backend.data.bar_store import Bar, BarStore, bar_store as _default_bar_store

logger = logging.getLogger(__name__)

WATCHDOG_TIMEOUT_SECONDS = 180  # 3 minutes
BASE_BACKOFF_SECONDS = 5
MAX_BACKOFF_SECONDS = 60

# Module-level singleton — imported by watchlist router and main.py
feed_restart_event = asyncio.Event()


class AlpacaFeed:
    """
    Manages Alpaca WebSocket stock stream with exponential backoff outer loop.

    Args:
        api_key: Alpaca API key (from ALPACA_API_KEY env var via config)
        secret_key: Alpaca secret key (from ALPACA_SECRET_KEY env var via config)
        symbols: List of stock symbols to subscribe to (e.g. ["SPY", "QQQ"])
        bar_store: BarStore instance (defaults to module-level singleton; injectable for tests)
        feed: DataFeed enum — DataFeed.IEX for free/paper accounts (default)
        get_symbols: Optional callable returning fresh symbol list on each restart
        restart_event: Optional asyncio.Event that triggers early stream restart
    """

    def __init__(
        self,
        api_key: str,
        secret_key: str,
        symbols: list[str] | None = None,
        bar_store: BarStore | None = None,
        feed: DataFeed = DataFeed.IEX,
        get_symbols: Callable[[], list[str]] | None = None,
        restart_event: asyncio.Event | None = None,
    ):
        self._api_key = api_key
        self._secret_key = secret_key
        self.symbols = symbols or []
        self._bar_store = bar_store if bar_store is not None else _default_bar_store
        self._feed = feed
        self._get_symbols = get_symbols
        self._restart_event = restart_event or asyncio.Event()
        self._last_bar_time: dict[str, datetime] = {}

    async def _on_bar(self, bar) -> None:
        """
        Convert an Alpaca bar to project Bar and append to BarStore.

        Deduplicates by timestamp to handle the backfill-to-stream join point.
        Caps BarStore at 500 bars per symbol.
        """
        local_bar = Bar(
            timestamp=bar.timestamp,
            open=float(bar.open),
            high=float(bar.high),
            low=float(bar.low),
            close=float(bar.close),
            volume=float(bar.volume),
        )
        current = self._bar_store.get(bar.symbol)
        # Deduplicate: drop any existing bar with the same timestamp before appending
        deduped = [b for b in current if b.timestamp != local_bar.timestamp]
        self._bar_store.update(bar.symbol, (deduped + [local_bar])[-500:])
        self._last_bar_time[bar.symbol] = local_bar.timestamp
        logger.info(
            "Alpaca bar: %s @ %s close=%s",
            bar.symbol,
            local_bar.timestamp,
            local_bar.close,
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
        Outer loop: exponential backoff reconnect on stream failure.

        When get_symbols callable is provided, refreshes symbol list on each iteration,
        backfills newly added symbols, and removes bars for deleted symbols.
        Races the stream task against the restart event using asyncio.wait FIRST_COMPLETED.
        """
        backoff = BASE_BACKOFF_SECONDS
        while True:
            stream = None
            try:
                # Refresh symbol list from DB if callable provided
                if self._get_symbols is not None:
                    fresh_symbols = self._get_symbols()
                    old_set = set(self.symbols)
                    new_set = set(fresh_symbols)
                    added = new_set - old_set
                    removed = old_set - new_set
                    for sym in removed:
                        self._bar_store.remove(sym)
                    # Backfill newly added symbols before stream starts
                    if added and self._api_key:
                        await backfill_bars(
                            self._api_key,
                            self._secret_key,
                            list(added),
                            self._bar_store,
                        )
                    self.symbols = fresh_symbols

                if not self.symbols:
                    logger.info("AlpacaFeed: no symbols to stream, waiting for restart event")
                    await self._restart_event.wait()
                    self._restart_event.clear()
                    continue

                stream = StockDataStream(
                    api_key=self._api_key,
                    secret_key=self._secret_key,
                    feed=self._feed,
                )
                stream.subscribe_bars(self._on_bar, *self.symbols)
                stream_task = asyncio.create_task(stream._run_forever())
                restart_task = asyncio.create_task(self._wait_for_restart())

                done, pending = await asyncio.wait(
                    {stream_task, restart_task},
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for t in pending:
                    t.cancel()
                    await asyncio.gather(t, return_exceptions=True)

                stream.stop()
                await asyncio.sleep(1)  # teardown safety margin

                self._restart_event.clear()

                if stream_task in done and restart_task not in done:
                    # Stream crashed -- apply backoff
                    exc = stream_task.exception()
                    if exc:
                        logger.error("AlpacaFeed error [%s]: %s -- retrying in %ds", type(exc).__name__, exc, backoff)
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
                else:
                    # Triggered restart -- no backoff, reset counter
                    logger.info("AlpacaFeed: restart event received, reconnecting with updated symbols")
                    backoff = BASE_BACKOFF_SECONDS

            except asyncio.CancelledError:
                logger.info("AlpacaFeed cancelled -- shutting down")
                if stream is not None:
                    stream.stop()
                raise
            except Exception as exc:
                logger.error("AlpacaFeed error [%s]: %s -- retrying in %ds", type(exc).__name__, exc, backoff)
                if stream is not None:
                    stream.stop()
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)

    async def _wait_for_restart(self):
        await self._restart_event.wait()


async def backfill_bars(
    api_key: str,
    secret_key: str,
    symbols: list[str],
    bar_store: BarStore,
    n_bars: int = 200,
) -> None:
    """
    Fetch n_bars of 1-minute historical bars for each symbol and seed BarStore.

    Runs StockHistoricalDataClient synchronously in a thread via asyncio.to_thread.
    Uses 5-day lookback to handle weekends and market holidays.
    """
    client = StockHistoricalDataClient(api_key=api_key, secret_key=secret_key)

    for symbol in symbols:
        request = StockBarsRequest(
            symbol_or_symbols=symbol,
            timeframe=TimeFrame(1, TimeFrameUnit.Minute),
            start=datetime.now(timezone.utc) - timedelta(days=5),
            end=datetime.now(timezone.utc),
            limit=n_bars,
            feed="iex",
        )

        try:
            bar_set = await asyncio.to_thread(lambda: client.get_stock_bars(request))
            symbol_bars = bar_set.data.get(symbol, [])

            bars = [
                Bar(
                    timestamp=b.timestamp,
                    open=float(b.open),
                    high=float(b.high),
                    low=float(b.low),
                    close=float(b.close),
                    volume=float(b.volume),
                )
                for b in sorted(symbol_bars, key=lambda b: b.timestamp)
            ]

            if bars:
                bar_store.update(symbol, bars[-500:])
                logger.info("Backfilled %d bars for %s", len(bars), symbol)
            else:
                logger.warning("Backfill returned no bars for %s", symbol)
        except Exception as exc:
            logger.warning("Backfill skipped for %s: %s", symbol, exc)
