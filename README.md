# Trading Dashboard

A full-stack trading application in two parts: a **trade journal** for logging and reviewing your own
trades, and a **real-time market dashboard** with live data feeds, streaming signals, and a
paper-trading engine. The dashboard's signal engine is a Python port of a 542-line PineScript
strategy (`docs/reference/FYP_BOT_1_3.pine`), served by FastAPI and streamed to the browser over a
WebSocket.

**Live app:** [tradingdashboard-one.vercel.app](https://tradingdashboard-one.vercel.app) — the trade
journal. It sits behind Google sign-in, so the journal and dashboard views are only reachable once
authenticated.

## Two surfaces

### 1. Trade Journal — the live production app (root Next.js)
Log, tag and review trades, with a metrics dashboard, a calendar view, and per-trade detail pages
(including trade screenshots). Google sign-in via NextAuth, MongoDB persistence, image uploads via
Cloudinary, transactional email via Resend.

- **Stack:** Next.js (App Router), TypeScript, NextAuth (Google OAuth), MongoDB, Cloudinary, Resend,
  Vitest, deployed on Vercel.

### 2. Real-time market dashboard (`backend/` FastAPI + `frontend/` Vite)
A separate real-time surface: live market data, a watchlist, a streaming signal table, a session
indicator, a paper-trading portfolio, charts, and a backtest view — powered by a FastAPI service that
streams over WebSockets and includes a Python implementation of the IFVG + CISD strategy.

- **Stack:** FastAPI, SQLModel, Uvicorn, JWT auth, WebSockets; Alpaca / Binance / yfinance data
  feeds; paper-trading engine; React + Vite frontend.

## Running locally

**Trade Journal (live app):**

```bash
npm install
cp .env.example .env.local   # fill in MongoDB, NextAuth, Google OAuth, Cloudinary, Resend
npm run dev                  # http://localhost:3000
```

**Real-time dashboard:**

```bash
# backend (FastAPI)
pip install -r requirements.txt
uvicorn backend.main:app --reload      # http://localhost:8000

# frontend (Vite) — in a second terminal
cd frontend && npm install && npm run dev   # http://localhost:5173
```

## Repository layout

```text
app/          Next.js Trade Journal — routes, pages (the live production app)
components/   Journal UI components
schemas/      Shared data schemas
lib/          Shared utilities
backend/      FastAPI service: auth, data feeds, signals, paper trading, backtest, strategy
frontend/     Vite + React live-signal dashboard (talks to backend/)
docs/         Design specs (docs/specs/) and the PineScript strategy source it was ported from
tests/        Test suites
```

## Quality checks

```bash
npm run lint
npm test
```

## Note

Personal portfolio project, for research and learning. Not financial advice; the paper-trading engine
executes simulated orders only — no broker connection places real trades.
