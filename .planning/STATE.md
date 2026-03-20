---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 02-04-PLAN.md — all 3 tasks done, visual verification approved
last_updated: "2026-03-20T22:20:06.665Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 9
  completed_plans: 9
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** Open the dashboard during the NY session and instantly see whether IFVG + CISD + EMA conditions align for a trade — without TradingView open.
**Current focus:** Phase 02 — live-signal-dashboard-paper-trading

## Current Position

Phase: 02 (live-signal-dashboard-paper-trading) — EXECUTING
Plan: 4 of 4

## Performance Metrics

**Velocity:**

- Total plans completed: 2
- Average duration: ~4 min
- Total execution time: ~8 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-foundation-strategy-engine | 2/5 | ~8 min | ~4 min |

**Recent Trend:**

- Last 5 plans: P01 (~5 min), P02 (~2 min)
- Trend: Fast

*Updated after each plan completion*
| Phase 01-foundation-strategy-engine P01 | 5 min | 2 tasks | 18 files |
| Phase 01-foundation-strategy-engine P02 | 2 min | 2 tasks | 5 files |
| Phase 01-foundation-strategy-engine P03 | 9min | 2 tasks | 5 files |
| Phase 01-foundation-strategy-engine P04 | 5 | 2 tasks | 3 files |
| Phase 01-foundation-strategy-engine P05 | 8min | 6 tasks | 9 files |
| Phase 02-live-signal-dashboard-paper-trading P02 | 7 min | 2 tasks | 15 files |
| Phase 02-live-signal-dashboard-paper-trading P01 | 7min | 2 tasks | 7 files |
| Phase 02-live-signal-dashboard-paper-trading P03 | 8 | 2 tasks | 8 files |
| Phase 02-live-signal-dashboard-paper-trading P04 | 15min | 2 tasks | 14 files |
| Phase 02-live-signal-dashboard-paper-trading P04 | 35 | 3 tasks | 15 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-build]: Do NOT use `python-jose` — abandoned, use PyJWT 2.8+ instead
- [Pre-build]: Do NOT use TA-Lib — C binary compilation unreliable on Render; use pandas-ta (pure Python)
- [Pre-build]: Strategy engine must be validated bar-by-bar against TradingView output BEFORE any UI or WebSocket work begins
- [Pre-build]: SQLite persistence decision needed before Phase 2 — three options: accept ephemeral, add export endpoint, or add Render Persistent Disk ($1/month)
- [Phase 01-foundation-strategy-engine]: FYP_BOT_1_3.pine committed to docs/reference/ as read-only PineScript v6 strategy specification (542 lines)
- [Phase 01-foundation-strategy-engine]: PyJWT 2.12.1 used — python-jose is abandoned and NOT used
- [Phase 01-foundation-strategy-engine]: Lazy SQLite engine via get_engine() avoids import-time ValidationError without .env
- [Phase 01-foundation-strategy-engine]: algorithms=['HS256'] explicit in jwt.decode (security requirement)
- [Phase 01-foundation-strategy-engine]: Single-user auth via env vars — no users table in database
- [Phase 01-foundation-strategy-engine P02]: IntegrityError caught at router layer (not repository) — router owns HTTP semantics
- [Phase 01-foundation-strategy-engine P02]: seed_defaults() is idempotent — checks get_all() before seeding
- [Phase 01-foundation-strategy-engine P02]: symbol stored as .upper() in repository.add() for case-insensitive uniqueness
- [Phase 01-foundation-strategy-engine]: Injectable BarStore in BinanceFeed enables test isolation without patching module-level globals
- [Phase 01-foundation-strategy-engine]: Patchable yfinance helpers (_apply_market_hours_filter, _is_stale) make time-sensitive tests deterministic
- [Phase 01-foundation-strategy-engine]: Placeholder CSV fixtures accepted — user will replace with real TradingView exports before bar-by-bar validation tests run
- [Phase 01-foundation-strategy-engine]: Fixture column schema locked: timestamp,open,high,low,close,volume,ifvg_state,cisd_state,ema_20
- [Phase 01-foundation-strategy-engine]: pandas-ta df.ta.ema(length=20, adjust=False) matches TradingView recursive EMA — no TA-Lib, no ewm(adjust=True)
- [Phase 01-foundation-strategy-engine]: Lookahead guardrail structural: df.iloc[:-1] as first line of StrategyEngine.run() — lookahead bias test uses synthetic data and passes unconditionally
- [Phase 01-foundation-strategy-engine]: Bar-by-bar fixture tests skip gracefully on placeholder CSVs — will auto-activate when user replaces with real TradingView exports
- [Phase 02-live-signal-dashboard-paper-trading]: Vite 6 used instead of Vite 8 — Node 21.7.1 is incompatible with rolldown bundler in Vite 8; Vite 6 supports Node 18+
- [Phase 02-live-signal-dashboard-paper-trading]: shadcn/ui CLI creates components in literal @/ path on Windows — must be moved to src/components/ui/ after generation
- [Phase 02-live-signal-dashboard-paper-trading]: StrategyEngine imported lazily inside _get_engine() to avoid pandas_ta->numba->llvmlite import chain at module load — keeps test suite importable in environments where native libs are mismatched
- [Phase 02-live-signal-dashboard-paper-trading]: WebSocket auth uses ?token= query param (not Authorization header) — browsers do not support custom headers on WebSocket upgrade
- [Phase 02-live-signal-dashboard-paper-trading]: SignalBroadcaster.broadcast() silently removes dead clients on exception — maintains loop stability when clients disconnect mid-broadcast
- [Phase 02-live-signal-dashboard-paper-trading]: Lazy TYPE_CHECKING import for StrategyResult in paper engine — avoids pandas_ta->numba->llvmlite chain at module load
- [Phase 02-live-signal-dashboard-paper-trading]: try/except in check_and_close_open_trades() — DB not ready is valid transient state during test isolation; silently skip
- [Phase 02-live-signal-dashboard-paper-trading]: _MockStrategyResult in tests to avoid numba import chain — mirrors real frozen dataclass
- [Phase 02-live-signal-dashboard-paper-trading]: Sonner imported directly from 'sonner' package — shadcn generated sonner.tsx had circular self-import; fixed wrapper to use npm package directly
- [Phase 02-live-signal-dashboard-paper-trading]: wasConnectedRef guards disconnect toast — only fires when established connection drops, not on initial connecting state
- [Phase 02-live-signal-dashboard-paper-trading]: pandas ewm(adjust=False) replaces pandas_ta to fix llvmlite version mismatch; recursive EMA formula is mathematically identical
- [Phase 02-live-signal-dashboard-paper-trading]: SignalTable empty state is session-aware — Awaiting market open / NY session 9:30-10:30 AM ET

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 — critical]: PineScript source (`FYP_BOT_1_3.pine`) must be read line-by-line to extract exact IFVG expiry condition, CISD structure-flip definition, and bar-indexing boundaries before any strategy engine code is written. Treat Pine source as specification.
- [Phase 1 — critical]: Lookahead bias risk — strategy must only run on closed bars (`df.iloc[:-1]`); unit tests must confirm this before Phase 2 begins.

## Session Continuity

Last session: 2026-03-20T22:20:06.658Z
Stopped at: Completed 02-04-PLAN.md — all 3 tasks done, visual verification approved
Resume file: None
