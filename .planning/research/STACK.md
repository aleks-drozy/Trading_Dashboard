# Stack Research

**Project:** Trading Signal Dashboard (IFVG + CISD + 20-EMA)
**Researched:** 2026-03-16
**Overall confidence:** HIGH (core stack verified via official docs and multiple 2025 sources)

---

## Backend

### Core Framework: FastAPI 0.115+

**Use:** `fastapi[standard]>=0.115.0`

FastAPI is the correct choice. It is async-native (built on Starlette + ASGI), has first-class WebSocket support without plugins, and the automatic OpenAPI docs are genuinely useful for debugging signal endpoints during development.

Key details for this project:
- WebSocket handler pattern: `@app.websocket("/ws/{client_id}")` with `await websocket.accept()` and a loop that calls `await websocket.send_json(data)`
- Authentication happens at WebSocket handshake time via query-string token (`?token=<jwt>`), not a header — browsers cannot send custom headers during the WS upgrade request
- Use a `ConnectionManager` class to hold active connections and broadcast updates to all connected clients
- `fastapi[standard]` bundles `uvicorn[standard]`, `pydantic-settings`, and `httpx` — install this, not bare `fastapi`
- As of 0.115, FastAPI validates Content-Type headers on JSON requests by default; this is fine for our use case

**ASGI server:** `uvicorn[standard]>=0.30.0` — already bundled with `fastapi[standard]`. Run with `uvicorn main:app --host 0.0.0.0 --port 8000` on Render.

**Do NOT use:** Flask-SocketIO, Django Channels. Both add unnecessary complexity. FastAPI handles WebSockets natively with zero extra config.

### Signal Computation: pandas + pandas-ta

**Use:** `pandas>=2.1.0`, `pandas-ta>=0.3.14b`

The strategy (IFVG, CISD, 20-EMA) runs on OHLCV DataFrame rows. pandas-ta provides the 20-EMA via `ta.ema(df["close"], length=20)` — no need to write the EMA formula manually. pandas-ta uses pandas' `ewm()` under the hood and matches TradingView's EMA calculation when `adjust=False`.

Alternatives skipped:
- **TA-Lib**: Requires a C binary to compile. Installing on Render's free tier (which uses Debian) is unreliable without a custom build step. pandas-ta is pure Python and installs cleanly.
- **ta (finta)**: Smaller community, fewer edge cases handled. pandas-ta is the standard for this stack.

**For IFVG and CISD logic:** These are custom indicators not in any library — implement them directly as Python functions that operate on a pandas DataFrame. Mirror the PineScript logic bar-by-bar.

### Async Runtime: asyncio (built-in)

No additional concurrency libraries needed. FastAPI + asyncio handles:
- Concurrent WebSocket connections
- Polling yfinance every minute via `asyncio.create_task()` with a scheduled loop
- Receiving Binance WebSocket stream in a background task

Pattern for background data tasks:
```python
@app.on_event("startup")
async def startup():
    asyncio.create_task(binance_stream_loop())
    asyncio.create_task(yfinance_poll_loop())
```

**Do NOT use:** Celery, Redis, background task queues. For a single-user dashboard with 1-minute bars, a plain asyncio task loop is sufficient and avoids infrastructure complexity.

---

## Frontend

### Scaffolding: Vite + React 18 + TypeScript

**Use:** `npm create vite@latest -- --template react-ts`

Create React App (CRA) is effectively unmaintained as of 2023 and removed from the official React docs. Vite is the current standard. For this project:
- Dev server starts in under 200ms (CRA: 20-30 seconds)
- Native TypeScript support, no extra config
- Vercel detects Vite projects automatically — zero deployment config needed

**React version:** 18.x — use concurrent features (automatic batching) and `useEffect` for WebSocket lifecycle management.

### Charting: TradingView Lightweight Charts v5

**Use:** `npm install lightweight-charts@^5`

This is the correct library for this project. Reasons:
- Built specifically for financial OHLCV data — candlestick series, line series (for EMA), and custom markers (for signal entry points) are first-class features
- Canvas-based rendering (not SVG): handles 1-minute bars over a full trading session without performance degradation
- MIT licensed, free
- TradingView publishes official React integration docs and examples at `tradingview.github.io/lightweight-charts/tutorials/react/`
- Supports overlay series — draw IFVG zones as price-band series and CISD levels as horizontal lines on the same chart

Integration pattern: wrap in a React ref-based component (the library is imperative, not declarative). Create the chart in `useEffect`, store the chart instance in a `useRef`, and clean up on unmount.

**Do NOT use:**
- **Recharts**: SVG-based, performance degrades with dense time-series. Also has no native candlestick — you have to build it with `Bar` + `ErrorBar` composites, which is brittle.
- **ApexCharts**: Candlestick support exists but it's a general-purpose library, not financial. Heavier bundle, less control over financial primitives.
- **react-stockcharts**: Abandoned since 2019. Its successor `react-financial-charts` is maintained but adds complexity without benefit over Lightweight Charts.

### State Management: Zustand 4.x

**Use:** `npm install zustand@^4`

Zustand is the correct choice for a single-developer dashboard. The state shape is simple: current prices, signal states per asset, open paper trade positions, auth token. Zustand handles all of this in ~30 lines with no boilerplate.

Redux Toolkit is appropriate for large multi-team apps with complex interdependent state. It is overkill here.

Store slice pattern:
```typescript
// stores/signalStore.ts
const useSignalStore = create<SignalState>((set) => ({
  signals: {},
  updateSignal: (symbol, signal) =>
    set((state) => ({ signals: { ...state.signals, [symbol]: signal } })),
}))
```

### WebSocket Client: native browser WebSocket

No library needed. The browser's built-in `WebSocket` API is sufficient. Wrap it in a custom hook `useWebSocket` that handles:
- Connection on mount, cleanup on unmount
- Reconnect with exponential backoff (Render free tier spins down — clients WILL need to reconnect)
- Dispatching incoming messages to Zustand store

**Do NOT use:** `socket.io-client`. Socket.IO requires a matching Socket.IO server. FastAPI uses plain WebSockets, not the Socket.IO protocol.

### HTTP Client: TanStack Query (React Query) v5

**Use:** `npm install @tanstack/react-query@^5`

For non-streaming data (backtest results, paper trade history, auth), TanStack Query provides caching, loading states, and refetch-on-focus without manual `useEffect` fetch boilerplate. Pair with `axios` or native `fetch`.

---

## Market Data

### US Stocks: yfinance 0.2.x (with caveats)

**Use:** `pip install yfinance>=0.2.40`

yfinance is the only viable free, no-API-key option for Yahoo Finance data. It works for this project's use case, but has hard constraints you must design around:

**Hard constraints:**
1. **1-minute bar history: 7-day limit.** `yf.Ticker("SPY").history(period="7d", interval="1m")` is the maximum lookback for 1m data. You cannot fetch more than 7 days of 1-minute bars in one call.
2. **Rate limiting (429 errors) are common in 2025.** Yahoo has tightened limits. For a single-asset dashboard polling one ticker per minute, this is manageable. Do NOT poll multiple tickers in rapid succession without a `time.sleep(1)` delay between calls.
3. **yfinance has no native async support.** Run `yf.Ticker(...).history(...)` inside `asyncio.to_thread()` to avoid blocking the event loop:
   ```python
   data = await asyncio.to_thread(
       lambda: yf.Ticker("SPY").history(period="2d", interval="1m")
   )
   ```
4. **Use for backtest seed only.** For the live 9:30–10:30 AM signal, poll yfinance every 60 seconds to get the latest closed 1m bar. The 7-day history is sufficient to compute IFVG and CISD states at session open.

**Operational pattern:** On session start (9:25 AM ET), fetch the last 2 days of 1m bars to initialize indicator state. Then poll every 60s during the session for new bars.

### Crypto: Binance WebSocket API (direct, no library)

**Use:** `pip install websockets>=12.0`

Connect directly to Binance's public WebSocket stream. No API key required for market data. The kline stream endpoint:
```
wss://data-stream.binance.vision/ws/btcusdt@kline_1m
```

This is the recommended public endpoint (`data-stream.binance.vision`, not `stream.binance.com`) — it is read-only market data with no auth required.

The stream pushes a message every second with the current in-progress 1m candle. The candle is "closed" when the `k.x` field in the JSON payload is `true`. Only process closed candles for signal computation (same as TradingView's `barstate.isconfirmed`).

**Do NOT use:**
- `python-binance`: Heavyweight, requires API keys even for public streams in some versions. More abstraction than needed.
- `unicorn-binance-websocket-api`: Adds a paid-tier complexity layer. The raw `websockets` library is 10 lines to connect and handles reconnection fine with a simple while loop.

**Reconnect handling** (required — Binance drops connections after 24h):
```python
async def binance_stream_loop(symbol: str):
    uri = f"wss://data-stream.binance.vision/ws/{symbol.lower()}@kline_1m"
    while True:
        try:
            async with websockets.connect(uri) as ws:
                async for message in ws:
                    data = json.loads(message)
                    if data["k"]["x"]:  # candle closed
                        await process_closed_candle(data)
        except Exception:
            await asyncio.sleep(5)  # backoff before reconnect
```

---

## Database

### ORM + Driver: SQLAlchemy 2.0 async + aiosqlite

**Use:** `pip install sqlalchemy>=2.0.0 aiosqlite>=0.19.0`

SQLAlchemy 2.0 (not 1.x) is the correct version — it has a proper async API via `create_async_engine`. The connection string:
```python
engine = create_async_engine("sqlite+aiosqlite:///./trading.db")
```

**Critical Render constraint:** Render's free tier has an **ephemeral filesystem**. SQLite data is wiped on every deploy or service restart/spin-down. This means:
- Paper trade history survives the current session but is lost on redeploy
- Do NOT store anything you need long-term in SQLite on Render free tier

**Mitigation options (pick one):**
1. **Accept the constraint** — paper trading P&L is session-scoped. Document this clearly in the UI.
2. **Export on demand** — add a `/api/trades/export` endpoint that returns trade history as JSON/CSV for manual backup before redeploy.
3. **Render Persistent Disk** — $1/month add-on that mounts a real disk. Breaks zero-downtime deploys but preserves SQLite data. Worth it if P&L history matters.

**Do NOT use Alembic for v1.** Schema migrations add complexity. For a single-user app with a simple schema (trades table, backtest_results table), use `Base.metadata.create_all(engine)` on startup. Add Alembic only if schema changes become painful.

### Schema (minimal)

```sql
-- paper_trades
id, symbol, direction (long/short), entry_price, stop_price,
target_price, entry_time, exit_time, exit_price, pnl, status (open/closed)

-- backtest_results
id, symbol, run_date, total_trades, win_rate, pnl_curve (JSON blob)
```

Store the P&L curve as a JSON-serialized list in a TEXT column — no need for a separate time-series table for v1.

---

## Auth

### JWT: PyJWT 2.x + passlib (bcrypt)

**Use:** `pip install pyjwt>=2.8.0 passlib[bcrypt]>=1.7.4`

**Do NOT use python-jose.** It has not received a release since 2021 and has known security vulnerabilities. FastAPI's own documentation was updated in mid-2024 to replace python-jose with PyJWT (PR #11589). The ecosystem has moved.

PyJWT is actively maintained, focused purely on JWT encode/decode, and is the standard.

For password hashing, `passlib[bcrypt]` remains correct. The FastAPI docs also mention `pwdlib` with Argon2 as an emerging alternative — for a single-user personal dashboard, bcrypt is sufficient and simpler.

**Single-user auth pattern:**
- Store one hashed password in an environment variable (not a database table) — avoids a whole users table and registration flow for a personal dashboard
- Issue a JWT with 8-hour expiry on `/auth/login`
- Protect all API routes with a `get_current_user` dependency
- Protect WebSocket by validating the token passed as a query parameter on connect

```python
# Auth dependency
async def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload["sub"]
    except jwt.PyJWTError:
        raise HTTPException(status_code=401)
```

**Environment variables required:**
- `SECRET_KEY` — generate with `openssl rand -hex 32`
- `HASHED_PASSWORD` — generate once with `passlib.hash.bcrypt.hash("your-password")`
- `JWT_EXPIRY_HOURS` — default 8 (covers a full trading day)

---

## Deployment

### Backend: Render Free Tier (Web Service)

**Use:** Render Web Service, free tier

**Critical limitations to design around:**

1. **Spin-down after 15 minutes of inactivity.** Any WebSocket connection or HTTP request resets the timer. During the 9:30–10:30 AM trading session, active connections will keep the service live. Outside market hours, the service will spin down — this is acceptable.

2. **Cold start takes ~60 seconds.** The frontend must handle the reconnect gracefully (show a "connecting..." state, retry WebSocket connection with exponential backoff).

3. **Ephemeral filesystem** — SQLite data lost on restart (see Database section above).

4. **512 MB RAM, 0.1 CPU** — sufficient for a single-user dashboard. The signal computation on 1m bars is lightweight.

**Deployment config required:**
- `render.yaml` or manual Web Service config
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Environment: Python 3.11
- Set all env vars (`SECRET_KEY`, `HASHED_PASSWORD`, `CORS_ORIGINS`) in Render dashboard

**CORS:** Must explicitly allow the Vercel frontend URL in FastAPI's `CORSMiddleware`.

### Frontend: Vercel (Hobby tier)

**Use:** Vercel Hobby (free)

Vercel is the correct choice for a Vite + React app. It auto-detects Vite projects, sets `npm run build` and `dist/` as defaults, and deploys in ~30 seconds from a GitHub push.

**No meaningful limitations for this project.** 100 GB bandwidth, unlimited deployments, custom domains. The static frontend has no runtime to spin down.

**Required env var:** `VITE_API_URL=https://your-render-service.onrender.com` — set in Vercel dashboard, automatically injected at build time.

**Do NOT server-side render (SSR).** The dashboard is a pure client-side SPA. No Next.js needed. Vite + React deployed as static files is simpler, cheaper, and has no server-side latency.

---

## What NOT to Use

| What | Why Not | Use Instead |
|------|---------|-------------|
| `python-jose` | No releases since 2021, security vulnerabilities, abandoned | `PyJWT>=2.8.0` |
| `Create React App` | Unmaintained, removed from React docs, 30s cold starts | `Vite + react-ts template` |
| `socket.io` / `socket.io-client` | Socket.IO protocol != plain WebSocket; FastAPI doesn't speak Socket.IO | Native browser `WebSocket` API |
| `Recharts` for candlesticks | SVG, degrades with 390 1m bars (9:30-10:30 session), no native OHLC | `lightweight-charts v5` |
| `python-binance` | Requires API keys setup for public streams, heavy dependency | Raw `websockets` lib connecting to `data-stream.binance.vision` |
| `TA-Lib` | Requires C binary compilation, unreliable on Render free tier | `pandas-ta` (pure Python) |
| `Celery + Redis` | Overkill for 1-minute polling with a single user | `asyncio.create_task()` background loop |
| `Django` / `Flask` | Sync-first frameworks; WebSocket support is an add-on (Channels/Flask-SocketIO) | `FastAPI` (async-native) |
| `Next.js` | SSR adds complexity with no benefit for a private SPA dashboard | Vite + React (static deployment) |
| `Alembic` migrations (v1) | Schema churn too early; premature complexity | `Base.metadata.create_all()` on startup |
| `PostgreSQL on Render` | Render free Postgres expires after 90 days — a time bomb | SQLite with ephemeral-awareness OR $1/mo persistent disk |

---

## Installation Reference

### Backend (`requirements.txt`)

```
fastapi[standard]>=0.115.0
uvicorn[standard]>=0.30.0
websockets>=12.0
sqlalchemy>=2.0.0
aiosqlite>=0.19.0
pyjwt>=2.8.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.9
pydantic-settings>=2.0.0
yfinance>=0.2.40
pandas>=2.1.0
pandas-ta>=0.3.14b
python-dotenv>=1.0.0
```

### Frontend (`package.json` deps)

```bash
# Scaffold
npm create vite@latest trading-dashboard-ui -- --template react-ts

# Install
npm install lightweight-charts@^5
npm install zustand@^4
npm install @tanstack/react-query@^5
npm install axios@^1.6

# Dev
npm install -D @types/react@^18 typescript@^5 tailwindcss@^3 autoprefixer postcss
```

---

## Sources

- FastAPI WebSocket docs: https://fastapi.tiangolo.com/advanced/websockets/
- FastAPI JWT migration to PyJWT (PR #11589): https://github.com/fastapi/fastapi/pull/11589
- python-jose abandonment discussion: https://github.com/fastapi/fastapi/discussions/11345
- yfinance rate limiting issues: https://github.com/ranaroussi/yfinance/issues/2422
- Binance public WebSocket streams: https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
- Lightweight Charts React tutorial: https://tradingview.github.io/lightweight-charts/tutorials/react/simple
- Render free tier limitations: https://render.com/docs/free
- Render ephemeral filesystem / persistent disks: https://render.com/docs/disks
- Vercel Vite deployment: https://vercel.com/docs/frameworks/frontend/vite
- SQLAlchemy async with aiosqlite: https://medium.com/@mojimich2015/async-sqlalchemy-engine-in-fastapi-the-guide-e5acdba75c99
- Zustand vs Redux 2025: https://medium.com/@msmt0452/zustand-vs-redux-toolkit-the-complete-guide-to-state-management-in-react-4dce420741b4
