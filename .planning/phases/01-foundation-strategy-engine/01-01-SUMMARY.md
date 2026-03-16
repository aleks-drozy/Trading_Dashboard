---
phase: 01-foundation-strategy-engine
plan: "01"
subsystem: auth
tags: [fastapi, pydantic-settings, sqlmodel, sqlite, jwt, pyjwt, bcrypt, uvicorn]

# Dependency graph
requires: []
provides:
  - FastAPI application with lifespan context manager
  - pydantic-settings BaseSettings loading .env with lru_cache
  - Lazy SQLite engine via SQLModel (trading.db)
  - get_session() dependency injection for database access
  - JWT auth: verify_password, create_access_token, decode_token (PyJWT HS256)
  - POST /auth/login (OAuth2PasswordRequestForm) and POST /auth/logout
  - get_current_user Depends(OAuth2PasswordBearer) for protecting routes
  - pytest conftest with in-memory SQLite test session and TestClient fixture
  - Placeholder GET /watchlist protected route
affects:
  - 01-02-watchlist (needs get_session, get_current_user, SQLModel engine)
  - 01-03-data-feeds (needs app structure, get_current_user)
  - 01-04-strategy-engine (needs project structure, conftest patterns)

# Tech tracking
tech-stack:
  added:
    - FastAPI 0.115+
    - uvicorn[standard] 0.30+
    - SQLModel 0.0.21+ (SQLAlchemy 2.x)
    - PyJWT 2.12.1 (NOT python-jose)
    - bcrypt 4.2+
    - pydantic-settings 2.0+
    - python-multipart (OAuth2PasswordRequestForm)
    - pytest 8+, pytest-asyncio, httpx (test stack)
  patterns:
    - Lazy engine creation via get_engine() — avoids import-time env validation
    - lru_cache on get_settings() for singleton settings object
    - Stateless JWT auth (no server-side token store); logout is client-side
    - OAuth2PasswordRequestForm for /auth/login (form-encoded, not JSON)
    - monkeypatch.setattr per-module for settings override in tests
    - rounds=4 bcrypt in tests for speed, rounds=12 in production

key-files:
  created:
    - backend/main.py
    - backend/config.py
    - backend/database.py
    - backend/dependencies.py
    - backend/auth/__init__.py
    - backend/auth/router.py
    - backend/auth/service.py
    - backend/watchlist/__init__.py
    - backend/watchlist/router.py
    - backend/data/__init__.py
    - backend/strategy/__init__.py
    - tests/__init__.py
    - tests/conftest.py
    - tests/test_auth.py
    - requirements.txt
    - .env.example
    - tests/fixtures/.gitkeep
    - docs/reference/.gitkeep
  modified: []

key-decisions:
  - "PyJWT 2.12.1 used — python-jose is abandoned and NOT used anywhere"
  - "Lazy SQLite engine via get_engine() — avoids ValidationError on import without .env"
  - "algorithms=['HS256'] passed explicitly to jwt.decode (security requirement)"
  - "Single-user auth via env vars (ADMIN_EMAIL + ADMIN_PASSWORD_HASH) — no users table"
  - "JWT expiry = 8 hours (full NY trading session)"
  - "Watchlist placeholder route registered in main.py so protected-route tests work"

patterns-established:
  - "Lazy dependency pattern: engine created on first call, not at module import"
  - "Test override via monkeypatch.setattr per module — lru_cache not cleared, function replaced"
  - "conftest.py: StaticPool in-memory SQLite engine + dependency_overrides[get_session]"
  - "No passlib or python-jose — use bcrypt and PyJWT directly"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 1 Plan 01: FastAPI Scaffold + JWT Auth Summary

**FastAPI app with pydantic-settings config, lazy SQLite via SQLModel, and PyJWT HS256 auth delivering /auth/login and /auth/logout with 8/8 test cases passing**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-16T21:36:46Z
- **Completed:** 2026-03-16T21:41:00Z
- **Tasks:** 2 of 2
- **Files modified:** 18

## Accomplishments

- FastAPI app scaffold with full directory tree (backend, tests, docs/reference)
- JWT auth layer: verify_password, create_access_token, decode_token using PyJWT (no python-jose)
- POST /auth/login (form-encoded OAuth2PasswordRequestForm) and POST /auth/logout endpoints
- get_current_user OAuth2 dependency protecting routes with Bearer token validation
- All 8 auth test cases pass: login success/failure, protected route access, logout, expired/tampered tokens

## Task Commits

Each task was committed atomically:

1. **Task 1: Project scaffold, config, and database** - `12b9b73` (feat)
2. **Task 2: Auth service and endpoints with tests** - `19af9b9` (feat)

**Plan metadata:** (docs commit — added in final step)

_Note: Task 2 used TDD. Tests written first (RED — all failed), then implementation made them pass (GREEN)._

## Files Created/Modified

- `backend/main.py` - FastAPI app with lifespan, auth + watchlist routers registered
- `backend/config.py` - pydantic-settings BaseSettings with lru_cache, loads .env
- `backend/database.py` - Lazy SQLite engine via get_engine(), create_db_and_tables(), get_session()
- `backend/dependencies.py` - get_current_user using OAuth2PasswordBearer + decode_token
- `backend/auth/service.py` - verify_password, create_access_token, decode_token (PyJWT HS256)
- `backend/auth/router.py` - POST /auth/login and POST /auth/logout
- `backend/watchlist/router.py` - Placeholder GET /watchlist protected by get_current_user
- `tests/conftest.py` - StaticPool in-memory test DB, session and client fixtures
- `tests/test_auth.py` - 8 auth tests with settings override via monkeypatch
- `requirements.txt` - Pinned versions per research spec
- `.env.example` - All required env vars with bcrypt generation command

## Decisions Made

- Used lazy engine creation (`get_engine()`) instead of module-level `engine = create_engine(...)` — avoids `ValidationError` when importing without a `.env` file present (discovered during verification run)
- `algorithms=["HS256"]` passed explicitly to `jwt.decode` as required by research anti-patterns spec
- Test settings override uses `monkeypatch.setattr` per module, not `lru_cache.cache_clear` — after monkeypatch, the replaced function is a plain lambda, not an lru_cache object
- Added placeholder `GET /watchlist` route in plan 01-01 so Test 4 (protected route returns 401 without token) has a route to hit; without it, FastAPI returns 404 before auth is checked

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Lazy engine creation to fix import-time ValidationError**
- **Found during:** Task 1 verification
- **Issue:** `database.py` called `get_settings()` at module level; importing the module without `.env` raised `pydantic_core.ValidationError` (3 missing fields)
- **Fix:** Replaced module-level `engine = create_engine(...)` with `get_engine()` helper that lazily creates the engine on first call
- **Files modified:** `backend/database.py`
- **Verification:** `python -c "from backend.config import get_settings; from backend.database import create_db_and_tables; print('scaffold ok')"` passes without `.env`
- **Committed in:** `12b9b73` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Added placeholder watchlist route for auth test**
- **Found during:** Task 2 TDD GREEN phase
- **Issue:** Test 4 (`test_protected_route_no_token`) asserts GET /watchlist returns 401. Without the route, FastAPI returns 404 before auth middleware runs, causing test failure
- **Fix:** Created `backend/watchlist/router.py` with `GET ""` (maps to `/watchlist`) protected by `get_current_user`, registered in `main.py`
- **Files modified:** `backend/watchlist/router.py`, `backend/main.py`
- **Verification:** All 8 tests pass
- **Committed in:** `19af9b9` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes necessary for correctness. The watchlist router stub is required by plan 01-02 anyway — adding it here is zero scope creep.

## Issues Encountered

- Windows pip install fails with `WinError 2` when overwriting `.exe` scripts in `C:\Python312\Scripts\`. Workaround: `python -m pip install --isolated <package>` skips script installation and installs library files successfully. All packages are importable. This is a pre-existing environment issue, not caused by this plan.

## User Setup Required

Before running the app, create a `.env` file from `.env.example`:

```bash
# Generate bcrypt hash
python -c "import bcrypt; print(bcrypt.hashpw(b'yourpassword', bcrypt.gensalt(rounds=12)).decode())"

# Create .env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=<paste hash here>
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
DATABASE_URL=sqlite:///./trading.db
```

Then start the server: `uvicorn backend.main:app --reload`

## Next Phase Readiness

- Plan 01-02 (watchlist CRUD) can begin immediately: `get_session`, `get_current_user`, SQLModel engine, and the watchlist router stub are all in place
- PineScript source (`docs/reference/FYP_BOT_1_3.pine`) still needs to be committed before strategy engine plans
- TradingView CSV fixtures still needed before strategy engine tests

---
*Phase: 01-foundation-strategy-engine*
*Completed: 2026-03-16*

## Self-Check: PASSED

- All 11 key files found on disk
- Task commits 12b9b73 and 19af9b9 confirmed in git log
