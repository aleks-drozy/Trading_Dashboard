---
phase: 02-live-signal-dashboard-paper-trading
plan: 01
subsystem: api
tags: [websocket, fastapi, signals, broadcasting, jwt, zoneinfo]

requires:
  - phase: 01-foundation-strategy-engine
    provides: StrategyEngine, BarStore, WatchlistRepository, JWT auth (decode_token), bar_store singleton

provides:
  - WebSocket endpoint /ws/signals with JWT query-param authentication
  - SignalBroadcaster class that computes StrategyResult per watchlist symbol and pushes JSON payloads
  - NY session status utility (is_ny_session_active — 9:30-10:30 ET weekdays)
  - broadcaster singleton wired as asyncio background task in FastAPI lifespan

affects:
  - 02-02 (frontend WebSocket consumer — connects to /ws/signals)
  - 02-03 (paper trading — may share lifespan task pattern)

tech-stack:
  added: [zoneinfo (stdlib), fastapi WebSocket, asyncio background task]
  patterns:
    - Lazy StrategyEngine init in SignalBroadcaster.__init__ avoids pandas_ta/numba import at module load time
    - WebSocket auth via JWT query param (browsers cannot send Authorization headers on WS upgrade)
    - Broadcaster loop: compute_and_broadcast wrapped in try/except so errors never kill the loop
    - Module-level singleton pattern (broadcaster = SignalBroadcaster()) for shared state across router and lifespan

key-files:
  created:
    - backend/signals/__init__.py
    - backend/signals/session.py
    - backend/signals/broadcaster.py
    - backend/signals/router.py
    - tests/test_signals.py
  modified:
    - backend/main.py
    - tests/test_data_feeds.py

key-decisions:
  - "StrategyEngine imported lazily inside _get_engine() to avoid pandas_ta->numba->llvmlite import chain at module load — keeps test suite importable in environments where numba native libs are mismatched"
  - "WebSocket auth uses ?token= query param (not Authorization header) — browsers do not support custom headers on WebSocket upgrade"
  - "SignalBroadcaster.broadcast() silently removes dead clients rather than raising — maintains loop stability when clients disconnect mid-broadcast"
  - "Minimum 22 bars required before running strategy (20 EMA warmup + 2 for IFVG) — symbols with fewer bars are skipped with debug log"

patterns-established:
  - "Lazy import pattern for heavy native-lib dependencies in __init__ methods"
  - "asyncio.CancelledError caught in run() loops for clean lifespan shutdown"

requirements-completed: [SIG-01, SIG-02, SIG-03, SIG-04, SIG-05, ASSET-03]

duration: 7min
completed: 2026-03-20
---

# Phase 2 Plan 01: Signal Broadcasting Summary

**WebSocket /ws/signals endpoint with JWT auth, SignalBroadcaster background loop computing StrategyResult per watchlist symbol every 60s, and NY session status check (9:30-10:30 ET weekdays)**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T21:04:46Z
- **Completed:** 2026-03-20T21:11:46Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- NY session utility `is_ny_session_active()` correctly checks 9:30-10:30 ET Monday-Friday using stdlib `zoneinfo`
- `SignalBroadcaster` class manages WebSocket clients, computes StrategyResult for all watchlist symbols, and broadcasts `{"type": "signal_update", "ny_session_active": ..., "signals": [...]}` payloads
- `/ws/signals` WebSocket endpoint authenticates via `?token=<JWT>` query param, rejects invalid tokens with close code 4001
- broadcaster loop wired as `signal_task` in FastAPI lifespan alongside existing feed tasks
- 9 tests all pass; 0 regressions in 34 existing tests (43 total)

## Task Commits

1. **Task 1: NY session utility and SignalBroadcaster class** - `b630ffe` (feat)
2. **Task 2: WebSocket endpoint, lifespan wiring, and tests** - `8ec0f20` (feat)

## Files Created/Modified

- `backend/signals/__init__.py` - Empty package init
- `backend/signals/session.py` - `is_ny_session_active()` using ZoneInfo("America/New_York")
- `backend/signals/broadcaster.py` - `SignalBroadcaster` class + module-level singleton
- `backend/signals/router.py` - `@router.websocket("/ws/signals")` with JWT token query param auth
- `backend/main.py` - Added signals_router include + signal_task in lifespan
- `tests/test_signals.py` - 9 tests for session check, broadcaster, WS auth rejection
- `tests/test_data_feeds.py` - Updated lifespan task count assertions from 2 to 3

## Decisions Made

- **Lazy StrategyEngine init:** StrategyEngine imported inside `_get_engine()` not at module load — avoids pandas_ta->numba->llvmlite chain that breaks in dev env (pre-existing llvmlite 0.44/0.46 mismatch). Works correctly at runtime when actually called.
- **JWT via query param:** WebSocket auth cannot use Authorization headers in browsers; `?token=<JWT>` is the standard FastAPI WebSocket pattern.
- **Dead client removal in broadcast():** Exceptions during `ws.send_json()` silently remove the client — prevents one dead connection from breaking the entire broadcast.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Lazy StrategyEngine initialization to fix import-time crash**
- **Found during:** Task 1 verification
- **Issue:** `broadcaster = SignalBroadcaster()` at module level caused `broadcaster.py` to fail import in test suite. Chain: `StrategyEngine` -> `compute_ema` -> `pandas_ta` -> `numba` -> `llvmlite` version mismatch (0.44 installed, 0.46 required). Same error broke all strategy tests pre-existing.
- **Fix:** Removed top-level `StrategyEngine` import; added `_get_engine()` method that lazy-imports and caches the engine on first call. Module-level singleton instantiation no longer triggers the import chain.
- **Files modified:** `backend/signals/broadcaster.py`
- **Verification:** `python -c "from backend.signals.broadcaster import broadcaster"` succeeds; all 43 tests pass.
- **Committed in:** `8ec0f20` (Task 2 commit)

**2. [Rule 1 - Bug] Updated lifespan task count tests from 2 to 3**
- **Found during:** Task 2 — running full test suite after wiring signal_task in lifespan
- **Issue:** `TestLifespanFeedWiring` tests asserted `len(created_tasks) == 2` and `len(mock_tasks) == 2`. After adding `signal_task`, the actual count is 3. Tests failed with `assert 3 == 2`.
- **Fix:** Updated both lifespan tests to assert 3 tasks and updated docstrings to reflect the three tasks.
- **Files modified:** `tests/test_data_feeds.py`
- **Verification:** Both lifespan tests pass; 43 total tests pass.
- **Committed in:** `8ec0f20` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

- Pre-existing llvmlite 0.44/0.46 mismatch in the dev environment causes all strategy tests to fail with `ImportError`. This is out of scope — was present before this plan. Noted in deferred-items.md.

## Known Stubs

None — SignalBroadcaster computes real StrategyResults and broadcasts real data. No hardcoded values, no placeholder signals.

## Next Phase Readiness

- `/ws/signals` endpoint is ready for frontend consumption in plan 02-02
- Signal payload schema is locked: `{"type": "signal_update", "ny_session_active": bool, "signals": [{"symbol", "ifvg_state", "cisd_state", "ema_condition", "ema_value", "updated_at"}]}`
- Broadcaster loop is live and will process real bars once data feeds deliver sufficient history (>=22 bars per symbol)

---
*Phase: 02-live-signal-dashboard-paper-trading*
*Completed: 2026-03-20*
