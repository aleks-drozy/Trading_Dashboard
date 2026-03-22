---
phase: 2
slug: trade-data-layer-crud-api
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.9 |
| **Config file** | `vitest.config.ts` (exists) |
| **Quick run command** | `npm test` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | TRADE-01 | unit | `npm test -- __tests__/lib/calculations.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 1 | TRADE-02 | unit | `npm test -- __tests__/schemas/trade.test.ts` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 1 | TRADE-04 | unit | `npm test -- __tests__/schemas/trade.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 1 | TRADE-03 | unit | `npm test -- __tests__/lib/calculations.test.ts` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 1 | TRADE-08 | unit | `npm test -- __tests__/lib/calculations.test.ts` | ❌ W0 | ⬜ pending |
| 2-04-01 | 04 | 2 | TRADE-05 | manual | verify via curl/REST client | N/A | ⬜ pending |
| 2-04-02 | 04 | 2 | TRADE-06 | manual | verify via curl/REST client | N/A | ⬜ pending |
| 2-05-01 | 05 | 2 | TRADE-09 | manual | verify via curl/REST client | N/A | ⬜ pending |
| 2-06-01 | 06 | 2 | TRADE-07 | unit | `npm test -- __tests__/api/upload.test.ts` | ❌ W0 | ⬜ pending |
| 2-07-01 | 07 | 2 | INFRA-05 | manual | inspect .env.example | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/` directory — does not exist; must be created
- [ ] `__tests__/lib/calculations.test.ts` — stubs for TRADE-01, TRADE-03, TRADE-08
- [ ] `__tests__/schemas/trade.test.ts` — stubs for TRADE-02, TRADE-04
- [ ] `__tests__/api/upload.test.ts` — stubs for TRADE-07 (size + MIME validation)

*No framework install needed — Vitest 2.1.9 already in devDependencies and configured.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| strategy + tags stored and returned | TRADE-05 | Requires live DB + auth | POST trade with strategy/tags, GET /api/trades, verify fields present |
| notes stored and returned | TRADE-06 | Requires live DB + auth | POST trade with notes, GET /api/trades/[id], verify notes present |
| DELETE removes trade and returns 204 | TRADE-09 | Requires live DB + auth | POST trade, DELETE /api/trades/[id], verify 204 + subsequent GET returns 404 |
| Cloudinary vars in .env.example | INFRA-05 | File inspection | Check .env.example for CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
