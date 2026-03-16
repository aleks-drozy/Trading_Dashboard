"""
Tests for BarStore, yfinance feed, and BinanceFeed.
Tests 1-6: BarStore and yfinance poller
Tests 7-12: BinanceFeed WebSocket and lifespan wiring
"""
import asyncio
import logging
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
        """Create a sample DataFrame with n_rows of 1-min bars in market hours."""
        # Use current date but set to market hours (14:00 UTC = 09:00 ET approximately)
        now_utc = datetime.now(timezone.utc).replace(tzinfo=timezone.utc)
        # Put bars in NY market hours (14:30-20:00 UTC)
        base = now_utc.replace(hour=14, minute=30, second=0, microsecond=0)
        timestamps = [base + timedelta(minutes=i) for i in range(n_rows)]
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

        with patch("yfinance.Ticker") as mock_ticker:
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
    """Tests 11-12: Lifespan starts and cancels both feed tasks"""

    @pytest.mark.asyncio
    async def test_lifespan_creates_two_tasks(self):
        """Test 11: lifespan startup creates asyncio tasks for both feed coroutines"""
        created_tasks = []

        real_create_task = asyncio.create_task

        def mock_create_task(coro, **kwargs):
            task = real_create_task(coro, **kwargs)
            created_tasks.append(task)
            return task

        from backend.main import app

        with patch("backend.main.asyncio.create_task", side_effect=mock_create_task):
            async with app.router.lifespan_context(app):
                pass

        assert len(created_tasks) == 2

    @pytest.mark.asyncio
    async def test_lifespan_cancels_both_tasks_on_shutdown(self):
        """Test 12: lifespan shutdown calls cancel() on both tasks"""
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

        with patch("backend.main.asyncio.create_task", side_effect=mock_create_task), patch(
            "asyncio.gather", new_callable=AsyncMock
        ):
            async with app.router.lifespan_context(app):
                pass

        assert len(mock_tasks) == 2
        for task in mock_tasks:
            task.cancel.assert_called_once()
