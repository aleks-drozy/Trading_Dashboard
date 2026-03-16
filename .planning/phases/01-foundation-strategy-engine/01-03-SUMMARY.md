---
phase: 01-foundation-strategy-engine
plan: "03"
subsystem: data-feeds
tags: [yfinance, python-binance, asyncio, websocket, bar-store, background-tasks, fastapi-lifespan]

# Dependency graph
requires:
  - phase: 01-foundation-strategy-engine/01-01
    provides: FastAPI app, lifespan context manager, SQLModel engine, WatchlistRepository

provides:
  - Thread-safe in-memory BarStore (symbol -> list[Bar]) with module-level singleton
  - fetch_closed_bars() async helper: yfinance 1-min bars, open-bar drop, market-hours filter, recency check
  - poll_yfinance_loop() asyncio background task with callable watchlist_getter
  - BinanceFeed class with _on_closed_bar, _check_watchdog, async run() with 23-hour proactive restart
  - binance_feed module-level singleton
  - Lifespan wired: both feed tasks created on startup, cancelled with gather on shutdown
  - 13 unit tests covering BarStore, yfinance fetch, BinanceFeed, lifespan wiring

affects:
  - 01-05-strategy-engine (imports bar_store singleton for live bar data)
  - 01-04-strategy-engine (needs Bar dataclass for test fixtures)

# Tech tracking
tech-stack:
  added:
    - yfinance>=0.2.50 (already in requirements.txt — installed during this plan)
    - python-binance==1.0.35 (already in requirements.txt — installed during this plan)
    - aiohttp (transitive dep for python-binance, installed with --isolated)
    - dateparser (transitive dep for python-binance, installed with --isolated)
  patterns:
    - Injectable bar_store in BinanceFeed constructor — enables unit testing without module-level state
    - Patchable helper functions (_apply_market_hours_filter, _is_stale) for time-sensitive unit tests
    - Watchlist getter as Callable[[], list[str]] — reads current DB state on each poll, not a snapshot
    - Proactive 23-hour reconnect outer loop (vs reactive reconnect on disconnect)
    - asyncio.to_thread() for blocking yfinance calls — keeps event loop unblocked
    - Lifespan pattern: create_task at startup, cancel + await gather(return_exceptions=True) at shutdown

key-files:
  created:
    - backend/data/bar_store.py
    - backend/data/yfinance_feed.py
    - backend/data/binance_feed.py
    - tests/test_data_feeds.py
  modified:
    - backend/main.py

key-decisions:
  - "BinanceFeed accepts injectable bar_store parameter (defaults to module singleton) to enable isolated unit tests"
  - "Market-hours filter and recency check extracted as _apply_market_hours_filter/_is_stale helpers for test patchability"
  - "Lifespan tests patch create_db_and_tables, seed_defaults, Session, get_engine to avoid .env dependency"
  - "Binance feed caps stored bars at 500 per symbol to bound memory usage"
  - "poll_yfinance_loop sleeps 1s between symbols (rate limit guard) then interval_s after full pass"

patterns-established:
  - "Injectable store pattern: pass bar_store=... to BinanceFeed for test isolation without monkeypatching globals"
  - "Patchable helpers: extract time/filter logic into named module-level functions for clean patch targets"
  - "Lifespan test pattern: patch create_db_and_tables + Session + get_engine to prevent settings ValidationError"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04]

# Metrics
duration: 9min
completed: 2026-03-16
---

# Phase 1 Plan 03: Data Feeds Summary

**Thread-safe BarStore singleton, yfinance 1-min poller with open-bar drop and market-hours filter, and Binance WebSocket feed with proactive 23-hour reconnect — all wired into FastAPI lifespan with 13 passing unit tests**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-03-16T21:25:32Z
- **Completed:** 2026-03-16T21:34:44Z
- **Tasks:** 2 of 2
- **Files modified:** 5

## Accomplishments

- BarStore: thread-safe dict[symbol, list[Bar]] with Lock, module-level singleton importable by strategy engine
- yfinance feed: fetch_closed_bars() drops open bar, filters 09:30-16:00 ET, checks 90s recency; poll_yfinance_loop() is a callable-getter background loop
- BinanceFeed: _on_closed_bar processes closed klines into BarStore (capped at 500 bars), _check_watchdog logs error after 3 min silence, run() outer loop reconnects proactively at 23h
- Lifespan: both feed tasks started with asyncio.create_task, gracefully cancelled on shutdown with gather(return_exceptions=True)
- 13 unit tests: all pass without network access (yfinance mocked, BinanceFeed methods tested in isolation)

## Task Commits

Each task was committed atomically:

1. **RED phase (failing tests)** - `3855cfb` (test)
2. **Task 1: BarStore and yfinance poller** - `1acf709` (feat)
3. **Task 2: BinanceFeed WebSocket and lifespan wiring** - `238550e` (feat)

_Note: Both tasks used TDD. Tests written first (RED — all failed), then implementation made them pass (GREEN)._

## Files Created/Modified

- `backend/data/bar_store.py` - Thread-safe BarStore with Bar dataclass, module-level singleton
- `backend/data/yfinance_feed.py` - fetch_closed_bars() + poll_yfinance_loop(), patchable filter helpers
- `backend/data/binance_feed.py` - BinanceFeed class with injectable store, watchdog, 23h reconnect outer loop
- `backend/main.py` - Lifespan extended with feed task creation and graceful cancellation
- `tests/test_data_feeds.py` - 13 tests covering all feed behaviors without network calls

## Decisions Made

- **Injectable BarStore:** BinanceFeed constructor accepts `bar_store=None` defaulting to module singleton — allows test isolation without patching global state
- **Patchable helpers:** `_apply_market_hours_filter` and `_is_stale` extracted as named module functions so tests can patch them cleanly without needing to mock datetime internals
- **Lifespan test isolation:** Tests for lifespan wiring patch `create_db_and_tables`, `seed_defaults`, `Session`, and `get_engine` to prevent pydantic Settings ValidationError when .env is absent
- **500-bar cap:** Binance feed keeps last 500 bars per symbol via `(current + [bar])[-500:]` — bounded memory with no extra config

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Extracted patchable filter helpers for test time-independence**
- **Found during:** Task 1 verification
- **Issue:** Test 3 (open-bar drop) fails when run outside NY market hours (14:30-21:00 UTC) because the market-hours filter removes all bars. Tests must be time-independent.
- **Fix:** Extracted `_apply_market_hours_filter()` and `_is_stale()` as named module-level functions. Tests can patch these cleanly instead of trying to mock `datetime.now` inside the function.
- **Files modified:** `backend/data/yfinance_feed.py`, `tests/test_data_feeds.py`
- **Committed in:** `1acf709` (Task 1 feat commit)

**2. [Rule 3 - Blocking] Lifespan test environment isolation**
- **Found during:** Task 2 verification
- **Issue:** Lifespan tests triggered `pydantic_core.ValidationError` because `create_db_and_tables()` and `get_engine()` inside the lifespan call `get_settings()`, which requires `.env` file with 3 mandatory fields.
- **Fix:** Added patches for `create_db_and_tables`, `seed_defaults`, `Session`, and `get_engine` in both lifespan tests.
- **Files modified:** `tests/test_data_feeds.py`
- **Committed in:** `238550e` (Task 2 feat commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both fixes required for correct test behavior. No functional scope creep.

## Issues Encountered

- Windows pip `WinError 2` on `.exe` script installation — same pre-existing environment issue as Plan 01. Workaround: `pip install --isolated` installs library files without scripts. All packages are importable. Not caused by this plan.
- `python-binance==1.0.35` requires `aiohttp` and `dateparser` as transitive deps not declared in requirements.txt — installed separately with `--isolated` flag.

## User Setup Required

None — data feeds start automatically on lifespan startup. No additional environment variables required (Binance feed uses unauthenticated public WebSocket for kline data).

## Next Phase Readiness

- `bar_store` singleton is importable: `from backend.data.bar_store import bar_store`
- `Bar` dataclass available for strategy engine test fixtures
- Both feeds start automatically in lifespan — no manual wiring needed in Plan 04 or 05
- Plan 04 (strategy engine) can begin immediately

---
*Phase: 01-foundation-strategy-engine*
*Completed: 2026-03-16*

## Self-Check: PASSED

- All 6 key files found on disk (bar_store.py, yfinance_feed.py, binance_feed.py, main.py, test_data_feeds.py, SUMMARY.md)
- Task commits 3855cfb, 1acf709, and 238550e confirmed in git log
- 34/34 tests pass (8 auth + 13 data feeds + 13 watchlist)
