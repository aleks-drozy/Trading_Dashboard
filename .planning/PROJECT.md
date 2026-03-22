# Trade Journal

## What This Is

A multi-user SaaS trading journal app where traders log trades across all asset classes (stocks, crypto, forex, options), attach chart screenshots, tag strategies, write post-trade reflections, and track performance analytics over time. Built for serious retail traders who want a single place to record, review, and improve their trading.

## Core Value

A trader can log a trade in under a minute and immediately see how it affects their overall performance — win rate, P&L, and R:R — with no manual spreadsheet work.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. -->

**Auth**
- [ ] User can sign up with email and password
- [ ] User can sign in with Google OAuth
- [ ] User session persists across browser refresh
- [ ] User can reset password via email

**Trades**
- [ ] User can log a trade (symbol, asset class, direction, entry/exit, quantity, dates)
- [ ] User can attach a chart screenshot to a trade
- [ ] User can add notes/reflection to a trade
- [ ] User can tag trades with free-form strategy and tags
- [ ] User can edit and delete their trades
- [ ] P&L, pnlPercent, and R:R are auto-calculated on save
- [ ] Options trades support strike price, expiration, contract type, premium

**Trade Log**
- [ ] User can view paginated list of their trades (20 per page)
- [ ] User can filter trades by asset class, direction, status, strategy, tags, date range
- [ ] User can sort trades by date, P&L, symbol
- [ ] Filter dropdowns are populated from user's existing strategies and tags

**Dashboard / Analytics**
- [ ] Dashboard shows total P&L, win rate %, avg R:R, profit factor
- [ ] Dashboard shows best/worst trade, current win/loss streak
- [ ] P&L over time chart with daily/weekly/monthly toggle
- [ ] Asset class breakdown chart (P&L and trade count)

**UI / UX**
- [ ] Dark terminal theme (near-black bg, green accents for profit, red for loss)
- [ ] Monospace font for prices and numbers
- [ ] App is responsive (desktop-first, usable on tablet)

### Out of Scope

- TradingView chart embedding — complexity vs. value tradeoff, image upload covers the need
- Broker API integrations — requires per-broker auth/API work, v2+
- Mobile native app — web-first, mobile later
- Social features (trade sharing) — out of scope for v1
- Subscription/payments — not needed until user base established
- Forex counter-currency conversion — user is responsible for position sizing units

## Context

- Spec: `docs/superpowers/specs/2026-03-22-trading-journal-design.md`
- Stack: Next.js 14 (App Router), TypeScript, NextAuth v5, MongoDB + Mongoose, Cloudinary, Tailwind CSS, Recharts, Vercel
- Auth: email/password (credentials) + Google OAuth via NextAuth v5
- File storage: server-side Cloudinary upload via `/api/upload`
- Testing: Vitest (unit + integration with mongodb-memory-server), Playwright (E2E)
- Visual style: dark terminal — `#0f0f0f` bg, `#1a1a1a` cards, `#00ff88` green accents, `#ef4444` red for losses
- Developer: solo project, building for portfolio and personal use

## Constraints

- **Tech Stack**: Next.js 14 + TypeScript + MongoDB — already decided, drives all implementation choices
- **Auth**: NextAuth v5 only — no rolling custom JWT logic
- **Uploads**: Server-side Cloudinary only — no direct client-side unsigned uploads
- **Deployment**: Vercel + MongoDB Atlas — free tier constraints apply

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js monolith (no separate API) | Fastest to ship, one deployment, no CORS | — Pending |
| MongoDB over PostgreSQL | Flexible schema for multi-asset-class trades | — Pending |
| P&L stored on save (not computed on read) | Fast analytics queries, no re-computation | — Pending |
| Notes on Trade model (no JournalEntry table) | Simplifies data model for v1 | — Pending |
| Server-side Cloudinary upload | Keeps API keys off the client | — Pending |
| Status derived from exitPrice+exitDate presence | Single source of truth, enforced by Zod | — Pending |

---
*Last updated: 2026-03-22 after initial brainstorming and spec review*
