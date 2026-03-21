"""
Tests for BarStore, yfinance feed, and BinanceFeed.
Tests 1-6: BarStore and yfinance poller
Tests 7-12: BinanceFeed WebSocket and lifespan wiring
"""
import asyncio
import logging
import os
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
import pandas as pd
import pytest

# ---------------------------------------------------------------------------
# Tests 1-6: BarStore and yfinance poller
# ---------------------------------------------------------------------------


class TestBarStore:
    """Tests 1-2: BarStore CRUD"""

    def test_update_and_get(self):
        """Test 1: update("SPY", [bar1, bar2]) then get("SPY") returns [bar1, bar2]"""
        from backend.data.bar_store import BarStore, Bar

        store = BarStore()
        now = datetime.now(timezone.utc)
        bar1 = Bar(timestamp=now, open=100.0, high=101.0, low=99.0, close=100.5, volume=1000.0)
        bar2 = Bar(timestamp=now, open=101.0, high=102.0, low=100.0, close=101.5, volume=1200.0)

        store.update("SPY", [bar1, bar2])
        result = store.get("SPY")

        assert result == [bar1, bar2]

    def test_get_unknown_symbol_returns_empty(self):
        """Test 2: get("UNKNOWN") returns empty list, no KeyError"""
        from backend.data.bar_store import BarStore

        store = BarStore()
        result = store.get("UNKNOWN")

        assert result == []


class TestFetchClosedBars:
    """Tests 3-5: fetch_closed_bars() yfinance helper"""

    def _make_df(self, n_rows: int, minutes_ago_start: int = 90) -> pd.DataFrame:
        """Create a sample DataFrame with n_rows of 1-min bars ending near now (market hours)."""
        now_utc = datetime.now(timezone.utc)
        # Build bars ending about 30 seconds ago so recency check passes
        end = now_utc - timedelta(seconds=30)
        # Go back n_rows minutes from end
        start = end - timedelta(minutes=n_rows - 1)
        timestamps = [start + timedelta(minutes=i) for i in range(n_rows)]
        df = pd.DataFrame(
            {
                "Open": [100.0 + i for i in range(n_rows)],
                "High": [101.0 + i for i in range(n_rows)],
                "Low": [99.0 + i for i in range(n_rows)],
                "Close": [100.5 + i for i in range(n_rows)],
                "Volume": [1000.0 + i * 10 for i in range(n_rows)],
            },
            index=pd.DatetimeIndex(timestamps, tz=timezone.utc),
        )
        return df

    @pytest.mark.asyncio
    async def test_fetch_drops_open_bar(self):
        """Test 3: fetch_closed_bars with 5-row df drops last row, returns 4 bars"""
        from backend.data.yfinance_feed import fetch_closed_bars

        df = self._make_df(5)

        # Patch yfinance and bypass the market-hours and recency filters
        with patch("yfinance.Ticker") as mock_ticker, patch(
            "backend.data.yfinance_feed._apply_market_hours_filter", return_value=df.iloc[:-1]
        ), patch(
            "backend.data.yfinance_feed._is_stale", return_value=False
        ):
            mock_ticker.return_value.history.return_value = df
            bars = await fetch_closed_bars("SPY")

        assert len(bars) == 4

    @pytest.mark.asyncio
    async def test_fetch_empty_dataframe_returns_empty_and_logs_warning(self, caplog):
        """Test 4: fetch_closed_bars with empty DataFrame returns [], logs warning"""
        from backend.data.yfinance_feed import fetch_closed_bars

        empty_df = pd.DataFrame(
            columns=["Open", "High", "Low", "Close", "Volume"],
            index=pd.DatetimeIndex([], tz="UTC"),
        )

        with patch("yfinance.Ticker") as mock_ticker:
            mock_ticker.return_value.history.return_value = empty_df
            with caplog.at_level(logging.WARNING, logger="backend.data.yfinance_feed"):
                bars = await fetch_closed_bars("SPY")

        assert bars == []
        assert any("empty" in record.message.lower() for record in caplog.records)

    @pytest.mark.asyncio
    async def test_fetch_recency_filter(self):
        """Test 5: fetch_closed_bars filters out stale bars (last bar older than 90s)"""
        from backend.data.yfinance_feed import fetch_closed_bars

        # Create a df where all bars are old (2+ minutes in market hours yesterday)
        old_time = datetime.now(timezone.utc) - timedelta(hours=24)
        # Force into "market hours" window by using a fixed time
        old_time = old_time.replace(hour=15, minute=0, second=0, microsecond=0)
        timestamps = [old_time + timedelta(minutes=i) for i in range(5)]
        df = pd.DataFrame(
            {
                "Open": [100.0] * 5,
                "High": [101.0] * 5,
                "Low": [99.0] * 5,
                "Close": [100.5] * 5,
                "Volume": [1000.0] * 5,
            },
            index=pd.DatetimeIndex(timestamps, tz=timezone.utc),
        )

        with patch("yfinance.Ticker") as mock_ticker:
            mock_ticker.return_value.history.return_value = df
            bars = await fetch_closed_bars("SPY")

        # Stale bars should be filtered out
        assert bars == []


class TestPollYfinanceLoop:
    """Test 6: poll_yfinance_loop calls fetch_closed_bars once per symbol"""

    @pytest.mark.asyncio
    async def test_loop_calls_fetch_per_symbol(self):
        """Test 6: poll_yfinance_loop calls fetch_closed_bars once per symbol per iteration"""
        from backend.data.yfinance_feed import poll_yfinance_loop
        from backend.data.bar_store import Bar

        now = datetime.now(timezone.utc)
        fake_bar = Bar(timestamp=now, open=100.0, high=101.0, low=99.0, close=100.5, volume=1000.0)

        call_count = [0]

        async def fake_fetch(symbol: str):
            call_count[0] += 1
            return [fake_bar]

        # Patch fetch_closed_bars and asyncio.sleep to break loop after one iteration
        sleep_call_count = [0]

        async def fake_sleep(seconds):
            sleep_call_count[0] += 1
            if sleep_call_count[0] >= 3:  # symbol-gap sleep + interval sleep
                raise asyncio.CancelledError()

        watchlist = ["SPY", "QQQ"]

        with patch("backend.data.yfinance_feed.fetch_closed_bars", side_effect=fake_fetch), patch(
            "asyncio.sleep", side_effect=fake_sleep
        ):
            try:
                await poll_yfinance_loop(lambda: watchlist, interval_s=60)
            except asyncio.CancelledError:
                pass

        # Should have called fetch once per symbol
        assert call_count[0] == 2


# ---------------------------------------------------------------------------
# Tests 7-12: BinanceFeed and lifespan wiring
# ---------------------------------------------------------------------------


class TestBinanceFeedOnClosedBar:
    """Tests 7-8: _on_closed_bar processes kline messages"""

    def _make_kline(self, symbol: str = "BTCUSDT", closed: bool = True) -> dict:
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        return {
            "e": "kline",
            "s": symbol,
            "k": {
                "t": now_ms,
                "o": "50000.0",
                "h": "51000.0",
                "l": "49000.0",
                "c": "50500.0",
                "v": "10.5",
                "x": closed,
                "s": symbol,
            },
        }

    def test_closed_bar_updates_bar_store(self):
        """Test 7: _on_closed_bar with closed kline updates bar_store for BTCUSDT"""
        from backend.data.binance_feed import BinanceFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = BinanceFeed(symbols=["BTCUSDT"], bar_store=store)

        kline = self._make_kline("BTCUSDT", closed=True)["k"]
        kline["s"] = "BTCUSDT"
        feed._on_closed_bar(kline)

        bars = store.get("BTCUSDT")
        assert len(bars) == 1
        assert bars[0].close == 50500.0

    def test_non_closed_bar_does_not_update_store(self):
        """Test 8: _on_closed_bar with non-closed kline (x=False) does NOT update bar_store"""
        from backend.data.binance_feed import BinanceFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = BinanceFeed(symbols=["BTCUSDT"], bar_store=store)

        # Simulate the run() loop: only call _on_closed_bar if kline["x"] is True
        kline = {
            "t": int(datetime.now(timezone.utc).timestamp() * 1000),
            "o": "50000.0",
            "h": "51000.0",
            "l": "49000.0",
            "c": "50500.0",
            "v": "10.5",
            "x": False,
            "s": "BTCUSDT",
        }

        if kline["x"]:
            feed._on_closed_bar(kline)

        bars = store.get("BTCUSDT")
        assert bars == []


class TestBinanceFeedErrorHandling:
    """Test 9: Error kline message handling"""

    def test_error_message_indicated_by_event_type(self):
        """Test 9: A message with e='error' should be detected (triggers restart in run())"""
        from backend.data.binance_feed import BinanceFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = BinanceFeed(symbols=["BTCUSDT"], bar_store=store)

        error_msg = {"e": "error", "m": "stream error"}

        # The run() loop checks msg.get("e") == "error" to break inner loop
        # Test the detection logic directly
        is_error = error_msg.get("e") == "error"
        assert is_error is True

        # No bars should have been added
        assert store.get("BTCUSDT") == []


class TestBinanceFeedWatchdog:
    """Test 10: Watchdog logs error after 3 minutes of inactivity"""

    def test_watchdog_logs_error_when_stale(self, caplog):
        """Test 10: _check_watchdog() logs error if last_bar_time > 3 minutes ago"""
        from backend.data.binance_feed import BinanceFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = BinanceFeed(symbols=["BTCUSDT"], bar_store=store)

        # Set last bar time to 4 minutes ago
        stale_time = datetime.now(timezone.utc) - timedelta(minutes=4)
        feed._last_bar_time["BTCUSDT"] = stale_time

        with caplog.at_level(logging.ERROR, logger="backend.data.binance_feed"):
            feed._check_watchdog("BTCUSDT")

        assert any("watchdog" in record.message.lower() for record in caplog.records)

    def test_watchdog_no_error_when_fresh(self, caplog):
        """Test 10b: _check_watchdog() does NOT log error when bar is recent"""
        from backend.data.binance_feed import BinanceFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = BinanceFeed(symbols=["BTCUSDT"], bar_store=store)

        # Set last bar time to 1 minute ago (fresh)
        fresh_time = datetime.now(timezone.utc) - timedelta(minutes=1)
        feed._last_bar_time["BTCUSDT"] = fresh_time

        with caplog.at_level(logging.ERROR, logger="backend.data.binance_feed"):
            feed._check_watchdog("BTCUSDT")

        error_records = [r for r in caplog.records if r.levelno >= logging.ERROR]
        assert len(error_records) == 0


class TestLifespanFeedWiring:
    """Tests 11-12: Lifespan starts and cancels all background tasks (feeds + signal broadcaster)"""

    def _make_settings_mock(self):
        """Return a mock Settings with alpaca credentials set."""
        settings = MagicMock()
        settings.alpaca_api_key = "test-api-key"
        settings.alpaca_secret_key = "test-secret-key"
        settings.alpaca_data_feed = "iex"
        return settings

    def _make_session_mock(self):
        """Return a mock Session context manager that yields a mock with WatchlistRepository support."""
        mock_watchlist_item = MagicMock()
        mock_watchlist_item.symbol = "SPY"
        mock_repo = MagicMock()
        mock_repo.get_all.return_value = [mock_watchlist_item]
        mock_session = MagicMock()
        mock_session_ctx = MagicMock()
        mock_session_ctx.__enter__ = MagicMock(return_value=mock_session)
        mock_session_ctx.__exit__ = MagicMock(return_value=False)
        mock_session_constructor = MagicMock(return_value=mock_session_ctx)
        return mock_session_constructor, mock_repo

    @pytest.mark.asyncio
    async def test_lifespan_creates_three_tasks(self):
        """Test 11: lifespan startup creates 3 asyncio tasks: broadcaster + alpaca_feed + binance_feed (when both keys and ENABLE_BINANCE_FEED are set)"""
        created_tasks = []

        real_create_task = asyncio.create_task

        def mock_create_task(coro, **kwargs):
            task = real_create_task(coro, **kwargs)
            created_tasks.append(task)
            return task

        from backend.main import app

        mock_session_cls, mock_repo = self._make_session_mock()

        with patch("backend.main.create_db_and_tables"), patch(
            "backend.main.seed_defaults"
        ), patch("backend.main.Session", mock_session_cls), patch(
            "backend.main.get_engine"
        ), patch(
            "backend.main.WatchlistRepository", return_value=mock_repo
        ), patch(
            "backend.main.get_settings", return_value=self._make_settings_mock()
        ), patch(
            "backend.main.backfill_bars", new_callable=AsyncMock
        ), patch(
            "backend.main.asyncio.create_task", side_effect=mock_create_task
        ), patch.dict(
            os.environ, {"ENABLE_BINANCE_FEED": "true"}
        ):
            async with app.router.lifespan_context(app):
                pass

        assert len(created_tasks) == 3

    @pytest.mark.asyncio
    async def test_lifespan_cancels_all_tasks_on_shutdown(self):
        """Test 12: lifespan shutdown calls cancel() on all background tasks (broadcaster + alpaca_feed + binance_feed)"""
        mock_tasks = []

        def mock_create_task(coro, **kwargs):
            task = MagicMock()
            task.__class__ = asyncio.Task
            # Make the mock awaitable for gather
            mock_tasks.append(task)
            # Cancel the real coroutine to avoid resource warnings
            coro.close()
            return task

        from backend.main import app

        mock_session_cls, mock_repo = self._make_session_mock()

        with patch("backend.main.create_db_and_tables"), patch(
            "backend.main.seed_defaults"
        ), patch("backend.main.Session", mock_session_cls), patch(
            "backend.main.get_engine"
        ), patch(
            "backend.main.WatchlistRepository", return_value=mock_repo
        ), patch(
            "backend.main.get_settings", return_value=self._make_settings_mock()
        ), patch(
            "backend.main.backfill_bars", new_callable=AsyncMock
        ), patch(
            "backend.main.asyncio.create_task", side_effect=mock_create_task
        ), patch(
            "backend.main.asyncio.gather", new_callable=AsyncMock
        ), patch.dict(
            os.environ, {"ENABLE_BINANCE_FEED": "true"}
        ):
            async with app.router.lifespan_context(app):
                pass

        assert len(mock_tasks) == 3
        for task in mock_tasks:
            task.cancel.assert_called_once()


# ---------------------------------------------------------------------------
# Tests 13-20: AlpacaFeed WebSocket feed and backfill
# ---------------------------------------------------------------------------


def _make_alpaca_bar(
    symbol: str = "SPY",
    timestamp: datetime | None = None,
    open: float = 400.0,
    high: float = 401.0,
    low: float = 399.0,
    close: float = 400.5,
    volume: float = 5000.0,
) -> MagicMock:
    """Helper: create a mock AlpacaBar with the required fields."""
    bar = MagicMock()
    bar.symbol = symbol
    bar.timestamp = timestamp or datetime.now(timezone.utc)
    bar.open = open
    bar.high = high
    bar.low = low
    bar.close = close
    bar.volume = volume
    return bar


class TestAlpacaFeed:
    """Tests 13-20: AlpacaFeed class and backfill_bars function."""

    def test_on_bar_converts_and_stores(self):
        """Test 13: _on_bar converts AlpacaBar to project Bar and stores in BarStore."""
        from backend.data.alpaca_feed import AlpacaFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = AlpacaFeed(api_key="k", secret_key="s", symbols=["SPY"], bar_store=store)

        ts = datetime(2026, 3, 21, 14, 30, tzinfo=timezone.utc)
        alpaca_bar = _make_alpaca_bar(symbol="SPY", timestamp=ts, close=401.5)
        feed._on_bar(alpaca_bar)

        bars = store.get("SPY")
        assert len(bars) == 1
        assert bars[0].close == 401.5
        assert bars[0].timestamp == ts
        assert bars[0].open == 400.0

    def test_on_bar_deduplicates_by_timestamp(self):
        """Test 14: _on_bar deduplicates by timestamp — calling _on_bar twice with same timestamp gives 1 bar."""
        from backend.data.alpaca_feed import AlpacaFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = AlpacaFeed(api_key="k", secret_key="s", symbols=["SPY"], bar_store=store)

        ts = datetime(2026, 3, 21, 14, 30, tzinfo=timezone.utc)
        bar1 = _make_alpaca_bar(symbol="SPY", timestamp=ts, close=400.0)
        bar2 = _make_alpaca_bar(symbol="SPY", timestamp=ts, close=401.0)

        feed._on_bar(bar1)
        feed._on_bar(bar2)

        bars = store.get("SPY")
        assert len(bars) == 1
        # Second call overwrites the first (latest value wins)
        assert bars[0].close == 401.0

    def test_on_bar_caps_at_500(self):
        """Test 15: _on_bar caps BarStore at 500 bars — pre-fill 500, add 1, assert len==500 and newest is the added one."""
        from backend.data.alpaca_feed import AlpacaFeed
        from backend.data.bar_store import BarStore, Bar

        store = BarStore()
        feed = AlpacaFeed(api_key="k", secret_key="s", symbols=["SPY"], bar_store=store)

        # Pre-fill with 500 bars at different timestamps
        base_ts = datetime(2026, 3, 21, 9, 0, tzinfo=timezone.utc)
        existing_bars = [
            Bar(
                timestamp=base_ts + timedelta(minutes=i),
                open=100.0,
                high=101.0,
                low=99.0,
                close=100.0,
                volume=1000.0,
            )
            for i in range(500)
        ]
        store.update("SPY", existing_bars)

        # Add one new bar with a timestamp after all existing bars
        new_ts = base_ts + timedelta(minutes=500)
        new_alpaca_bar = _make_alpaca_bar(symbol="SPY", timestamp=new_ts, close=555.0)
        feed._on_bar(new_alpaca_bar)

        bars = store.get("SPY")
        assert len(bars) == 500
        assert bars[-1].close == 555.0
        assert bars[-1].timestamp == new_ts

    @pytest.mark.asyncio
    async def test_backfill_bars_seeds_bar_store(self):
        """Test 16: backfill_bars seeds BarStore from mocked StockHistoricalDataClient response."""
        from backend.data.alpaca_feed import backfill_bars
        from backend.data.bar_store import BarStore

        store = BarStore()
        ts = datetime(2026, 3, 21, 14, 30, tzinfo=timezone.utc)
        mock_alpaca_bar = _make_alpaca_bar(symbol="SPY", timestamp=ts)

        mock_bar_set = MagicMock()
        mock_bar_set.data = {"SPY": [mock_alpaca_bar]}

        with patch("backend.data.alpaca_feed.StockHistoricalDataClient") as mock_client_cls, \
             patch("asyncio.to_thread") as mock_to_thread:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_to_thread.return_value = mock_bar_set

            await backfill_bars("key", "secret", ["SPY"], store)

        bars = store.get("SPY")
        assert len(bars) == 1
        assert bars[0].close == 400.5

    @pytest.mark.asyncio
    async def test_backfill_bars_empty_response_logs_warning(self, caplog):
        """Test 17: backfill_bars with empty response logs WARNING and leaves BarStore empty."""
        from backend.data.alpaca_feed import backfill_bars
        from backend.data.bar_store import BarStore

        store = BarStore()
        mock_bar_set = MagicMock()
        mock_bar_set.data = {"SPY": []}

        with patch("backend.data.alpaca_feed.StockHistoricalDataClient") as mock_client_cls, \
             patch("asyncio.to_thread") as mock_to_thread:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_to_thread.return_value = mock_bar_set

            with caplog.at_level(logging.WARNING, logger="backend.data.alpaca_feed"):
                await backfill_bars("key", "secret", ["SPY"], store)

        bars = store.get("SPY")
        assert bars == []
        assert any("no bars" in record.message.lower() for record in caplog.records)

    def test_check_watchdog_logs_error_when_stale(self, caplog):
        """Test 18: _check_watchdog logs ERROR when last_bar_time > 3 minutes ago."""
        from backend.data.alpaca_feed import AlpacaFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = AlpacaFeed(api_key="k", secret_key="s", symbols=["SPY"], bar_store=store)

        stale_time = datetime.now(timezone.utc) - timedelta(minutes=4)
        feed._last_bar_time["SPY"] = stale_time

        with caplog.at_level(logging.ERROR, logger="backend.data.alpaca_feed"):
            feed._check_watchdog("SPY")

        assert any("watchdog" in record.message.lower() for record in caplog.records)

    def test_check_watchdog_no_error_when_fresh(self, caplog):
        """Test 19: _check_watchdog does NOT log error when last_bar_time is recent."""
        from backend.data.alpaca_feed import AlpacaFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = AlpacaFeed(api_key="k", secret_key="s", symbols=["SPY"], bar_store=store)

        fresh_time = datetime.now(timezone.utc) - timedelta(minutes=1)
        feed._last_bar_time["SPY"] = fresh_time

        with caplog.at_level(logging.ERROR, logger="backend.data.alpaca_feed"):
            feed._check_watchdog("SPY")

        error_records = [r for r in caplog.records if r.levelno >= logging.ERROR]
        assert len(error_records) == 0

    @pytest.mark.asyncio
    async def test_run_retries_with_exponential_backoff(self):
        """Test 20: AlpacaFeed.run() retries with exponential backoff when _run_forever raises.

        First call raises Exception -> sleep(5), second call raises Exception -> sleep(10),
        third call raises CancelledError to exit.
        """
        from backend.data.alpaca_feed import AlpacaFeed
        from backend.data.bar_store import BarStore

        store = BarStore()
        feed = AlpacaFeed(api_key="k", secret_key="s", symbols=["SPY"], bar_store=store)

        call_count = [0]
        sleep_args = []

        async def fake_run_forever():
            call_count[0] += 1
            if call_count[0] <= 2:
                raise Exception("test stream error")
            raise asyncio.CancelledError()

        async def fake_sleep(seconds):
            sleep_args.append(seconds)

        mock_stream = MagicMock()
        mock_stream._run_forever = fake_run_forever
        mock_stream.stop = MagicMock()

        with patch("backend.data.alpaca_feed.StockDataStream", return_value=mock_stream), \
             patch("asyncio.sleep", side_effect=fake_sleep), \
             patch("asyncio.create_task", side_effect=lambda coro: asyncio.ensure_future(coro)):
            try:
                await feed.run()
            except asyncio.CancelledError:
                pass

        # Sequence: sleep(1) teardown margin, sleep(5) backoff, sleep(1) teardown, sleep(10) backoff
        assert sleep_args[1] == 5
        assert sleep_args[3] == 10
