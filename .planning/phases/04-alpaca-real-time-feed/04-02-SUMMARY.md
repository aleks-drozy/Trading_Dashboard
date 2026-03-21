---
phase: 04-alpaca-real-time-feed
plan: "02"
subsystem: api
tags: [fastapi, lifespan, alpaca, websocket, backfill, asyncio]

requires:
  - phase: 04-01-alpaca-real-time-feed
    provides: AlpacaFeed class, backfill_bars function, updated Settings with alpaca keys

provides:
  - FastAPI lifespan wired to AlpacaFeed.run() instead of poll_yfinance_loop
  - backfill_bars awaited before AlpacaFeed stream starts
  - Lifespan tests 11-12 updated for AlpacaFeed + backfill_bars mocking

affects:
  - Phase 05 (multi-timeframe charts) — lifespan structure is now final
  - Phase 06 (watchlist sidebar) — dynamic stream restart depends on this lifespan structure

tech-stack:
  added: []
  patterns:
    - "backfill-then-stream: backfill_bars awaited before asyncio.create_task(alpaca_feed.run()) to guarantee historical data before live feed"
    - "Guard by key: both backfill and AlpacaFeed.run() are guarded by settings.alpaca_api_key being non-empty"

key-files:
  created: []
  modified:
    - backend/main.py
    - tests/test_data_feeds.py

key-decisions:
  - "backfill_bars is awaited (not tasked) before the stream starts — ensures BarStore has historical data before live bars arrive"
  - "AlpacaFeed.run() task creation guarded by settings.alpaca_api_key — app runs without Alpaca configured (no crash)"
  - "Lifespan tests mock get_settings + backfill_bars as AsyncMock to avoid real Alpaca API calls"

patterns-established:
  - "backfill-before-stream: REST historical data seeded synchronously in lifespan before WebSocket task starts"
  - "API-key guard: Alpaca tasks only started when alpaca_api_key is non-empty"

requirements-completed: [DATA-05, DATA-06, DATA-07]

duration: 2min
completed: "2026-03-21"
---

# Phase 04 Plan 02: Lifespan Wiring Summary

**FastAPI lifespan rewired to await backfill_bars then start AlpacaFeed.run() as an asyncio task, replacing poll_yfinance_loop — with lifespan tests updated for the new AlpacaFeed + backfill_bars mock structure.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-21T17:14:14Z
- **Completed:** 2026-03-21T17:16:39Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Removed `poll_yfinance_loop` from lifespan and from `backend/main.py` imports entirely
- Added `AlpacaFeed`, `backfill_bars`, `bar_store`, and `get_settings` imports to `backend/main.py`
- Lifespan now awaits `backfill_bars` (guarded by `alpaca_api_key` + non-empty stock symbols) before starting the stream
- `AlpacaFeed.run()` started as `asyncio.create_task` (guarded by `alpaca_api_key`)
- Updated tests 11-12 in `TestLifespanFeedWiring` to mock `get_settings`, `backfill_bars`, `WatchlistRepository` — all 21 tests pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire lifespan to use AlpacaFeed instead of yfinance** - `bcc3531` (feat)
2. **Task 2: Update lifespan wiring tests (tests 11-12) for AlpacaFeed** - `39b4ea2` (test)

## Files Created/Modified

- `backend/main.py` — Removed yfinance import/task; added AlpacaFeed, backfill_bars, bar_store, get_settings; rewrote lifespan body
- `tests/test_data_feeds.py` — Added `os` import; updated `TestLifespanFeedWiring` tests 11-12 with helper methods and new mocks

## Decisions Made

- `backfill_bars` is awaited (not tasked) before the stream starts — ensures BarStore has historical data before live bars arrive
- AlpacaFeed task creation guarded by `settings.alpaca_api_key` — app runs without Alpaca configured (no crash on startup)
- Lifespan tests mock `get_settings` + `backfill_bars` as `AsyncMock` to avoid real Alpaca API calls and keep tests fast

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for this plan. Alpaca keys are already configured via `.env` from Plan 01.

## Next Phase Readiness

- Phase 04 is now complete: AlpacaFeed is built (Plan 01) and wired into the lifespan (Plan 02)
- Phase 05 (multi-timeframe charts) can begin immediately
- Phase 06 (watchlist sidebar) can also proceed — the lifespan structure is stable for stream restart logic

---
*Phase: 04-alpaca-real-time-feed*
*Completed: 2026-03-21*
