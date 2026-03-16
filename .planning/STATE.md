# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-16)

**Core value:** Open the dashboard during the NY session and instantly see whether IFVG + CISD + EMA conditions align for a trade — without TradingView open.
**Current focus:** Phase 1 — Foundation + Strategy Engine

## Current Position

Phase: 1 of 3 (Foundation + Strategy Engine)
Plan: 0 of TBD in current phase
Status: Ready to plan
Last activity: 2026-03-16 — Roadmap created, phase structure defined

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Pre-build]: Do NOT use `python-jose` — abandoned, use PyJWT 2.8+ instead
- [Pre-build]: Do NOT use TA-Lib — C binary compilation unreliable on Render; use pandas-ta (pure Python)
- [Pre-build]: Strategy engine must be validated bar-by-bar against TradingView output BEFORE any UI or WebSocket work begins
- [Pre-build]: SQLite persistence decision needed before Phase 2 — three options: accept ephemeral, add export endpoint, or add Render Persistent Disk ($1/month)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1 — critical]: PineScript source (`FYP_BOT_1_3.pine`) must be read line-by-line to extract exact IFVG expiry condition, CISD structure-flip definition, and bar-indexing boundaries before any strategy engine code is written. Treat Pine source as specification.
- [Phase 1 — critical]: Lookahead bias risk — strategy must only run on closed bars (`df.iloc[:-1]`); unit tests must confirm this before Phase 2 begins.

## Session Continuity

Last session: 2026-03-16
Stopped at: Roadmap created — ready to plan Phase 1
Resume file: None
