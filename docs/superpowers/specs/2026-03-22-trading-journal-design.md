# Trading Journal App — Design Spec

**Date:** 2026-03-22
**Status:** Approved

---

## Overview

A multi-user SaaS trading journal app where traders can log trades across all asset classes, attach chart screenshots, tag strategies, write reflections, and track performance analytics over time.

**Core goals:**
- Log and review trades with rich context (notes, tags, images)
- Track performance stats (win rate, P&L, R:R, drawdown)
- Filter and search the trade log by any dimension
- Dark terminal aesthetic — professional, focused, built for traders

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript |
| Auth | NextAuth.js v5 — credentials (email/password) + Google OAuth |
| Database | MongoDB via Mongoose (MongoDB Atlas) |
| File Storage | Cloudinary (chart image uploads) |
| Styling | Tailwind CSS — dark theme, green accents |
| Testing | Vitest (unit + integration), Playwright (E2E) |
| Deployment | Vercel (app), MongoDB Atlas (DB) |

---

## Architecture

Single Next.js monolith — frontend pages and API routes in one project. No separate backend service.

```
trade-journal/
├── app/
│   ├── (auth)/              # login, register pages
│   ├── (dashboard)/         # protected pages (require auth)
│   │   ├── dashboard/       # stats overview
│   │   ├── trades/          # trade log + add trade
│   │   └── trades/[id]/     # trade detail + edit
│   └── api/
│       ├── auth/            # NextAuth handlers
│       ├── trades/          # GET, POST /api/trades
│       ├── trades/[id]/     # GET, PUT, DELETE /api/trades/[id]
│       └── upload/          # POST /api/upload (Cloudinary)
├── components/
│   ├── ui/                  # base components (button, input, card)
│   ├── trades/              # trade form, trade table, trade card
│   └── charts/              # P&L chart, breakdown chart
├── lib/
│   ├── db.ts                # MongoDB connection singleton
│   ├── auth.ts              # NextAuth config
│   ├── cloudinary.ts        # upload helper
│   ├── calculations.ts      # P&L, R:R, win rate logic
│   └── models/
│       ├── User.ts          # Mongoose User model
│       └── Trade.ts         # Mongoose Trade model
├── schemas/
│   └── trade.ts             # Zod validation schemas (shared)
└── types/
    └── index.ts             # shared TypeScript types
```

---

## Data Models

### User
```ts
{
  _id: ObjectId,
  email: string,           // unique
  name: string,
  image?: string,          // Google profile picture
  passwordHash?: string,   // null for Google OAuth users
  provider: 'credentials' | 'google',
  createdAt: Date,
  updatedAt: Date
}
```

### Trade
```ts
{
  _id: ObjectId,
  userId: ObjectId,        // ref: User

  // Asset info
  symbol: string,          // e.g. "AAPL", "BTC/USD", "EUR/USD"
  assetClass: 'stock' | 'crypto' | 'forex' | 'options',
  direction: 'long' | 'short',

  // Trade data
  entryPrice: number,
  exitPrice?: number,       // null if trade is still open
  quantity: number,
  stopLoss?: number,
  takeProfit?: number,
  entryDate: Date,
  exitDate?: Date,
  status: 'open' | 'closed',

  // Calculated on save (not at read time)
  pnl?: number,
  pnlPercent?: number,
  riskRewardRatio?: number, // (exitPrice - entryPrice) / (entryPrice - stopLoss)

  // Context
  strategy: string,        // e.g. "breakout", "mean reversion"
  tags: string[],          // free-form user tags
  notes: string,           // journal/reflection text
  chartImageUrl?: string,  // Cloudinary URL

  createdAt: Date,
  updatedAt: Date
}
```

**Design decisions:**
- `pnl`, `pnlPercent`, and `riskRewardRatio` are calculated and stored on save — keeps analytics queries fast, avoids re-computation on every read
- Notes live on the Trade model (no separate JournalEntry collection) — simplifies the data model
- Tags are free-form strings on the trade (no separate Tag collection) — aggregated dynamically for filter UI

---

## Pages & Routes

| Route | Auth | Description |
|---|---|---|
| `/` | Public | Landing page with feature overview and sign-up CTA |
| `/login` | Public | Email/password login + Google OAuth button |
| `/register` | Public | Email/password registration |
| `/dashboard` | Protected | Stats overview — win rate, P&L, streaks, charts |
| `/trades` | Protected | Trade log table with filters and pagination |
| `/trades/new` | Protected | Add new trade form |
| `/trades/[id]` | Protected | Trade detail view — full info, chart image, notes |
| `/trades/[id]/edit` | Protected | Edit existing trade |

---

## Dashboard Stats

Computed from all **closed** trades belonging to the authenticated user:

- **Summary cards:** Total P&L, Win Rate %, Avg Risk:Reward, Profit Factor
- **Streaks:** Current win streak, current loss streak, best win streak
- **Best/Worst trade:** Highest and lowest single trade P&L
- **P&L over time:** Line chart (daily/weekly/monthly toggle)
- **Asset class breakdown:** Bar or pie chart of trades and P&L by asset class

---

## Trade Log Features

**Filters:**
- Asset class (stock / crypto / forex / options)
- Direction (long / short)
- Status (open / closed)
- Strategy (dropdown from user's existing strategies)
- Tags (multi-select from user's existing tags)
- Date range (from / to)

**Sorting:** Date, P&L, Symbol (asc/desc)

**Pagination:** 20 trades per page

**P&L auto-calculation:** In the trade form, P&L is calculated live as the user types entry price, exit price, and quantity.

---

## API Routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/trades` | List trades (supports filter/sort/pagination query params) |
| POST | `/api/trades` | Create new trade |
| GET | `/api/trades/[id]` | Get single trade |
| PUT | `/api/trades/[id]` | Update trade |
| DELETE | `/api/trades/[id]` | Delete trade |
| POST | `/api/upload` | Upload chart image to Cloudinary, returns URL |

All routes are protected — unauthenticated requests return `401`.

**Response format:**
```ts
// Success
{ data: T }

// Error
{ error: string, status: number }
```

---

## Validation

Zod schemas in `schemas/trade.ts` are shared between the frontend form and the API route handler. A single source of truth for validation rules.

---

## Error Handling

- API routes return consistent `{ error, status }` JSON
- Form validation runs client-side (Zod) before submission
- Image upload failures are non-blocking — trade saves without image, user sees a toast notification
- NextAuth handles auth errors via its built-in error pages
- Next.js global error boundary catches unexpected UI crashes

---

## Testing Strategy

| Layer | Tool | What's covered |
|---|---|---|
| Unit | Vitest | P&L/R:R calculations, Zod schemas, utility functions |
| Integration | Vitest + Mongoose | API route handlers against a real MongoDB test DB |
| E2E | Playwright | Register → log trade → view dashboard stats |

---

## Dev Tooling

- ESLint + Prettier (code style)
- Husky pre-commit hooks (lint + type-check before commit)
- `.env.local` for all secrets:
  - `MONGODB_URI`
  - `NEXTAUTH_SECRET`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`

---

## Visual Design

- **Theme:** Dark terminal — near-black background (`#0f0f0f`), dark card surfaces (`#1a1a1a`), green accents (`#00ff88`) for positive P&L and primary actions
- **Negative P&L:** Red (`#ef4444`)
- **Typography:** Monospace font for prices and numbers, sans-serif for body text
- **Charts:** Recharts library — styled to match dark theme

---

## Out of Scope (v1)

- TradingView chart embedding
- Broker API integrations (auto-import trades)
- Mobile app
- Social features (sharing trades)
- Subscription/payments
