# Phase 4: Alpaca Real-time Feed - Research

**Researched:** 2026-03-21
**Domain:** alpaca-py WebSocket streaming + REST backfill + asyncio integration
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-05 | Backend streams 1-minute OHLCV bars for US stocks via Alpaca WebSocket (replaces yfinance polling) | StockDataStream + subscribe_bars() + _run_forever() pattern fully documented |
| DATA-06 | Backend seeds BarStore with 100+ historical bars via Alpaca REST API on startup | StockHistoricalDataClient + get_stock_bars() with TimeFrame.Minute confirmed; limit 1000 covers 100+ bars easily |
| DATA-07 | Backend auto-reconnects to Alpaca WebSocket with exponential backoff on connection loss | _run_forever() has built-in reconnect; outer asyncio retry loop with backoff required for connection-level failures |
</phase_requirements>

---

## Summary

Phase 4 replaces the existing `poll_yfinance_loop` background task with an `AlpacaFeed` class that (1) seeds BarStore on startup via a synchronous REST backfill call using `StockHistoricalDataClient`, and (2) streams closed 1-minute bars in real time via `StockDataStream`. The Binance feed pattern established in Phase 1 is the direct template: injectable BarStore, outer retry loop with sleep, inner stream subscription, watchdog timer. The most important implementation decision is already locked in STATE.md: use `asyncio.create_task(stream._run_forever())` not `stream.run()` — because `run()` calls `asyncio.run()` internally, which raises `RuntimeError` inside FastAPI's existing event loop (issue #476).

The REST backfill is synchronous (`StockHistoricalDataClient.get_stock_bars()` is blocking), so it must run in `asyncio.to_thread()` during the lifespan startup, before the stream task is created. The BarStore `append` pattern (existing bars + new bar, capped at 500) established by BinanceFeed is reused verbatim for the streaming path. A timestamp deduplication step is required at the backfill→stream join point: a bar may appear in both the REST response and the first live WebSocket message.

The free Alpaca tier uses the IEX feed (not SIP). IEX covers major US exchanges and is adequate for SPY and other large-cap watchlist symbols. Rate limit is 200 REST calls/minute on the free tier, which is not a concern given the single startup backfill.

**Primary recommendation:** Model `AlpacaFeed` directly on `BinanceFeed` — same injectable BarStore pattern, same outer/inner loop structure, same watchdog. Replace `poll_yfinance_loop` in `main.py` lifespan with `AlpacaFeed.run()` (started as `asyncio.create_task`). Add REST backfill as a startup-only `asyncio.to_thread` call before the feed task starts.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| alpaca-py | >=0.40.0,<0.50.0 | Alpaca WebSocket stream + REST historical bars | Official Alpaca Python SDK; the only supported SDK for alpaca-py v2 API |

**Version rationale:** Latest is 0.43.2 (published 2025-11-04). Pin `>=0.40.0,<0.50.0` as documented in STATE.md — `_run_forever()` is a private API, minor version pin protects against unexpected removal. Do NOT pin to exact version; Alpaca actively releases patches.

### Existing (no change)

| Library | Already in requirements.txt | Role |
|---------|-----------------------------|------|
| fastapi / uvicorn | >=0.115 / >=0.30 | Web server + lifespan context |
| pandas | >=2.0 | Bar data manipulation for deduplication |
| python-dotenv / pydantic-settings | >=1.0 / >=2.0 | API key loading from .env |

### Not Needed

| Library | Why Not |
|---------|---------|
| `backoff` (PyPI) | Unnecessary — outer loop uses `asyncio.sleep` with manual exponential calculation, same as BinanceFeed. Simple and no extra dependency. |
| `websockets` | Alpaca-py bundles its own WebSocket client. |

### Installation

```bash
pip install "alpaca-py>=0.40.0,<0.50.0"
```

Add to `requirements.txt`:
```
alpaca-py>=0.40.0,<0.50.0
```

Remove from `requirements.txt` once confirmed no other code uses it:
```
yfinance>=0.2.50
```

**Version verified:** `pip index versions alpaca-py` → latest is `0.43.2` (2025-11-04, confirmed PyPI).

---

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── data/
│   ├── bar_store.py          # unchanged
│   ├── binance_feed.py       # unchanged (crypto)
│   ├── alpaca_feed.py        # NEW — replaces yfinance_feed.py for stocks
│   └── yfinance_feed.py      # keep but no longer wired in lifespan
├── main.py                   # lifespan: swap poll_yfinance_loop -> alpaca_feed.run()
└── config.py                 # add ALPACA_API_KEY, ALPACA_SECRET_KEY settings
tests/
└── test_data_feeds.py        # extend: add AlpacaFeed tests (Tests 13–20)
```

### Pattern 1: AlpacaFeed Class (modelled on BinanceFeed)

**What:** A class with injectable BarStore, outer retry loop, inner `_run_forever()` stream, and watchdog.

**When to use:** Always — this is the only integration pattern that works inside FastAPI's event loop.

```python
# Source: alpaca-py issue #476 + BinanceFeed pattern in backend/data/binance_feed.py
import asyncio
import logging
from datetime import datetime, timezone, timedelta

from alpaca.data.live import StockDataStream
from alpaca.data.enums import DataFeed
from alpaca.data.models import Bar as AlpacaBar

from backend.data.bar_store import Bar, BarStore, bar_store as _default_bar_store

logger = logging.getLogger(__name__)

WATCHDOG_TIMEOUT_SECONDS = 180   # 3 minutes
BASE_BACKOFF_SECONDS = 5
MAX_BACKOFF_SECONDS = 60


class AlpacaFeed:
    def __init__(
        self,
        api_key: str,
        secret_key: str,
        symbols: list[str] | None = None,
        bar_store: BarStore | None = None,
        feed: DataFeed = DataFeed.IEX,
    ):
        self._api_key = api_key
        self._secret_key = secret_key
        self.symbols = symbols or []
        self._bar_store = bar_store if bar_store is not None else _default_bar_store
        self._feed = feed
        self._last_bar_time: dict[str, datetime] = {}

    def _on_bar(self, bar: AlpacaBar) -> None:
        """Append closed bar to BarStore, capped at 500."""
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

    async def run(self) -> None:
        backoff = BASE_BACKOFF_SECONDS
        while True:
            stream = None
            try:
                stream = StockDataStream(
                    api_key=self._api_key,
                    secret_key=self._secret_key,
                    feed=self._feed,
                )
                stream.subscribe_bars(self._on_bar, *self.symbols)
                await asyncio.create_task(stream._run_forever())
                backoff = BASE_BACKOFF_SECONDS  # reset on clean exit
            except asyncio.CancelledError:
                logger.info("AlpacaFeed cancelled — shutting down")
                if stream is not None:
                    stream.stop()
                raise
            except Exception as exc:
                logger.error("AlpacaFeed error: %s — retrying in %ds", exc, backoff)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, MAX_BACKOFF_SECONDS)
```

### Pattern 2: REST Backfill on Startup

**What:** Blocking REST call wrapped in `asyncio.to_thread()`, called once during lifespan before stream starts. Returns 100+ bars in ascending timestamp order. Deduplicates against BarStore contents.

**When to use:** During FastAPI lifespan startup, after DB init, before `asyncio.create_task(alpaca_feed.run())`.

```python
# Source: alpaca-py docs + forum example (https://forum.alpaca.markets/t/5min-stock-bar-example-for-alpaca-py-in-case-you-want-to-see-it/12864)
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from datetime import datetime, timedelta, timezone


async def backfill_bars(
    api_key: str,
    secret_key: str,
    symbols: list[str],
    bar_store: BarStore,
    n_bars: int = 200,
) -> None:
    """
    Fetch n_bars of 1-minute historical bars for each symbol and seed BarStore.
    Runs StockHistoricalDataClient synchronously in a thread.
    """
    client = StockHistoricalDataClient(api_key=api_key, secret_key=secret_key)

    for symbol in symbols:
        end = datetime.now(timezone.utc)
        # Go back far enough to gather n_bars of market-hours bars (factor 3 for weekends/gaps)
        start = end - timedelta(days=5)

        request = StockBarsRequest(
            symbol_or_symbols=symbol,
            timeframe=TimeFrame(1, TimeFrameUnit.Minute),
            start=start,
            end=end,
            limit=n_bars,
            feed="iex",
        )

        def _fetch():
            return client.get_stock_bars(request)

        bar_set = await asyncio.to_thread(_fetch)
        symbol_bars = bar_set.get(symbol, [])  # BarSet is dict-like

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
```

**Key detail on BarSet access:** `StockHistoricalDataClient.get_stock_bars()` returns a `BarSet` object. When `symbol_or_symbols` is a single string, the result is accessed as `bar_set[symbol]` or `bar_set.data[symbol]`. When it is a list, results are keyed by symbol. Always use `bar_set.get(symbol, [])` for safety.

### Pattern 3: Lifespan Wiring

**What:** Replace `poll_yfinance_loop` task with backfill (awaited, not tasked) + `AlpacaFeed.run()` task.

```python
# Source: backend/main.py existing pattern
@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    with Session(get_engine()) as session:
        seed_defaults(session)

    def get_watchlist_symbols() -> list[str]:
        with Session(get_engine()) as s:
            return [w.symbol for w in WatchlistRepository(s).get_all()]

    stock_symbols = [s for s in get_watchlist_symbols() if not s.endswith("USDT")]

    # REST backfill: runs to completion before stream starts
    if stock_symbols and settings.ALPACA_API_KEY:
        await backfill_bars(settings.ALPACA_API_KEY, settings.ALPACA_SECRET_KEY, stock_symbols, bar_store)

    alpaca_feed = AlpacaFeed(
        api_key=settings.ALPACA_API_KEY,
        secret_key=settings.ALPACA_SECRET_KEY,
        symbols=stock_symbols,
    )

    tasks = [
        asyncio.create_task(alpaca_feed.run()),
        asyncio.create_task(broadcaster.run()),
    ]
    if os.getenv("ENABLE_BINANCE_FEED", "").lower() == "true":
        tasks.append(asyncio.create_task(binance_feed.run()))

    yield

    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)
```

### Pattern 4: Stale Feed Watchdog (3-minute alert threshold per DATA-07)

**What:** A background check in the AlpacaFeed or a separate asyncio task that logs an ERROR (not user-visible alert) if no bar arrives for any subscribed symbol within 3 minutes. The UI only shows an alert if the frontend detects the WebSocket signal feed is stale.

**When to use:** Inside `_on_bar` handler — record `self._last_bar_time[symbol]`. In the outer `run()` loop, periodically call `_check_watchdog()` per symbol (reuse BinanceFeed._check_watchdog logic exactly).

### Anti-Patterns to Avoid

- **Calling `stream.run()` inside FastAPI lifespan:** `run()` calls `asyncio.run()` internally → `RuntimeError: This event loop is already running`. Always use `asyncio.create_task(stream._run_forever())`.
- **Calling `stream.subscribe_bars()` on a running stream for dynamic watchlist changes:** Confirmed hang bug (issue #491). Phase 6 handles this with stream cancel + restart. Do NOT attempt dynamic subscription in Phase 4.
- **Using `asyncio.to_thread()` for the stream itself:** Only the synchronous REST client call (`StockHistoricalDataClient`) needs to_thread. The stream is async-native.
- **Storing raw `AlpacaBar` objects in BarStore:** Always convert to the project's `Bar` dataclass to avoid coupling all downstream code to alpaca-py's model.
- **Requesting a single day's backfill:** Outside market hours (weekends, holidays), `start = now - 1 day` may return zero bars. Always use at least 5 days lookback.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebSocket connection to Alpaca | Raw `websockets` client | `alpaca.data.live.StockDataStream` | Authentication, message framing, subscription protocol all handled |
| Historical bar REST pagination | Manual HTTP + cursor loop | `StockHistoricalDataClient.get_stock_bars()` | Handles pagination with `page_token` automatically |
| Bar data model parsing | Custom JSON parser | `alpaca.data.models.Bar` (received by handler) | Type-safe, includes timestamp as `datetime`, fields match |
| Feed → BarStore conversion | Per-field mapping inline everywhere | Single `_on_bar()` method that converts `AlpacaBar` → project `Bar` | Isolation point; if alpaca-py changes Bar fields, only one place to update |

**Key insight:** The alpaca-py `StockDataStream` handles TLS, auth handshake, subscription message, and low-level reconnect within `_run_forever()`. The outer wrapper (`AlpacaFeed.run()`) only needs to handle the case where `_run_forever()` raises an unrecoverable exception (e.g., auth failure, 406 error) and applies exponential backoff before recreating the stream.

---

## Common Pitfalls

### Pitfall 1: `run()` vs `_run_forever()` in asyncio context

**What goes wrong:** Calling `stream.run()` from inside FastAPI's lifespan raises `RuntimeError: This event loop is already running` immediately.

**Why it happens:** `StockDataStream.run()` calls `asyncio.run(_run_forever())` which tries to create a new event loop — forbidden when one is already running (FastAPI/uvicorn owns the loop).

**How to avoid:** Always use `asyncio.create_task(stream._run_forever())`.

**Warning signs:** `RuntimeError: This event loop is already running` in uvicorn logs at startup.

### Pitfall 2: Backfill→Stream timestamp collision (deduplication gap)

**What goes wrong:** The last bar in the REST backfill response and the first bar emitted by the WebSocket stream are the same bar (same timestamp). BarStore ends up with a duplicate bar, corrupting the 500-bar window count.

**Why it happens:** Backfill `end` is `now()` and the stream starts ~seconds later. The final complete minute bar exists in both REST response and stream.

**How to avoid:** In `_on_bar()`, deduplicate by timestamp before appending: `deduped = [b for b in current if b.timestamp != new_bar.timestamp]`, then append `new_bar`. Covered by unit test (see Pitfall-specific test in STATE.md blockers).

**Warning signs:** BarStore length exceeds expected count; duplicate timestamps in signal computation.

### Pitfall 3: Zero bars on weekend/holiday backfill

**What goes wrong:** `start = now - timedelta(days=1)` returns 0 bars on Monday morning or after market holidays because no trading occurred in the lookback window.

**Why it happens:** IEX only has bars during market hours on trading days.

**How to avoid:** Use at least `start = now - timedelta(days=5)` for 1-minute backfill. Limit to 200 to avoid excessive data. Log a WARNING (not ERROR) if `len(bars) < 100` after backfill — not a fatal failure.

**Warning signs:** BarStore shows 0 bars for symbol after startup; signal state is `None` for all symbols.

### Pitfall 4: `_run_forever()` private API instability

**What goes wrong:** A future alpaca-py version removes or renames `_run_forever()`.

**Why it happens:** It is explicitly marked as private (underscore prefix).

**How to avoid:** Pin `alpaca-py>=0.40.0,<0.50.0`. Add an integration smoke test that asserts bars flow within 2 minutes (per STATE.md Phase 4 critical blocker).

**Warning signs:** `AttributeError: 'StockDataStream' object has no attribute '_run_forever'` after dependency upgrade.

### Pitfall 5: Wrong `feed` parameter for free tier

**What goes wrong:** Passing `feed="sip"` (or `DataFeed.SIP`) with a free/paper Alpaca account returns a subscription error during WebSocket authentication.

**Why it happens:** SIP requires a paid Algo Trader Plus subscription. Paper accounts only have access to IEX.

**How to avoid:** Default to `DataFeed.IEX` always. Configure via env var `ALPACA_DATA_FEED=iex` (default). Log the feed type at startup.

**Warning signs:** WebSocket auth error in logs containing "insufficient subscription" or "feed not available".

### Pitfall 6: `StockHistoricalDataClient` is blocking

**What goes wrong:** Calling `client.get_stock_bars()` directly in `async def lifespan()` blocks the event loop during startup.

**Why it happens:** `StockHistoricalDataClient` uses `httpx` in synchronous mode internally.

**How to avoid:** Always wrap in `asyncio.to_thread(lambda: client.get_stock_bars(request))`.

**Warning signs:** Uvicorn reports startup taking >2 seconds with no log messages in between; event loop becomes unresponsive.

---

## Code Examples

Verified patterns from official sources and project context:

### AlpacaFeed Handler (converting AlpacaBar to project Bar)

```python
# Source: alpaca-py data models (github.com/alpacahq/alpaca-py/blob/master/alpaca/data/models/bars.py)
# AlpacaBar fields: symbol (str), timestamp (datetime), open (float), high (float),
#                   low (float), close (float), volume (float), vwap (Optional[float]),
#                   trade_count (Optional[float])

async def _on_bar(self, alpaca_bar: AlpacaBar) -> None:
    local_bar = Bar(
        timestamp=alpaca_bar.timestamp,   # already a datetime (timezone-aware)
        open=float(alpaca_bar.open),
        high=float(alpaca_bar.high),
        low=float(alpaca_bar.low),
        close=float(alpaca_bar.close),
        volume=float(alpaca_bar.volume),
    )
    current = self._bar_store.get(alpaca_bar.symbol)
    deduped = [b for b in current if b.timestamp != local_bar.timestamp]
    self._bar_store.update(alpaca_bar.symbol, (deduped + [local_bar])[-500:])
    self._last_bar_time[alpaca_bar.symbol] = local_bar.timestamp
```

**Note:** The handler signature for `subscribe_bars` is `async def handler(bar: Union[Bar, Dict])`. With `raw_data=False` (default), the handler receives a typed `Bar` object.

### StockDataStream Initialization (using `_run_forever`)

```python
# Source: alpaca-py issue #476 workaround
from alpaca.data.live import StockDataStream
from alpaca.data.enums import DataFeed

stream = StockDataStream(
    api_key=api_key,
    secret_key=secret_key,
    feed=DataFeed.IEX,    # free tier / paper account
)
stream.subscribe_bars(self._on_bar, "SPY", "AAPL")   # variadic symbols
task = asyncio.create_task(stream._run_forever())
```

### Historical Bars Request (1-minute, 200 bars)

```python
# Source: Alpaca community forum (forum.alpaca.markets/t/5min-stock-bar-example-for-alpaca-py-in-case-you-want-to-see-it/12864)
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from datetime import datetime, timedelta, timezone

client = StockHistoricalDataClient(api_key=api_key, secret_key=secret_key)

request = StockBarsRequest(
    symbol_or_symbols="SPY",
    timeframe=TimeFrame(1, TimeFrameUnit.Minute),
    start=datetime.now(timezone.utc) - timedelta(days=5),
    end=datetime.now(timezone.utc),
    limit=200,
    feed="iex",
)

bar_set = await asyncio.to_thread(lambda: client.get_stock_bars(request))
alpaca_bars = bar_set.get("SPY", [])   # BarSet is dict-like keyed by symbol
```

### Exponential Backoff in Outer Run Loop

```python
# Pattern: BinanceFeed (backend/data/binance_feed.py) adapted for Alpaca
BASE_BACKOFF = 5
MAX_BACKOFF = 60

async def run(self) -> None:
    backoff = BASE_BACKOFF
    while True:
        try:
            stream = StockDataStream(...)
            stream.subscribe_bars(self._on_bar, *self.symbols)
            await asyncio.create_task(stream._run_forever())
            backoff = BASE_BACKOFF   # reset on clean disconnection
        except asyncio.CancelledError:
            stream.stop()
            raise
        except Exception as exc:
            logger.error("AlpacaFeed error: %s — retrying in %ds", exc, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, MAX_BACKOFF)
```

### Environment Variables / Config

```python
# backend/config.py — add to existing Settings class
class Settings(BaseSettings):
    # ... existing fields ...
    ALPACA_API_KEY: str = ""
    ALPACA_SECRET_KEY: str = ""
    ALPACA_DATA_FEED: str = "iex"   # "iex" for free/paper, "sip" for paid

settings = Settings()
```

```bash
# .env additions
ALPACA_API_KEY=your_paper_api_key_here
ALPACA_SECRET_KEY=your_paper_secret_key_here
ALPACA_DATA_FEED=iex
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| yfinance 60s polling | Alpaca WebSocket push | Phase 4 (now) | Bar latency drops from ~60s to ~2s after minute close |
| Full DataFrame replace on each poll | Append-only with 500-bar cap | Phase 1 (BinanceFeed) | Strategy engine always has warm EMA history |
| Startup with empty BarStore | REST backfill 200 bars on startup | Phase 4 (now) | Signal state visible within 2 min of cold start |

**Deprecated after Phase 4:**
- `yfinance_feed.py` `poll_yfinance_loop()`: No longer wired in lifespan. File kept but unused. Can be removed in a future cleanup phase.
- `yfinance>=0.2.50` requirement: Can be removed from `requirements.txt` once `alpaca_feed.py` is the sole stock data source.

---

## Open Questions

1. **BarSet.get() vs dict access**
   - What we know: `StockHistoricalDataClient.get_stock_bars()` returns a `BarSet` which is described as "dict-like"
   - What's unclear: Whether `.get(symbol, [])` works correctly when `symbol_or_symbols` was a string (not list)
   - Recommendation: Use `bar_set.data.get(symbol, [])` as the safe form. Alternatively access `bar_set[symbol]` inside a try/except KeyError. Add a unit test that mocks the BarSet response.

2. **_run_forever() cancel propagation**
   - What we know: STATE.md notes that `asyncio.Task.cancel()` interaction with alpaca-py WebSocket teardown is undocumented
   - What's unclear: Whether the old stream fully closes before garbage collection when `AlpacaFeed.run()` task is cancelled on lifespan shutdown
   - Recommendation: Call `stream.stop()` explicitly in the `except asyncio.CancelledError` block before re-raising. This is a Phase 6 concern for dynamic restarts; for Phase 4's static startup/shutdown path it is low risk.

3. **IEX bar timing outside market hours**
   - What we know: IEX only emits bars when trades occur (market hours)
   - What's unclear: Whether subscribing to bars outside market hours causes an error or simply silence
   - Recommendation: No error expected — stream will just not emit bars outside 09:30–16:00 ET. The existing watchdog at 3 minutes will NOT fire outside market hours (design intent: stale alert only during active session). May require a market-hours guard in the watchdog check (same as yfinance_feed's `_apply_market_hours_filter`).

---

## Sources

### Primary (HIGH confidence)
- alpaca-py GitHub `alpaca/data/live/stock.py` — StockDataStream class methods confirmed
- alpaca-py GitHub `alpaca/data/models/bars.py` — Bar model fields: timestamp, open, high, low, close, volume, symbol, vwap, trade_count
- alpaca-py GitHub `alpaca/data/live/websocket.py` — `_run_forever()` vs `run()` distinction confirmed
- PyPI `alpaca-py` index — latest version 0.43.2, published 2025-11-04

### Secondary (MEDIUM confidence)
- [alpaca-py issue #476](https://github.com/alpacahq/alpaca-py/issues/476) — `run()` raises RuntimeError in existing event loop; `_run_forever()` workaround confirmed by maintainer
- [alpaca-py issue #491](https://github.com/alpacahq/alpaca-py/issues/491) — `subscribe_bars()` hang bug on live connection confirmed
- [Alpaca Community Forum: 5-min bar example](https://forum.alpaca.markets/t/5min-stock-bar-example-for-alpaca-py-in-case-you-want-to-see-it/12864) — `TimeFrame(1, TimeFrameUnit.Minute)` confirmed working pattern
- [Alpaca Market Data API docs](https://docs.alpaca.markets/docs/real-time-stock-pricing-data) — bar message fields (T, S, o, h, l, c, v, vw, n, t), feed types (IEX/SIP), minute bar timing
- [Alpaca Market Data FAQ](https://docs.alpaca.markets/docs/market-data-faq) — IEX for free/paper accounts; SIP requires paid plan; 200 REST calls/min free tier limit
- `backend/data/binance_feed.py` (project codebase) — reference implementation for injectable BarStore + outer/inner loop pattern

### Tertiary (LOW confidence)
- BarSet `.get(symbol, [])` vs `.data[symbol]` access method — inferred from "dict-like" description; not explicitly confirmed in official docs. Flag for validation in Wave 0 test.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — alpaca-py 0.43.2 confirmed on PyPI; `_run_forever()` workaround confirmed by maintainer in issue tracker
- Architecture: HIGH — directly modelled on existing BinanceFeed with confirmed workarounds from STATE.md decisions
- Pitfalls: HIGH — all 6 pitfalls sourced from official issue tracker, official docs, or existing project decisions in STATE.md

**Research date:** 2026-03-21
**Valid until:** 2026-06-21 (alpaca-py 0.x moves fast; re-verify if >0.50.0 available before planning)
