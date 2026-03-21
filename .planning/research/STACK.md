# Stack Research

**Project:** Trading Signal Dashboard (IFVG + CISD + 20-EMA)
**Researched:** 2026-03-16 (v1.0) / 2026-03-21 (v1.1 additions)
**Overall confidence:** HIGH (core stack verified via official docs and multiple 2025 sources)

---

## v1.1 Stack Additions

> This section covers ONLY what is new or changed for the v1.1 milestone. The full v1.0 stack is preserved below. Do not re-research what is already validated.

### NEW: Alpaca WebSocket Feed — `alpaca-py 0.43.x`

**Use:** `alpaca-py>=0.40.0`

**Why alpaca-py and not the old alpaca-trade-api:**
`alpaca-trade-api-python` is deprecated. Alpaca's official documentation explicitly says to migrate to `alpaca-py`. The new SDK is the only one receiving active maintenance and new features as of 2025.

**Current version:** 0.43.2 (released November 4, 2025). Pin to `>=0.40.0` for stability without locking to a patch.

**Key class:** `StockDataStream` from `alpaca.data.live`.

**Free-tier feed:** Must pass `feed="iex"` when instantiating `StockDataStream`. Free Alpaca accounts connect to the IEX data source only — attempting SIP feed will result in an auth error. IEX provides real-time data during market hours (9:30–16:00 ET).

**Critical asyncio integration detail:**
`StockDataStream.run()` calls `asyncio.run()` internally — it is a **blocking, synchronous method**. It cannot be used directly with `asyncio.create_task()`. The correct pattern is to use the private `_run_forever()` coroutine, which is the async method `run()` wraps:

```python
# In lifespan, alongside other background tasks:
tasks = [
    asyncio.create_task(alpaca_feed._run_forever()),
    asyncio.create_task(broadcaster.run()),
]
```

This is confirmed in [alpacahq/alpaca-py issue #476](https://github.com/alpacahq/alpaca-py/issues/476). The `_run_forever` method exists in `alpaca.data.live.websocket.DataStream` (parent class). The leading underscore signals it is not part of the public API — expect it to potentially change in future versions. For this project (single developer, controlled upgrade cadence) it is acceptable. There is no public async coroutine alternative.

**Handler signature:** Async callback receiving a typed `Bar` object:

```python
from alpaca.data.live import StockDataStream

stream = StockDataStream(api_key=API_KEY, secret_key=SECRET_KEY, feed="iex")

async def on_bar(bar) -> None:
    # bar.symbol, bar.open, bar.high, bar.low, bar.close, bar.volume, bar.timestamp
    pass

stream.subscribe_bars(on_bar, "SPY", "AAPL")
# Then in lifespan: asyncio.create_task(stream._run_forever())
```

**Bar object fields (from WebSocket message):**
- `symbol` (str) — ticker symbol
- `open`, `high`, `low`, `close` (float) — OHLC prices
- `volume` (float) — trade volume
- `vwap` (float) — volume-weighted average price
- `trade_count` (int) — number of trades aggregated
- `timestamp` (datetime) — bar open time (RFC-3339)

**Free-tier subscription limits:**
- 1 concurrent WebSocket connection per account
- Up to 30 symbol subscriptions for trades/quotes combined
- **No limit on minute bar subscriptions** — unlimited symbols on the bars channel
- Data available only during regular market hours (9:30–16:00 ET)

**What NOT to use:**
- `alpaca-trade-api` (deprecated, unmaintained)
- `StockDataStream.run()` directly in a FastAPI lifespan (blocks event loop)
- SIP feed on a free account (auth error at connection time)

**Integration with existing BarStore:**
The Alpaca feed should push `Bar` dataclass objects into the existing `backend/data/bar_store.py` singleton. The `Bar` dataclass already matches the required fields. No changes to `BarStore` are needed — only a new `alpaca_feed.py` module mirroring the structure of `binance_feed.py`.

**Replacing yfinance:**
`yfinance_feed.py` and `poll_yfinance_loop()` can be removed from the lifespan once `alpaca_feed.py` is wired in. `yfinance` itself can remain in `requirements.txt` for the backtest/historical chart endpoints which may still use it for bulk historical data fetching.

---

### NEW: Multi-Timeframe Bar Aggregation — `pandas.DataFrame.resample()`

**Use:** `pandas>=2.0` (already in requirements — NO new library needed)

**Why pandas resample and not a custom aggregator:**
pandas `resample()` handles all edge cases of OHLCV aggregation correctly — open is first, high is max, low is min, close is last, volume is sum. Writing this manually is error-prone. pandas is already a hard dependency.

**Pattern for 1m → 5m/15m/1h:**

```python
import pandas as pd

RESAMPLE_RULES = {
    "1m":  None,   # raw bars, no resampling needed
    "5m":  "5min",
    "15m": "15min",
    "1h":  "1h",
}

def resample_bars(bars_1m: list[Bar], timeframe: str) -> list[Bar]:
    rule = RESAMPLE_RULES.get(timeframe)
    if rule is None:
        return bars_1m  # 1m passes through unchanged

    df = pd.DataFrame([b.__dict__ for b in bars_1m])
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.set_index("timestamp")

    resampled = df.resample(rule, closed="left", label="left").agg({
        "open":   "first",
        "high":   "max",
        "low":    "min",
        "close":  "last",
        "volume": "sum",
    }).dropna()

    return [
        Bar(timestamp=ts.to_pydatetime(), **row.to_dict())
        for ts, row in resampled.iterrows()
    ]
```

**`closed="left"` and `label="left"` rationale:**
For trading bars, a "5-minute bar" starting at 09:30 contains trades from 09:30:00 to 09:34:59. Using `closed="left"` means the left boundary (09:30) is included in the bar, and `label="left"` labels that bar with its open time (09:30). This matches how TradingView and every trading platform labels bars. Using `label="right"` would label the 09:30 bar as 09:35 — technically valid but confusing when cross-referencing with TradingView.

**`.dropna()` is required:**
`resample()` fills empty intervals (e.g., no trades during lunch) with NaN. Drop them — they are not real bars and will break the strategy engine if passed through.

**Where aggregation lives:**
In the charts endpoint (`backend/charts/router.py`). The endpoint already fetches 1m bars from `BarStore`, then passes them to the strategy engine. Add a `?timeframe=5m` query parameter. Resample before passing to the strategy recomputation. The strategy engine does not need to change — it just sees a different cadence of bars.

**No new library needed.** pandas `resample()` has been stable and production-ready since pandas 0.18 (2016). The OHLCV aggregation dict pattern is well-established across the quantitative Python ecosystem.

---

### UNCHANGED: Watchlist Management UI

The watchlist management UI (React sidebar) requires no backend stack changes. The `watchlist` router and `WatchlistRepository` already exist and expose `GET/POST/DELETE /watchlist` endpoints. The only addition is a React component in the frontend — no new libraries needed beyond what is already installed.

---

## v1.1 Requirements Changes

| Package | Action | Reason |
|---------|--------|--------|
| `alpaca-py>=0.40.0` | **ADD** | Alpaca WebSocket feed |
| `yfinance>=0.2.50` | **KEEP** | Still used for historical data in charts/backtest endpoints |
| `pandas>=2.0` | **KEEP** (already present) | Covers `resample()` for multi-timeframe aggregation |
| `alpaca-trade-api` | **DO NOT ADD** | Deprecated; alpaca-py is the replacement |

**Updated requirements.txt diff:**

```diff
+alpaca-py>=0.40.0
 fastapi>=0.115
 uvicorn[standard]>=0.30
 sqlmodel>=0.0.21
 PyJWT>=2.12.1
 bcrypt==4.0.1
 passlib>=1.7.4
 pydantic-settings>=2.0
 python-dotenv>=1.0
 python-binance==1.0.35
 yfinance>=0.2.50
 pandas>=2.0
 pytest>=8.0
 httpx>=0.27
 pytest-asyncio>=0.23
 python-multipart>=0.0.9
```

---

## Full v1.0 Stack (Validated — Do Not Re-Research)

### Backend

#### Core Framework: FastAPI 0.115+

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

#### Signal Computation: pandas + pandas-ta

**Use:** `pandas>=2.1.0`, `pandas-ta>=0.3.14b`

The strategy (IFVG, CISD, 20-EMA) runs on OHLCV DataFrame rows. pandas-ta provides the 20-EMA via `ta.ema(df["close"], length=20)` — no need to write the EMA formula manually. pandas-ta uses pandas' `ewm()` under the hood and matches TradingView's EMA calculation when `adjust=False`.

Alternatives skipped:
- **TA-Lib**: Requires a C binary to compile. Installing on Render's free tier (which uses Debian) is unreliable without a custom build step. pandas-ta is pure Python and installs cleanly.
- **ta (finta)**: Smaller community, fewer edge cases handled. pandas-ta is the standard for this stack.

**For IFVG and CISD logic:** These are custom indicators not in any library — implement them directly as Python functions that operate on a pandas DataFrame. Mirror the PineScript logic bar-by-bar.

#### Async Runtime: asyncio (built-in)

No additional concurrency libraries needed. FastAPI + asyncio handles:
- Concurrent WebSocket connections
- Background data feed tasks via `asyncio.create_task()` in the lifespan context manager
- Receiving Binance WebSocket stream in a background task

**Do NOT use:** Celery, Redis, background task queues. For a single-user dashboard with 1-minute bars, a plain asyncio task loop is sufficient and avoids infrastructure complexity.

---

### Frontend

#### Scaffolding: Vite + React 18 + TypeScript

**Use:** `npm create vite@latest -- --template react-ts`

Create React App (CRA) is effectively unmaintained as of 2023 and removed from the official React docs. Vite is the current standard. For this project:
- Dev server starts in under 200ms (CRA: 20-30 seconds)
- Native TypeScript support, no extra config
- Vercel detects Vite projects automatically — zero deployment config needed

**React version:** 18.x — use concurrent features (automatic batching) and `useEffect` for WebSocket lifecycle management.

#### Charting: TradingView Lightweight Charts v5

**Use:** `npm install lightweight-charts@^5`

This is the correct library for this project. Reasons:
- Built specifically for financial OHLCV data — candlestick series, line series (for EMA), and custom markers (for signal entry points) are first-class features
- Canvas-based rendering (not SVG): handles 1-minute bars over a full trading session without performance degradation
- MIT licensed, free
- TradingView publishes official React integration docs and examples at `tradingview.github.io/lightweight-charts/tutorials/react/`
- Supports overlay series — draw IFVG zones as price-band series and CISD levels as horizontal lines on the same chart

Integration pattern: wrap in a React ref-based component (the library is imperative, not declarative). Create the chart in `useEffect`, store the chart instance in a `useRef`, and clean up on unmount.

**Do NOT use:**
- **Recharts**: SVG-based, performance degrades with dense time-series. Also has no native candlestick.
- **ApexCharts**: Candlestick support exists but it's a general-purpose library, not financial.
- **react-stockcharts**: Abandoned since 2019.

#### State Management: Zustand 4.x

**Use:** `npm install zustand@^4`

Zustand is the correct choice for a single-developer dashboard. Redux Toolkit is appropriate for large multi-team apps with complex interdependent state. It is overkill here.

#### WebSocket Client: native browser WebSocket

No library needed. The browser's built-in `WebSocket` API is sufficient. Wrap it in a custom hook `useWebSocket` that handles connection on mount, cleanup on unmount, reconnect with exponential backoff, and dispatching incoming messages to Zustand store.

**Do NOT use:** `socket.io-client`. Socket.IO requires a matching Socket.IO server. FastAPI uses plain WebSockets, not the Socket.IO protocol.

#### HTTP Client: TanStack Query (React Query) v5

**Use:** `npm install @tanstack/react-query@^5`

For non-streaming data (backtest results, paper trade history, auth), TanStack Query provides caching, loading states, and refetch-on-focus without manual `useEffect` fetch boilerplate.

---

### Market Data

#### US Stocks (v1.0): yfinance 0.2.x

Still used for historical chart data and backtest initialization. NOT the live feed in v1.1+.

Hard constraints remain:
1. 1-minute bar history: 7-day limit
2. Rate limiting (429 errors) common in 2025 — add `asyncio.to_thread()` wrapper
3. No native async support — always wrap in `asyncio.to_thread()`

#### Crypto: Binance WebSocket API (direct)

Uses `python-binance==1.0.35` (existing) via `BinanceFeed` class. Pattern: proactive 23-hour reconnect to avoid Binance's hard 24-hour WebSocket limit.

Disabled by default on Render (US geo-block). Enable via `ENABLE_BINANCE_FEED=true` env var.

---

### Database

#### SQLModel (wraps SQLAlchemy 2.0)

**Use:** `sqlmodel>=0.0.21` (already in use)

SQLite via `trading.db`. Ephemeral on Render free tier — paper trade history survives sessions but is lost on redeploy.

---

### Auth

#### PyJWT 2.x + passlib (bcrypt)

**Use:** `pyjwt>=2.12.1`, `passlib>=1.7.4`

**Do NOT use python-jose.** It has not received a release since 2021 and has known security vulnerabilities. FastAPI's own documentation was updated in mid-2024 to replace python-jose with PyJWT (PR #11589).

---

## What NOT to Use

| What | Why Not | Use Instead |
|------|---------|-------------|
| `alpaca-trade-api` | Deprecated by Alpaca, unmaintained | `alpaca-py>=0.40.0` |
| `StockDataStream.run()` in lifespan | Calls `asyncio.run()` internally — blocks event loop | `asyncio.create_task(stream._run_forever())` |
| SIP feed on free Alpaca account | Auth error at connection time — free tier is IEX only | `StockDataStream(..., feed="iex")` |
| `pandas resample(label="right")` for bar timestamps | Labels 09:30 bar as 09:35 — contradicts TradingView convention | `resample(..., closed="left", label="left")` |
| `python-jose` | No releases since 2021, security vulnerabilities | `PyJWT>=2.8.0` |
| `Create React App` | Unmaintained, removed from React docs | `Vite + react-ts template` |
| `socket.io-client` | Socket.IO protocol != plain WebSocket | Native browser `WebSocket` API |
| `Recharts` for candlesticks | SVG, degrades with dense 1m bars, no native OHLC | `lightweight-charts v5` |
| `TA-Lib` | Requires C binary compilation, unreliable on Render free tier | `pandas-ta` (pure Python) |
| `Celery + Redis` | Overkill for single-user dashboard | `asyncio.create_task()` background loop |

---

## Installation Reference

### Backend (`requirements.txt`) — v1.1

```
fastapi>=0.115
uvicorn[standard]>=0.30
sqlmodel>=0.0.21
PyJWT>=2.12.1
bcrypt==4.0.1
passlib>=1.7.4
pydantic-settings>=2.0
python-dotenv>=1.0
python-binance==1.0.35
alpaca-py>=0.40.0
yfinance>=0.2.50
pandas>=2.0
pandas-ta>=0.3.14b
pytest>=8.0
httpx>=0.27
pytest-asyncio>=0.23
python-multipart>=0.0.9
```

### Frontend (`package.json` deps) — unchanged from v1.0

```bash
npm install lightweight-charts@^5
npm install zustand@^4
npm install @tanstack/react-query@^5
npm install axios@^1.6
npm install -D @types/react@^18 typescript@^5 tailwindcss@^3 autoprefixer postcss
```

---

## Sources

- alpaca-py PyPI (version confirmed): https://pypi.org/project/alpaca-py/
- alpaca-py GitHub (official SDK): https://github.com/alpacahq/alpaca-py
- Alpaca SDK migration guide: https://docs.alpaca.markets/docs/sdks-and-tools
- StockDataStream API reference: https://alpaca.markets/sdks/python/api_reference/data/stock/live.html
- alpaca-py asyncio integration pattern (issue #476): https://github.com/alpacahq/alpaca-py/issues/476
- Alpaca free tier IEX limitations (community forum): https://forum.alpaca.markets/t/iex-or-sip-with-a-free-account/17141
- Alpaca real-time stock data (bar message fields): https://docs.alpaca.markets/docs/real-time-stock-pricing-data
- pandas DataFrame.resample() docs (pandas 3.0.1): https://pandas.pydata.org/docs/reference/api/pandas.DataFrame.resample.html
- pandas resample OHLCV aggregation pattern: https://atekihcan.com/blog/codeortrading/changing-timeframe-of-ohlc-candlestick-data-in-pandas/
- FastAPI JWT migration to PyJWT (PR #11589): https://github.com/fastapi/fastapi/pull/11589

---
*Stack research for: Trading Signal Dashboard v1.1 (Alpaca WebSocket + Multi-Timeframe)*
*Researched: 2026-03-21*
