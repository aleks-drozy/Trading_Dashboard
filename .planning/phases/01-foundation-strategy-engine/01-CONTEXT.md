# Phase 1: Foundation + Strategy Engine - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Python backend only. FastAPI scaffold, JWT auth (backend endpoint), SQLite data layer, yfinance + Binance WebSocket data feeds, validated Python strategy engine (IFVG/CISD/20-EMA), and watchlist CRUD API. No React UI in this phase — auth and watchlist are tested via API/curl. Phase is complete when the strategy engine produces bar-by-bar output that matches TradingView reference data.

</domain>

<decisions>
## Implementation Decisions

### PineScript source
- `FYP_BOT_1_3.pine` is available locally — must be committed to `docs/reference/` as **Task 1** before any strategy engine work begins
- Pine source is the **strict specification** — any ambiguity in Python logic is resolved by reading the Pine source, not by the researcher's interpretation
- No creative interpretation of strategy rules is permitted

### TradingView validation
- Reference data: export OHLCV + indicator states CSV from TradingView (timestamp, open, high, low, close, volume, IFVG state, CISD state, EMA value per bar)
- CSV covers at least one US stock symbol and one crypto symbol, minimum 2 weeks of 1-minute bars
- CSV lives in `tests/fixtures/`
- Planner must include a task to export this CSV as a prerequisite before strategy engine tests are written

### Watchlist persistence
- SQLite (not in-memory, not JSON file)
- Abstracted behind a **repository layer** (thin repository class per model — keeps routes clean, consistent with Phase 2 paper trades)
- Database is seeded with defaults: **SPY** (stock) + **BTCUSDT** (crypto)

### Auth credentials
- Single user: `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (bcrypt) stored in `.env`
- **No users table** — credentials are env vars, not database rows
- JWT access token expiry: **8 hours** (covers a full trading day including NY session)
- Token stored in **localStorage** on the frontend (persists across browser refresh — satisfies AUTH-02)
- Phase 1 delivers backend `/auth/login` endpoint only — no React login page (that's Phase 2)

### Libraries (pre-build decisions)
- JWT: **PyJWT 2.8+** (NOT python-jose — abandoned library)
- Technical indicators: **pandas-ta** (NOT TA-Lib — C binary unreliable on Render)

### Lookahead bias guardrail
- Strategy engine must only process **closed bars** (`df.iloc[:-1]`)
- Unit tests must confirm no lookahead bias before Phase 2 begins

### Claude's Discretion
- FastAPI project structure and directory layout
- SQLite schema design (tables, column names)
- Exact bcrypt rounds for password hashing
- Error handling and HTTP status codes for auth failures
- Binance WebSocket reconnection implementation details (beyond the 23-hour proactive schedule)
- yfinance polling interval and retry logic

</decisions>

<specifics>
## Specific Ideas

- PineScript file path: `docs/reference/FYP_BOT_1_3.pine`
- TradingView CSV fixture path: `tests/fixtures/` (e.g., `spy_1min_tv_reference.csv`, `btcusdt_1min_tv_reference.csv`)
- Default watchlist seed: `SPY`, `BTCUSDT`
- JWT expiry: 8 hours
- Auth env vars: `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — fresh codebase

### Established Patterns
- None yet — Phase 1 establishes all patterns

### Integration Points
- `docs/reference/FYP_BOT_1_3.pine` → strategy engine reads this as specification
- `tests/fixtures/*.csv` → strategy engine tests load these as reference truth
- SQLite DB → watchlist repository → FastAPI routes (Phase 2 will extend same DB for paper trades)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-strategy-engine*
*Context gathered: 2026-03-16*
