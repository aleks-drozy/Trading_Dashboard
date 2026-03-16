# Phase 2: Live Signal Dashboard + Paper Trading - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Backend WebSocket broadcaster + React frontend (login page + live dashboard) + paper trading engine. Delivers: real-time IFVG/CISD/EMA signal state for all watchlist symbols updating at 1-minute bar cadence, plus automatic paper trade placement and P&L tracking. Charts, backtest, and candlestick overlays are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Dashboard layout
- Signal table: one row per watchlist asset — columns: Symbol | IFVG | CISD | EMA condition | (last-updated timestamp)
- Asset rows are read-only in Phase 2 — no click action (charts arrive in Phase 3)
- NY session status shown in the page header/top bar as a single indicator for the whole dashboard (not per-row)

### Signal state presentation
- IFVG state: colored text pill — Bullish (green), Bearish (red), None (grey), Expired (orange)
- CISD state: colored text pill — Bullish (green), Bearish (red)
- EMA condition: colored pill — ↑ Above (green) / ↓ Below (red)
- No combined Long/Short/No Signal column in Phase 2 — that is explicitly v2 scope (SIG-V2-01)

### Paper trading engine rules
- Max 1 trade per day per asset — if a trade already fired for a symbol today, ignore new signals for the rest of the session (matches PineScript strategy)
- Trade auto-closes when price reaches target (1.5R) or stop on a subsequent bar — fully automatic, no user action required
- Entry: open of the bar after the signal fires (next-bar entry, matching Pine logic)

### Paper trading persistence
- Accept ephemeral SQLite — trades are stored in the SQLite file on the Render container filesystem; data is lost on container restart
- This is acceptable for Phase 2 demo purposes; persistence upgrade is deferred to Phase 3 or later
- Starting balance: $100,000 — hardcoded for Phase 2

### Portfolio & trades display
- Single-page layout: header (NY session status) → signal table → portfolio value section → closed trades table
- Portfolio value shows: starting balance ($100,000) + cumulative closed trade P&L
- Closed trades table columns: Symbol | Direction | Entry Price | Exit Price | Stop | Target | P&L ($) | Win/Loss

### Login page
- Simple email + password form (no OAuth)
- JWT stored in localStorage (decided in Phase 1) — 8-hour token expiry covers full trading day
- On successful login, redirect to dashboard

### Claude's Discretion
- React component structure and file layout
- CSS/styling approach (Tailwind, CSS modules, or plain CSS)
- Exact color hex values for signal pills (as long as green/red/grey/orange semantic is respected)
- WebSocket connection management on the frontend (reconnect strategy)
- Exact database schema for paper trades table
- Position sizing logic (fixed dollar amount per trade vs. percentage of balance) — use fixed $1,000 risk per trade unless specified otherwise

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Strategy specification
- `docs/reference/FYP_BOT_1_3.pine` — PineScript v6 source: entry condition (lines 508–509), session filter (NY 9:30–10:30 AM ET), max 1 trade per day, stop/target calculation (swing high/low + 1.5R), next-bar entry. This is the strict specification — any ambiguity in Python logic is resolved here.

### Requirements
- `.planning/REQUIREMENTS.md` — Phase 2 requirements: SIG-01 through SIG-05, ASSET-03, PAPER-01 through PAPER-03. These are the acceptance criteria.
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and phase boundary definition.

### Prior phase context
- `.planning/phases/01-foundation-strategy-engine/01-CONTEXT.md` — Phase 1 locked decisions: JWT/auth setup, SQLite repository pattern, library choices (PyJWT, pandas-ta), strategy engine interface (StrategyResult dataclass).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/strategy/engine.py` — `StrategyEngine.run(df)` returns `StrategyResult(ifvg_state, cisd_state, ema_condition, ema_value, bar_index)` — WebSocket broadcaster calls this per bar close per symbol
- `backend/data/bar_store.py` — stores latest bars per symbol; WebSocket broadcaster reads from here
- `backend/data/binance_feed.py` + `yfinance_feed.py` — already running as background tasks in `main.py`; WebSocket broadcaster hooks into their bar-close events
- `backend/watchlist/repository.py` — `WatchlistRepository.get_all()` — broadcaster reads watchlist to know which symbols to track

### Established Patterns
- Repository pattern (thin class wrapping SQLite via SQLModel) — paper trades table must follow same pattern
- `main.py` lifespan — new background tasks (WebSocket manager, paper trading engine) follow existing pattern of `asyncio.create_task()` in lifespan
- JWT auth: `backend/auth/router.py` + `backend/dependencies.py` — frontend auth pattern to follow
- FastAPI router per domain — WebSocket endpoint lives in a new `backend/signals/router.py` or similar

### Integration Points
- `main.py` lifespan → add WebSocket connection manager and paper trading engine as background tasks
- `StrategyEngine.run()` called per bar close per symbol → result broadcast to WebSocket clients
- SQLite DB → new `paper_trades` table → paper trading repository → paper trading engine
- React frontend → WebSocket connection → live signal state updates

</code_context>

<specifics>
## Specific Ideas

- Signal table should update without a page refresh — WebSocket pushes new state per bar close
- The NY session filter is 9:30–10:30 AM ET, weekdays only — the session indicator shows this clearly
- Paper trades auto-fire; there is no manual trade entry in Phase 2 (that's v2 scope per PAPER-V2-01)

</specifics>

<deferred>
## Deferred Ideas

- Combined Long/Short/No Signal column — explicitly v2 (SIG-V2-01)
- Manual paper trade entry (one-click long/short) — v2 (PAPER-V2-01)
- Open positions panel with live unrealised P&L — v2 (PAPER-V2-02)
- Browser notifications on signal fire — v2 (NOTIF-V2-01)
- Render Persistent Disk for SQLite — deferred past Phase 2; acceptable to be ephemeral for demo

</deferred>

---

*Phase: 02-live-signal-dashboard-paper-trading*
*Context gathered: 2026-03-16*
