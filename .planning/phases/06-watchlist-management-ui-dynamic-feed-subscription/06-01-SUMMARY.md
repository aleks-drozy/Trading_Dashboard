---
phase: 06-watchlist-management-ui-dynamic-feed-subscription
plan: 01
subsystem: api
tags: [alpaca, asyncio, websocket, bar-store, watchlist, fastapi]

# Dependency graph
requires:
  - phase: 04-alpaca-real-time-feed
    provides: AlpacaFeed class, backfill_bars function, BarStore singleton
provides:
  - BarStore.remove(symbol) method for clearing stale bars on symbol deletion
  - Module-level feed_restart_event asyncio.Event singleton in alpaca_feed.py
  - AlpacaFeed dynamic symbol reload via get_symbols callable on each restart
  - AlpacaFeed asyncio.wait FIRST_COMPLETED race between stream task and restart event
  - Watchlist router async def handlers that trigger feed_restart_event.set()
  - main.py wired with get_stock_symbols callable and feed_restart_event passed to AlpacaFeed
affects:
  - 06-02 (frontend watchlist sidebar calls the wired REST API and feed reacts dynamically)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - asyncio.wait FIRST_COMPLETED to race a long-running stream task vs an event trigger
    - Module-level asyncio.Event singleton for cross-module signalling (mirrors bar_store pattern)
    - Callable injection (get_symbols) into AlpacaFeed to decouple from startup-time snapshot
    - async def FastAPI routes for asyncio.Event thread-safety (event.set() must be in event loop)

key-files:
  created: []
  modified:
    - backend/data/bar_store.py
    - backend/data/alpaca_feed.py
    - backend/watchlist/router.py
    - backend/main.py

key-decisions:
  - "Watchlist router converted to async def — asyncio.Event.set() from sync thread-pool routes silently fails to wake event.wait() waiters (Python asyncio thread-safety rule)"
  - "feed_restart_event as module-level singleton in alpaca_feed.py — mirrors existing bar_store, broadcaster, paper_engine pattern; avoids app.state dependency injection complexity"
  - "get_symbols callable injected into AlpacaFeed constructor — decouples feed from startup-time symbol snapshot; symbols refreshed fresh on every restart iteration"
  - "1s sleep after stream.stop() before new stream construction — teardown safety margin per RESEARCH Pitfall 2 to avoid 406 too-many-connections from Alpaca"
  - "feed_restart_event.set() only for asset_type==stock in add handler — crypto goes through BinanceFeed, not AlpacaFeed"

patterns-established:
  - "asyncio.wait FIRST_COMPLETED pattern for cancellable long-running tasks: race stream vs event, cancel pending, stop stream, clear event, branch on which finished"
  - "Callable injection for dynamic config: pass get_symbols: Callable[[], list[str]] instead of symbols: list[str] to AlpacaFeed"

requirements-completed: [ASSET-06]

# Metrics
duration: 3min
completed: 2026-03-21
---

# Phase 6 Plan 01: Dynamic Feed Subscription Backend Summary

**AlpacaFeed now restarts within 30 seconds of watchlist changes via asyncio.Event race, reads symbols fresh from DB on each restart, backfills new symbols, and removes bars for deleted ones**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-21T21:17:34Z
- **Completed:** 2026-03-21T21:20:22Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- BarStore gains a thread-safe `remove(symbol)` method using `dict.pop` under the existing `_lock`
- AlpacaFeed refactored with `get_symbols` callable + `restart_event` parameters; `run()` races stream task vs restart event using `asyncio.wait(FIRST_COMPLETED)`, diffs old vs new symbol sets to backfill additions and remove deletions
- Watchlist router endpoints converted to `async def` and wired to call `feed_restart_event.set()` after stock symbol mutations; `main.py` passes `get_stock_symbols` callable and `feed_restart_event` to AlpacaFeed constructor

## Task Commits

Each task was committed atomically:

1. **Task 1: Add BarStore.remove() and refactor AlpacaFeed for dynamic symbols with restart event** - `63a2e54` (feat)
2. **Task 2: Wire watchlist router to trigger feed restart and update lifespan** - `ccf651b` (feat)

## Files Created/Modified

- `backend/data/bar_store.py` - Added `remove(symbol)` method after `get()`, before `symbols()`
- `backend/data/alpaca_feed.py` - Added `feed_restart_event` singleton, `get_symbols`/`restart_event` params, rewrote `run()` with FIRST_COMPLETED race, added `_wait_for_restart()` helper
- `backend/watchlist/router.py` - Converted all handlers to `async def`, imported `feed_restart_event` and `bar_store`, wired `feed_restart_event.set()` on add (stock only) and remove
- `backend/main.py` - Added `feed_restart_event` to AlpacaFeed import, renamed `get_watchlist_symbols` to `get_stock_symbols` (filters USDT inline), passed callable and event to AlpacaFeed constructor

## Decisions Made

- **async def routes**: asyncio.Event.set() called from sync FastAPI route handlers (which run in a thread pool) does not wake event.wait() waiters in the event loop. Converting to async def ensures the call happens in the event loop thread.
- **Module-level singleton for feed_restart_event**: Consistent with existing patterns (bar_store, broadcaster). No app.state or Depends() indirection needed.
- **get_symbols callable over static list**: AlpacaFeed now reads the DB on each restart iteration rather than using the startup-time snapshot. This is the minimal change to enable dynamic watchlist without a full architecture change.
- **1s sleep after stream.stop()**: RESEARCH.md Pitfall 2 documents that alpaca-py WebSocket teardown timing is undocumented. The sleep gives the underlying WebSocket close handshake time to complete before the new StockDataStream is constructed, avoiding 406 errors.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend dynamic feed subscription fully wired and verified
- Plan 02 (WatchlistSidebar frontend component) can now call existing REST endpoints; feed will restart within 30 seconds of any stock symbol add/remove
- No blockers for Plan 02 execution

## Self-Check: PASSED

All created/modified files verified present. Both task commits confirmed in git history.

---
*Phase: 06-watchlist-management-ui-dynamic-feed-subscription*
*Completed: 2026-03-21*
