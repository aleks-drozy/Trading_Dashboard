---
phase: 04-alpaca-real-time-feed
plan: 01
subsystem: api
tags: [alpaca-py, websocket, bar-store, backfill, tdd, python]

requires:
  - phase: 01-foundation-strategy-engine
    provides: BarStore class with injectable pattern (bar_store.py, binance_feed.py reference)
  - phase: 02-live-signal-dashboard-paper-trading
    provides: FastAPI lifespan pattern for background task wiring

provides:
  - AlpacaFeed class with _on_bar (dedup + 500-cap), _check_watchdog, run() (exponential backoff)
  - backfill_bars async function (REST via asyncio.to_thread, 5-day lookback, 200 bars)
  - Alpaca config settings (alpaca_api_key, alpaca_secret_key, alpaca_data_feed) in Settings
  - alpaca-py>=0.40.0,<0.50.0 dependency

affects:
  - 04-02 (lifespan wiring: replace poll_yfinance_loop with AlpacaFeed.run() + backfill_bars)
  - 06-watchlist-ui (stream cancel+restart pattern uses AlpacaFeed)

tech-stack:
  added:
    - alpaca-py>=0.40.0,<0.50.0 (StockDataStream, StockHistoricalDataClient)
  patterns:
    - Injectable BarStore for test isolation (same as BinanceFeed)
    - asyncio.create_task(stream._run_forever()) to avoid RuntimeError in FastAPI event loop
    - Timestamp deduplication in _on_bar: deduped = [b for b in current if b.timestamp != local_bar.timestamp]
    - asyncio.to_thread for blocking StockHistoricalDataClient REST call
    - bar_set.data.get(symbol, []) for safe BarSet access (handles single-symbol vs list request)

key-files:
  created:
    - backend/data/alpaca_feed.py
  modified:
    - backend/config.py
    - requirements.txt
    - tests/test_data_feeds.py

key-decisions:
  - "alpaca-py _run_forever() workaround: asyncio.create_task(stream._run_forever()) avoids RuntimeError in FastAPI event loop (issue #476)"
  - "bar_set.data.get(symbol, []) preferred over bar_set.get() — safe for both string and list symbol_or_symbols"
  - "Exponential backoff: 5s base, doubles to 60s max — identical cap to what research recommended"
  - "backfill feed parameter hardcoded as string 'iex' in StockBarsRequest (DataFeed enum not accepted there)"

patterns-established:
  - "AlpacaFeed mirrors BinanceFeed: injectable BarStore, outer retry loop, watchdog, _on_bar converter"
  - "TDD: tests 13-20 written and committed before implementation (RED → GREEN)"

requirements-completed: [DATA-05, DATA-06, DATA-07]

duration: 3min
completed: 2026-03-21
---

# Phase 04 Plan 01: AlpacaFeed Class + Backfill Summary

**AlpacaFeed WebSocket class with exponential backoff, timestamp deduplication, 500-bar cap, and backfill_bars REST seeding via asyncio.to_thread — 8 unit tests (TDD)**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-21T17:08:16Z
- **Completed:** 2026-03-21T17:11:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- AlpacaFeed class with injectable BarStore, _on_bar (dedup + 500-cap), _check_watchdog (3-min ERROR), run() (exponential backoff 5s→60s) using asyncio.create_task(stream._run_forever())
- backfill_bars function: blocking StockHistoricalDataClient wrapped in asyncio.to_thread, 5-day lookback, 200-bar limit, bar_set.data.get(symbol, []) safe access
- Alpaca settings (alpaca_api_key, alpaca_secret_key, alpaca_data_feed) added to Settings with safe defaults — app starts without them
- 8 passing unit tests 13-20 using TDD (RED committed before GREEN)

## Task Commits

1. **Task 1: Add Alpaca config settings and alpaca-py dependency** - `11f0d6c` (chore)
2. **Task 2 RED: Failing tests 13-20** - `8d063ce` (test)
3. **Task 2 GREEN: AlpacaFeed implementation** - `7d1cfb6` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `backend/data/alpaca_feed.py` - AlpacaFeed class + backfill_bars function (162 lines)
- `backend/config.py` - Added alpaca_api_key, alpaca_secret_key, alpaca_data_feed to Settings
- `requirements.txt` - Added alpaca-py>=0.40.0,<0.50.0 (yfinance kept until Plan 02 confirmed unused)
- `tests/test_data_feeds.py` - Added TestAlpacaFeed class with tests 13-20 (222 lines)

## Decisions Made

- `asyncio.create_task(stream._run_forever())` instead of `stream.run()` — avoids RuntimeError in FastAPI's already-running event loop (alpaca-py issue #476, documented in STATE.md)
- `bar_set.data.get(symbol, [])` for BarSet access — research Open Question 1 flagged `.get()` might not work for single-symbol requests; `.data.get()` is the safe form
- Backoff doubles on each failure: 5 → 10 → 20 → 40 → 60 → 60 (min with MAX_BACKOFF_SECONDS cap)
- Feed parameter in StockBarsRequest passed as string `"iex"` not DataFeed enum (REST client accepts string form)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

**Pre-existing test failure (out of scope):** `TestLifespanFeedWiring::test_lifespan_creates_three_tasks` (Test 11) was already failing before Plan 04-01. It expects 3 tasks but lifespan creates 2 by default (Binance feed is opt-in). This will be resolved in Plan 04-02 when main.py is rewired to use AlpacaFeed. Logged to `deferred-items.md`.

## Next Phase Readiness

- AlpacaFeed and backfill_bars are fully implemented and tested — ready for Plan 04-02 lifespan wiring
- Plan 04-02 needs to: import AlpacaFeed + backfill_bars in main.py, replace poll_yfinance_loop with alpaca_feed.run(), add backfill_bars call before stream task creation
- Test 11 needs updating in Plan 04-02 to reflect new task count

---
*Phase: 04-alpaca-real-time-feed*
*Completed: 2026-03-21*
