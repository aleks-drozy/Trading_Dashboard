# Requirements: Trade Journal

**Defined:** 2026-03-22
**Core Value:** A trader can log a trade in under a minute and immediately see how it affects their overall performance — win rate, P&L, and R:R — with no manual spreadsheet work.

## v1 Requirements

### Authentication

- [x] **AUTH-01**: User can register with email and password (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
- [x] **AUTH-02**: User can sign in with Google OAuth
- [x] **AUTH-03**: User session persists across browser refresh
- [x] **AUTH-04**: User can request a password reset via email link
- [ ] **AUTH-05**: All dashboard and API routes are protected via NextAuth v5 middleware

### Trades

- [x] **TRADE-01**: User can create a trade with symbol, asset class, direction, entry price, quantity, and entry date
- [x] **TRADE-02**: User can close a trade by providing exit price and exit date (both required together)
- [x] **TRADE-03**: P&L, pnlPercent, and riskRewardRatio are calculated and stored on save (direction-aware formulas)
- [x] **TRADE-04**: Options trades include strike price, expiration date, contract type (call/put), and premium
- [x] **TRADE-05**: User can add a strategy label and free-form tags to a trade
- [x] **TRADE-06**: User can write notes/reflection text on a trade
- [x] **TRADE-07**: User can upload a chart screenshot image (server-side Cloudinary upload)
- [x] **TRADE-08**: User can edit any field of an existing trade
- [x] **TRADE-09**: User can delete a trade
- [ ] **TRADE-10**: Trade form shows live P&L preview as user types entry/exit price and quantity

### Trade Log

- [x] **LOG-01**: User can view a paginated list of their trades (20 per page)
- [x] **LOG-02**: User can filter trades by asset class, direction, status, strategy, tags, and date range
- [x] **LOG-03**: User can sort trades by entry date, P&L, or symbol (asc/desc)
- [x] **LOG-04**: Strategy and tag filter dropdowns are populated from the user's existing trade data (GET /api/trades/meta)
- [x] **LOG-05**: Trade list shows symbol, asset class, direction, entry date, P&L, and status at a glance

### Dashboard & Analytics

- [ ] **DASH-01**: Dashboard shows total P&L, win rate %, average R:R, and profit factor
- [ ] **DASH-02**: Dashboard shows best trade, worst trade, current win streak, and current loss streak
- [ ] **DASH-03**: P&L over time chart with daily/weekly/monthly granularity toggle
- [ ] **DASH-04**: Asset class breakdown chart showing trade count and P&L per asset class
- [ ] **DASH-05**: All stats computed from closed trades only via GET /api/stats

### UI & Design

- [ ] **UI-01**: Dark terminal theme: `#0f0f0f` background, `#1a1a1a` card surfaces, `#00ff88` green accents
- [ ] **UI-02**: Positive P&L displayed in green (`#00ff88`), negative P&L in red (`#ef4444`)
- [ ] **UI-03**: Monospace font for all price and number values
- [ ] **UI-04**: Application is desktop-first responsive (usable on tablet, not required on mobile)
- [x] **UI-05**: Landing page with feature overview and sign-up CTA

### Infrastructure & Quality

- [ ] **INFRA-01**: Unit tests cover P&L/R:R calculation functions and Zod schemas (Vitest)
- [ ] **INFRA-02**: Integration tests cover API route handlers against mongodb-memory-server (Vitest)
- [ ] **INFRA-03**: E2E test covers register → log trade → view dashboard (Playwright)
- [x] **INFRA-04**: ESLint + Prettier configured with Husky pre-commit hooks
- [x] **INFRA-05**: Environment variables documented in .env.example

## v2 Requirements

### Notifications

- **NOTF-01**: Email notification on milestone (e.g. 100 trades logged)

### Analytics

- **ANAL-01**: Monthly performance report export (PDF/CSV)
- **ANAL-02**: Trade comparison: current month vs. last month
- **ANAL-03**: Drawdown chart

### Usability

- **UX-01**: Bulk import trades from CSV
- **UX-02**: TradingView chart embed link support
- **UX-03**: Mobile-optimized layout

## Out of Scope

| Feature | Reason |
|---------|--------|
| Broker API integrations | Per-broker auth complexity, v2+ |
| Mobile native app | Web-first, mobile later |
| Social/sharing features | Out of scope for v1 |
| Subscription/payments | Not needed until user base established |
| Forex currency conversion | User responsible for position sizing units |
| TradingView embed | Image upload covers the need for v1 |
| Direct client-side Cloudinary upload | Security — keeps API keys server-side |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Complete |
| AUTH-02 | Phase 1 | Complete |
| AUTH-03 | Phase 1 | Complete |
| AUTH-04 | Phase 1 | Complete |
| AUTH-05 | Phase 1 | Pending |
| UI-05 | Phase 1 | Complete |
| INFRA-04 | Phase 1 | Complete |
| INFRA-05 | Phase 1 | Complete |
| TRADE-01 | Phase 2 | Complete |
| TRADE-02 | Phase 2 | Complete |
| TRADE-03 | Phase 2 | Complete |
| TRADE-04 | Phase 2 | Complete |
| TRADE-05 | Phase 2 | Complete |
| TRADE-06 | Phase 2 | Complete |
| TRADE-07 | Phase 2 | Complete |
| TRADE-08 | Phase 2 | Complete |
| TRADE-09 | Phase 2 | Complete |
| TRADE-10 | Phase 2 | Pending |
| LOG-01 | Phase 3 | Complete |
| LOG-02 | Phase 3 | Complete |
| LOG-03 | Phase 3 | Complete |
| LOG-04 | Phase 3 | Complete |
| LOG-05 | Phase 3 | Complete |
| DASH-01 | Phase 4 | Pending |
| DASH-02 | Phase 4 | Pending |
| DASH-03 | Phase 4 | Pending |
| DASH-04 | Phase 4 | Pending |
| DASH-05 | Phase 4 | Pending |
| UI-01 | Phase 5 | Pending |
| UI-02 | Phase 5 | Pending |
| UI-03 | Phase 5 | Pending |
| UI-04 | Phase 5 | Pending |
| INFRA-01 | Phase 6 | Pending |
| INFRA-02 | Phase 6 | Pending |
| INFRA-03 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 33 total
- Mapped to phases: 33
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after initial definition*
