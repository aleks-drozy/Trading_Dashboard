---
phase: 3
slug: trade-log-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npx vitest run --passWithNoTests` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --passWithNoTests`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green + manual smoke test (add trade → view list → edit → delete)
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 3-xx-xx | varies | 1+ | TRADE-10 | unit | `npx vitest run __tests__/lib/calculations.test.ts` | ✅ | ⬜ pending |
| 3-xx-xx | varies | 1+ | LOG-01 | manual | N/A — paginated list + URL navigation | N/A | ⬜ pending |
| 3-xx-xx | varies | 1+ | LOG-02 | manual | N/A — filter → URL params → refetch | N/A | ⬜ pending |
| 3-xx-xx | varies | 1+ | LOG-03 | manual | N/A — sort controls + order change | N/A | ⬜ pending |
| 3-xx-xx | varies | 1+ | LOG-04 | manual | N/A — dropdowns from /api/trades/meta | N/A | ⬜ pending |
| 3-xx-xx | varies | 1+ | LOG-05 | manual | N/A — visual UI row display | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — existing test infrastructure covers the one automatable requirement (TRADE-10 via `__tests__/lib/calculations.test.ts`). UI component tests are Phase 6 scope.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Paginated list renders 20 trades, page controls change URL | LOG-01 | Server component + URL navigation | Load /trades, verify rows, click next page, check URL param changes |
| Each filter updates URL params and refetches | LOG-02 | Requires browser interaction | Apply asset class, direction, status filters; verify URL updates and list refreshes |
| Sort by entry date/P&L/symbol changes order | LOG-03 | Requires browser interaction | Click column headers; verify ascending/descending sort order |
| Strategy/tag dropdowns populate from /api/trades/meta | LOG-04 | Requires live API | Open filter bar; verify strategy/tag options match data in DB |
| Trade row displays symbol, asset class, direction, entry date, P&L, status | LOG-05 | Visual UI verification | Add test trade, verify all fields display correctly in list row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
