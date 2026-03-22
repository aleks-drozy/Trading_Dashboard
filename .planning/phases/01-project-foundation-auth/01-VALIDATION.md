---
phase: 1
slug: project-foundation-auth
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-22
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (Wave 0 installs) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFRA-04 | build | `npm run build 2>&1 | tail -5` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | INFRA-05 | unit | `npx vitest run lib/db` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | AUTH-01,AUTH-02 | integration | `npx vitest run __tests__/auth/credentials` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | AUTH-03 | integration | `npx vitest run __tests__/auth/google` | ❌ W0 | ⬜ pending |
| 1-05-01 | 05 | 2 | AUTH-04,UI-05 | e2e-manual | see manual | — | ⬜ pending |
| 1-06-01 | 06 | 2 | AUTH-05 | integration | `npx vitest run __tests__/middleware` | ❌ W0 | ⬜ pending |
| 1-07-01 | 07 | 3 | UI-05 | build | `npm run build 2>&1 | tail -5` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest.config.ts` — vitest config pointing at `__tests__/`
- [ ] `__tests__/auth/credentials.test.ts` — stubs for AUTH-01, AUTH-02
- [ ] `__tests__/auth/google.test.ts` — stubs for AUTH-03
- [ ] `__tests__/middleware.test.ts` — stubs for AUTH-05
- [ ] `__tests__/lib/db.test.ts` — stubs for INFRA-05
- [ ] `npm install -D vitest @vitejs/plugin-react` — if not present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Login/register pages dark terminal theme | UI-05 | Visual design | Open /login, /register in browser; confirm dark bg, monospace font, terminal styling |
| Google OAuth full flow | AUTH-03 | Requires live Google credentials | Sign in with Google, confirm redirect back and session created |
| Password reset email received | AUTH-04 | Requires Resend API + real email | Trigger forgot-password, confirm email arrives, click link, reset succeeds |
| Stay logged in after refresh | AUTH-01 | Session persistence | Sign in, hard-refresh browser, confirm session persists |
| Blocked from /dashboard unauthenticated | AUTH-05 | Middleware redirect | Navigate to /dashboard when logged out, confirm redirect to /login |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
