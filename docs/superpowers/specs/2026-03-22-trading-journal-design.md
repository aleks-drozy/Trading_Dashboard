# Trading Journal App — Design Spec

**Date:** 2026-03-22
**Status:** Draft

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
│   │   ├── trades/          # trade log (list page)
│   │   ├── trades/new/      # add trade form
│   │   ├── trades/[id]/     # trade detail view
│   │   └── trades/[id]/edit/ # edit trade form
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
│   ├── trade.ts             # Zod trade create/update schemas
│   └── auth.ts              # Zod registration/login schemas
├── types/
│   └── index.ts             # shared TypeScript types
└── middleware.ts            # NextAuth v5 route protection (root level)
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

  // Options-specific fields (only present when assetClass === 'options')
  strikePrice?: number,
  expirationDate?: Date,
  contractType?: 'call' | 'put',
  premium?: number,          // cost per contract

  // Trade data
  entryPrice: number,
  exitPrice?: number,       // null if trade is still open
  quantity: number,
  stopLoss?: number,
  takeProfit?: number,
  entryDate: Date,
  exitDate?: Date,
  // Derived on save: 'open' if exitPrice/exitDate are absent, 'closed' if both are present
  status: 'open' | 'closed',

  // Calculated on save (not at read time)
  pnl?: number,
  pnlPercent?: number,
  riskRewardRatio?: number, // direction-aware: see calculations.ts
  // Long:  (exitPrice - entryPrice) / (entryPrice - stopLoss)
  // Short: (entryPrice - exitPrice) / (stopLoss - entryPrice)

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
- Tags are free-form strings on the trade (no separate Tag collection) — aggregated dynamically for filter UI via MongoDB `$group` on the user's trades
- `strategy` is also a free-form string — the strategy dropdown in the filter UI is populated by a `GET /api/trades/meta` route that returns `{ strategies: string[], tags: string[] }` aggregated from the user's existing trades
- `status` is derived on save: `'closed'` requires **both** `exitPrice` and `exitDate` to be present; if only one is provided the Zod schema rejects the input. A trade with neither is `'open'`.

**P&L calculation formulas (implemented in `lib/calculations.ts`):**

For **stocks, crypto, forex:**
```
pnl         = direction === 'long'
                ? (exitPrice - entryPrice) * quantity
                : (entryPrice - exitPrice) * quantity
pnlPercent  = (pnl / (entryPrice * quantity)) * 100
```

For **options** (quantity = number of contracts; standard 100-share multiplier applies):
```
pnl         = direction === 'long'
                ? (exitPremium - premium) * quantity * 100
                : (premium - exitPremium) * quantity * 100
pnlPercent  = (pnl / (premium * quantity * 100)) * 100
```
> Note: `entryPrice` and `exitPrice` for options represent the **underlying asset price** at entry/exit (informational). `premium` is the **entry cost per share of the contract**; `exitPremium` is the **exit sell price per share of the contract** — stored in the `exitPrice` field for options. Total cost basis = `premium * quantity * 100`. Example: buy 2 AAPL $150 call contracts at $3.00 premium, sell at $5.50 → pnl = (5.50 - 3.00) * 2 * 100 = $500.
>
> Forex P&L is quoted in the counter currency and is not converted — the user is responsible for their position sizing units.

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
| GET | `/api/stats` | Aggregated dashboard stats for the authenticated user |
| GET | `/api/trades/meta` | Returns `{ strategies, tags }` aggregated from user's trades (for filter dropdowns) |

All routes are protected — unauthenticated requests return `401`.

**Route protection mechanism:** A root-level `middleware.ts` file uses NextAuth v5's `auth()` helper to protect all `/api/*` (except `/api/auth/*`) and `/(dashboard)/*` routes. Individual API route handlers do not need to re-check auth — the middleware handles it centrally.

**`GET /api/trades` query params:**

| Param | Type | Description |
|---|---|---|
| `page` | number | Page number (default: 1) |
| `limit` | number | Results per page (default: 20) |
| `sortBy` | string | Field to sort by: `entryDate`, `pnl`, `symbol` (default: `entryDate`) |
| `sortDir` | `asc` \| `desc` | Sort direction (default: `desc`) |
| `assetClass` | string | Filter by asset class |
| `direction` | `long` \| `short` | Filter by direction |
| `status` | `open` \| `closed` | Filter by status |
| `strategy` | string | Filter by strategy name |
| `tags` | string (comma-separated) | Filter by one or more tags |
| `from` | ISO date string | Entry date range start |
| `to` | ISO date string | Entry date range end |

**`GET /api/stats` query params:**

| Param | Type | Description |
|---|---|---|
| `granularity` | `daily` \| `weekly` \| `monthly` | Grouping for `pnlByDate` (default: `daily`) |
| `from` | ISO date string | Optional date range start |
| `to` | ISO date string | Optional date range end |

**`GET /api/stats` response:**
```ts
{
  totalPnl: number,
  winRate: number,           // 0–100
  avgRiskReward: number,
  profitFactor: number,
  totalTrades: number,
  bestTrade: { symbol, pnl },
  worstTrade: { symbol, pnl },
  currentWinStreak: number,
  currentLossStreak: number,
  bestWinStreak: number,
  pnlByDate: { date: string, pnl: number }[],
  pnlByAssetClass: { assetClass: string, pnl: number, count: number }[]
}
```

**Response format:**
```ts
// Success
{ data: T }

// Error
{ error: string, status: number }
```

---

## Validation

Zod schemas are shared between frontend and API — a single source of truth for validation rules:

- `schemas/trade.ts` — trade create/update validation
- `schemas/auth.ts` — registration and login validation

**Password requirements (enforced in `schemas/auth.ts`):** minimum 8 characters, at least one uppercase letter, one lowercase letter, and one number.

---

## Error Handling

- API routes return consistent `{ error, status }` JSON
- Form validation runs client-side (Zod) before submission
- Image upload failures are non-blocking — trade saves without image, user sees a toast notification
- Chart images are uploaded **server-side** through `/api/upload` — the browser POSTs the file to the Next.js API route, which streams it to Cloudinary using the Cloudinary Node SDK. This avoids exposing API credentials to the client.
- **Orphaned images (v1 known gap):** If a chart image is uploaded successfully but the subsequent trade save fails, the Cloudinary image is orphaned. Cleanup of orphaned images is out of scope for v1 — acceptable given low frequency.
- NextAuth handles auth errors via its built-in error pages
- Next.js global error boundary catches unexpected UI crashes

---

## Testing Strategy

| Layer | Tool | What's covered |
|---|---|---|
| Unit | Vitest | P&L/R:R calculations, Zod schemas, utility functions |
| Integration | Vitest + `mongodb-memory-server` | API route handlers against an in-memory MongoDB instance (no Atlas required in CI) |
| E2E | Playwright | Register → log trade → view dashboard stats |

---

## Dev Tooling

- ESLint + Prettier (code style)
- Husky pre-commit hooks (lint + type-check before commit)
- `.env.local` for all secrets:
  - `MONGODB_URI`
  - `NEXTAUTH_SECRET`
  - `NEXTAUTH_URL` (required for local dev: `http://localhost:3000`; NextAuth v5 auto-detects on Vercel, so not required in production)
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
