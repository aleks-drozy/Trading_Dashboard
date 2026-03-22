# Phase 1: Project Foundation & Auth - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Working Next.js 14 app with complete authentication (email/password + Google OAuth), protected routes, landing page, and dev tooling configured. Specifically: project scaffolded, MongoDB connected, NextAuth v5 configured for both providers, login/register/forgot-password/reset-password pages built, root middleware protecting all dashboard and API routes, and a polished landing page live.

</domain>

<decisions>
## Implementation Decisions

### Auth Form UX
- **D-01:** Post-login redirect → `/dashboard`
- **D-02:** Post-registration → auto-logged in, redirect to `/dashboard` (no separate login step)
- **D-03:** Form validation: inline, on blur — error appears under each field when user leaves it
- **D-04:** Google OAuth button appears **above** the email/password form, separated by an "or continue with email" divider

### Password Reset Flow
- **D-05:** Email provider: **Resend** (`npm install resend`) — API key stored in `.env.local` as `RESEND_API_KEY`
- **D-06:** Reset link opens `/reset-password?token=...` — a page with "new password" + "confirm password" fields
- **D-07:** Reset tokens stored in MongoDB in a `PasswordReset` collection: `{ email, token, expiresAt, used }` — one-time use, expires in 1 hour
- **D-08:** Forgot-password page at `/forgot-password` — user enters email, receives reset link, sees a generic success message regardless of whether email exists (no account enumeration)

### Landing Page
- **D-09:** Sections: **Nav bar** + **Hero** + **Features section** (no footer for v1)
- **D-10:** Complexity: **polished from Phase 1** — not deferred to Phase 5. Invest in quality now.
- **D-11:** Hero direction: trader-focused, serious — "Track every trade. Improve every week." tone. Claude writes actual copy.
- **D-12:** Nav bar: logo left, "Login" and "Get Started" buttons right
- **D-13:** Features section: 3–4 feature cards matching the app's core value props (trade logging, analytics, dark UI built for traders)

### Pre-commit Hooks (Husky + lint-staged)
- **D-14:** Pre-commit runs: ESLint (lint-staged, staged files only) + Prettier (auto-format, `prettier --write` via lint-staged) + TypeScript type-check (`tsc --noEmit`) + Vitest unit tests
- **D-15:** Prettier: **auto-format** — files are formatted automatically on commit, never fail for formatting
- **D-16:** lint-staged config targets: `**/*.{ts,tsx}` for ESLint + Prettier; `tsc --noEmit` runs globally (not per-file)

### Claude's Discretion
- Exact hero copy and feature card text
- Loading states and spinner design on auth forms
- Exact Husky + lint-staged configuration syntax
- Error message wording on auth pages

</decisions>

<specifics>
## Specific Ideas

- Password reset: show generic "If that email exists, you'll receive a reset link" — no account enumeration
- Google button above email form with a horizontal divider (matching modern auth patterns like Vercel, Linear)
- Landing page is polished dark terminal from day one — not a placeholder

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design spec (primary reference)
- `docs/superpowers/specs/2026-03-22-trading-journal-design.md` — Full tech stack, file structure, data models, API routes, visual design spec, env var list

### Planning artifacts
- `.planning/REQUIREMENTS.md` — AUTH-01 through AUTH-05, UI-05, INFRA-04, INFRA-05 (phase 1 requirements)
- `.planning/ROADMAP.md` — Phase 1 goal and plan breakdown

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — project not yet scaffolded

### Established Patterns
- None yet — Phase 1 establishes the patterns all other phases follow

### Integration Points
- `middleware.ts` (root level) — must protect `/(dashboard)/*` and `/api/*` except `/api/auth/*`
- `lib/auth.ts` — NextAuth v5 config consumed by middleware and API routes
- `lib/db.ts` — MongoDB singleton used by all API routes and the PasswordReset model

</code_context>

<deferred>
## Deferred Ideas

- Footer — can be added in Phase 5 (UI Polish)
- Email verification on registration — out of scope for v1
- Magic link login — deferred, using password reset flow instead

</deferred>

---

*Phase: 01-project-foundation-auth*
*Context gathered: 2026-03-22*
