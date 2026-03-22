# Roadmap: Trade Journal

**Created:** 2026-03-22
**Granularity:** Fine
**Goal:** Ship a production-ready multi-user SaaS trading journal with full trade logging, analytics, and dark terminal UI.

---

## Phase 1 — Project Foundation & Auth

**Goal:** Working Next.js app with complete authentication (email/password + Google OAuth), protected routes, landing page, and dev tooling configured.

**Requirements covered:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, UI-05, INFRA-04, INFRA-05

**Plans:** 2/5 plans executed

Plans:
- [x] 01-01-PLAN.md — Scaffold Next.js 16, install deps, configure dev tooling (Husky, Prettier, Vitest, .env.example)
- [ ] 01-02-PLAN.md — MongoDB connection, User + PasswordReset models, Zod schemas, NextAuth v5 config
- [ ] 01-03-PLAN.md — Shared UI components, login + register pages, registration API, proxy.ts route protection
- [ ] 01-04-PLAN.md — Password reset flow (forgot-password + reset-password pages and APIs, Resend email)
- [x] 01-05-PLAN.md — Landing page (Navbar, Hero, Features section)

**Done when:** User can register, sign in (email or Google), stay logged in after refresh, request a password reset, and is blocked from dashboard routes when not authenticated.

---

## Phase 2 — Trade Data Layer & CRUD API

**Goal:** Complete Trade model, Zod schemas, calculation logic, and full CRUD API for trades including image upload.

**Requirements covered:** TRADE-01 through TRADE-09, INFRA-05 (env vars for Cloudinary)

**Plans:**
1. Define Trade Mongoose model with all fields (including options-specific fields)
2. Write Zod schemas for trade create/update and auth (schemas/trade.ts, schemas/auth.ts)
3. Implement P&L, pnlPercent, and R:R calculation functions in lib/calculations.ts (direction-aware, asset-class-aware)
4. Build GET /api/trades and POST /api/trades route handlers
5. Build GET, PUT, DELETE /api/trades/[id] route handlers
6. Build POST /api/upload route (server-side Cloudinary upload)
7. Build GET /api/trades/meta route (strategies + tags aggregation)

**Done when:** All trade CRUD endpoints work, P&L is correctly calculated and stored, images upload successfully to Cloudinary, and all routes return 401 for unauthenticated requests.

---

## Phase 3 — Trade Log UI

**Goal:** Full trade log page with add/edit trade form, filters, sorting, pagination, and live P&L preview.

**Requirements covered:** LOG-01, LOG-02, LOG-03, LOG-04, LOG-05, TRADE-10

**Plans:**
1. Build reusable UI component library (Button, Input, Card, Badge, Select, DatePicker — dark theme)
2. Build trade list page (/trades) with paginated table and status/P&L display
3. Build add trade form (/trades/new) with all fields, asset-class conditional fields, and live P&L preview
4. Build edit trade form (/trades/[id]/edit) with pre-populated fields
5. Build trade detail view (/trades/[id]) with chart image display and notes
6. Implement filter bar (asset class, direction, status, strategy, tags, date range) wired to GET /api/trades params
7. Implement sort controls and pagination UI

**Done when:** User can add, view, edit, delete trades; filter and sort the trade log; and see live P&L calculated as they type.

---

## Phase 4 — Dashboard & Analytics

**Goal:** Analytics dashboard with all performance stats, P&L chart, and asset class breakdown.

**Requirements covered:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05

**Plans:**
1. Build GET /api/stats route with MongoDB aggregation pipeline (total P&L, win rate, R:R, profit factor, streaks, best/worst)
2. Add granularity support to /api/stats (daily/weekly/monthly pnlByDate grouping)
3. Build dashboard summary cards (P&L, win rate, R:R, profit factor, best/worst trade, streaks)
4. Build P&L over time line chart (Recharts, dark-themed, granularity toggle)
5. Build asset class breakdown chart (Recharts bar/pie, dark-themed)
6. Wire dashboard page to /api/stats with loading states and empty states

**Done when:** Dashboard shows accurate stats for all closed trades, charts render correctly, granularity toggle works, and empty state is shown for new users.

---

## Phase 5 — UI Polish & Dark Terminal Theme

**Goal:** Consistent, professional dark terminal aesthetic across all pages — typography, spacing, color, animations, responsive layout.

**Requirements covered:** UI-01, UI-02, UI-03, UI-04

**Plans:**
1. Audit all pages for theme consistency — background, card surfaces, accent colors, borders
2. Apply monospace font to all price/number values across trade form, trade list, and dashboard
3. Polish chart screenshot display (lightbox/modal on trade detail page)
4. Add micro-interactions: hover states, focus rings, loading spinners, toast notifications
5. Implement responsive layout (desktop-first, usable on tablet — nav collapses, table scrolls)
6. Polish landing page — hero section, feature cards, CTA, footer

**Done when:** App looks cohesive and professional across all pages; theme is consistent; responsive on tablet; landing page is presentable.

---

## Phase 6 — Testing & Production Readiness

**Goal:** Test suite passing, app deployable to Vercel + MongoDB Atlas, production config correct.

**Requirements covered:** INFRA-01, INFRA-02, INFRA-03

**Plans:**
1. Write unit tests for calculations.ts and Zod schemas (Vitest)
2. Write integration tests for API routes using mongodb-memory-server (Vitest)
3. Write E2E test: register → log trade → view dashboard (Playwright)
4. Configure Vercel deployment (env vars, build settings, domain)
5. Configure MongoDB Atlas (production cluster, network access, connection string)
6. Final production smoke test and bug fixes

**Done when:** All tests pass, app deploys successfully to Vercel, production environment is stable.

---

## Phase Summary

| Phase | Name | Plans | Requirements |
|-------|------|-------|--------------|
| 1 | 2/5 | In Progress|  |
| 2 | Trade Data Layer & CRUD API | 7 | 9 |
| 3 | Trade Log UI | 7 | 6 |
| 4 | Dashboard & Analytics | 6 | 5 |
| 5 | UI Polish & Dark Theme | 6 | 4 |
| 6 | Testing & Production | 6 | 3 |

**Total:** 6 phases · 37 plans · 35 requirements

---
*Roadmap created: 2026-03-22*
*Last updated: 2026-03-22 after Phase 1 planning*
