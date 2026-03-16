---
phase: 01-foundation-strategy-engine
plan: "02"
subsystem: watchlist
tags: [fastapi, sqlmodel, sqlite, repository-pattern, jwt-auth, seeding]

# Dependency graph
requires:
  - 01-01 (get_session, get_current_user, SQLModel engine, conftest fixtures)
provides:
  - WatchlistSymbol SQLModel table model with unique symbol constraint
  - WatchlistRepository: get_all(), add() (uppercases symbol), remove()
  - GET /watchlist — returns list of symbols, JWT required
  - POST /watchlist — adds symbol, 201 on success, 409 on duplicate
  - DELETE /watchlist/{symbol} — removes symbol, 200 on success, 404 if missing
  - seed_defaults() seeds SPY (stock) + BTCUSDT (crypto) on empty watchlist at startup
affects:
  - 01-03-data-feeds (watchlist drives which symbols feeds track)
  - 01-04-strategy-engine (watchlist drives which symbols strategy evaluates)
  - Phase 2 paper trades (repository pattern established here is the template)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Repository pattern: WatchlistRepository(session) injected per route handler
    - Catch IntegrityError at router layer, translate to HTTPException(409)
    - seed_defaults() called in lifespan after create_db_and_tables — idempotent (checks get_all())
    - TDD used for both tasks: RED commit before GREEN implementation

key-files:
  created:
    - backend/watchlist/models.py
    - backend/watchlist/repository.py
    - tests/test_watchlist.py
  modified:
    - backend/watchlist/router.py (replaced placeholder with full CRUD)
    - backend/main.py (added seed_defaults, updated lifespan)

key-decisions:
  - "IntegrityError caught at router layer (not repository) — repository stays thin, router owns HTTP semantics"
  - "seed_defaults() is idempotent — checks get_all() before seeding, safe to call on every startup"
  - "symbol stored as .upper() in repository.add() — ensures case-insensitive uniqueness"

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 1 Plan 02: Watchlist CRUD API Summary

**SQLModel WatchlistSymbol model, WatchlistRepository (get_all/add/remove), and JWT-protected GET/POST/DELETE /watchlist endpoints with SPY+BTCUSDT seed on empty startup — all 13 tests pass**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-16T21:25:21Z
- **Completed:** 2026-03-16T21:27:00Z
- **Tasks:** 2 of 2
- **Files modified:** 5

## Accomplishments

- WatchlistSymbol SQLModel table: id, symbol (unique, indexed), asset_type
- WatchlistRepository with get_all(), add() (auto-uppercases), remove() (returns bool)
- Full CRUD API: GET/POST/DELETE /watchlist all require valid JWT
- POST returns 201 with created object; duplicate symbol raises 409
- DELETE returns 200 on success, 404 when symbol not found
- seed_defaults() seeds SPY + BTCUSDT on first startup (idempotent)
- All 21 tests pass (8 auth + 6 repository + 7 API)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing repository tests** - `3f71591` (test)
2. **Task 1 GREEN: WatchlistSymbol model and WatchlistRepository** - `bddfdd9` (feat)
3. **Task 2 GREEN: Watchlist router, seed, and full API** - `9deeb9b` (feat)

_Note: Both tasks used TDD. RED (failing tests) committed before GREEN (implementation)._

## Files Created/Modified

- `backend/watchlist/models.py` - WatchlistSymbol SQLModel with unique symbol constraint
- `backend/watchlist/repository.py` - WatchlistRepository: get_all, add (uppercases), remove (returns bool)
- `backend/watchlist/router.py` - Full GET/POST/DELETE endpoints with JWT auth and IntegrityError→409
- `backend/main.py` - seed_defaults() + updated lifespan to seed after table creation
- `tests/test_watchlist.py` - 6 repository tests + 7 API tests (13 total)

## Decisions Made

- IntegrityError caught at the router layer, not in the repository — the repository stays a thin data layer; HTTP error semantics belong to the router
- seed_defaults() calls get_all() before seeding — idempotent and safe on every restart
- symbol.upper() applied in repository.add() — case-insensitive uniqueness without requiring a DB-level collation change

## Deviations from Plan

None — plan executed exactly as written.

## Next Phase Readiness

- Plan 01-03 (data feeds) can begin: the watchlist GET endpoint provides the symbol list that feeds will consume
- PineScript source (`docs/reference/FYP_BOT_1_3.pine`) still needs to be committed before strategy engine plans
- TradingView CSV fixtures still needed before strategy engine tests

---
*Phase: 01-foundation-strategy-engine*
*Completed: 2026-03-16*

## Self-Check: PASSED

- All 5 key files found on disk
- Task commits 3f71591, bddfdd9, and 9deeb9b confirmed in git log
