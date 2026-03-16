# Architecture Patterns

**Project:** Trading Dashboard (IFVG + CISD + 20-EMA)
**Domain:** Real-time trading signal dashboard — single user, personal deployment
**Researched:** 2026-03-16
**Confidence:** HIGH (FastAPI/WebSocket patterns), MEDIUM (strategy engine structure)

---

## Recommended Architecture

This system has one non-negotiable constraint: **a single server process** (Render free tier) handling
two upstream WebSocket feeds, one strategy engine, one SQLite database, and one browser client —
all in the same asyncio event loop. Every architectural decision flows from this constraint.

### High-Level Component Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        FASTAPI PROCESS                              │
│                                                                     │
│  ┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │  Data Ingest │    │  Strategy Engine │    │  Connection Mgr  │  │
│  │  (asyncio    │───▶│  (stateful       │───▶│  (WebSocket      │  │
│  │   tasks)     │    │   per-asset      │    │   fan-out)       │  │
│  └──────────────┘    │   calculators)   │    └────────┬─────────┘  │
│         │            └──────────────────┘             │            │
│         │                    │                        │            │
│  ┌──────┴──────┐    ┌────────▼─────────┐             │            │
│  │  yfinance   │    │  SQLite          │             │            │
│  │  (polling)  │    │  (paper trades,  │             │            │
│  │  Binance WS │    │   backtest data) │             │            │
│  │  (native WS)│    └──────────────────┘             │            │
│  └─────────────┘                                     │            │
│                                                       │            │
│  ┌────────────────────────────────────────────────────┘            │
│  │  REST endpoints (auth, backtest, paper trade CRUD)              │
│  └─────────────────────────────────────────────────────────────────┘
│                                                                     │
└───────────────────────────────────────────────┬─────────────────────┘
                                                │ WebSocket + HTTP
                                    ┌───────────▼──────────┐
                                    │  REACT FRONTEND      │
                                    │  (Vercel)            │
                                    │                      │
                                    │  useWebSocket hook   │
                                    │  Signal display      │
                                    │  Chart (Recharts)    │
                                    │  Paper trade UI      │
                                    └──────────────────────┘
```

---

## Component Boundaries

### 1. Data Ingest Layer

**Responsibility:** Pull or receive raw OHLCV bars, normalize to a common format, publish internally.

**What it does NOT do:** Calculate indicators, store to DB, or send to clients.

| Sub-component | Data source | Pattern |
|---------------|-------------|---------|
| Stock ingest | yfinance | asyncio polling, 60-second interval via `asyncio.sleep(60)` |
| Crypto ingest | Binance public WS | Native asyncio WebSocket client (`websockets` or `python-binance`) |

**Normalization target:**
```python
@dataclass
class OHLCVBar:
    symbol: str          # "AAPL", "BTCUSDT"
    asset_class: str     # "stock", "crypto"
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    is_closed: bool      # True when candle is confirmed/closed
```

**Why `is_closed` matters:** Binance sends partial kline updates every 250ms. The strategy engine
must only run on closed bars to avoid recalculating on noise. yfinance returns closed bars
by design (polling returns completed candles). This flag unifies both sources.

**Internal communication:** Direct Python call — ingest layer calls `strategy_engine.on_bar(bar)`.
No queue needed at single-user/single-process scale. If throughput becomes an issue, introduce
`asyncio.Queue` between ingest and engine.

### 2. Strategy Engine

**Responsibility:** Maintain rolling indicator state per asset. Emit a signal state dict on each
closed bar.

**What it does NOT do:** Fetch data, write to DB, communicate with clients.

**Design:** One `AssetState` object per tracked symbol, updated in-place on each closed bar.

```python
@dataclass
class AssetState:
    symbol: str
    bars: deque          # Rolling window, maxlen=50 (enough for EMA + IFVG lookback)
    ema20: float | None
    ifvg_state: Literal["Bullish", "Bearish", "None", "Expired"]
    ifvg_zone: tuple[float, float] | None  # (low, high) of gap
    ifvg_bar_age: int    # Bars since IFVG formed; expires at 10
    cisd_state: Literal["Bullish", "Bearish"]
    cisd_level: float | None
    signal: Literal["Long", "Short", "No Signal"]
    last_updated: datetime
```

**Output shape** (emitted to Connection Manager after each bar):
```python
{
  "type": "signal_update",
  "symbol": "AAPL",
  "timestamp": "2026-03-16T09:31:00",
  "close": 195.42,
  "ema20": 194.80,
  "ema_condition": "above",      # "above" | "below"
  "ifvg_state": "Bullish",
  "ifvg_zone": [194.10, 194.90],
  "cisd_state": "Bullish",
  "signal": "Long"
}
```

**Stateful design rationale:** EMA and IFVG both require a rolling window of prior bars. A stateless
"recalculate from scratch on each tick" approach would require fetching historical bars on every
update — expensive and unnecessary. Maintain state in memory; reconstruct on server restart using
historical data from yfinance (backfill on startup).

### 3. Connection Manager

**Responsibility:** Track active browser WebSocket connections. Broadcast signal update messages
to all connected clients.

**Pattern:** Standard FastAPI `ConnectionManager` with a `set` of active connections.
Single-user deployment means this set will contain at most 1-2 connections in practice.

```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast_json(self, data: dict):
        dead = set()
        for ws in self.active_connections:
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self.active_connections.discard(ws)
```

**Note on broadcast error handling:** Silent disconnects (network drop, tab close) raise exceptions
on `send_json`. Collect dead connections and prune after iteration to avoid mutating the set
mid-loop.

### 4. REST API Endpoints

**Responsibility:** Stateless request/response operations that do not require streaming.

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/auth/login` | POST | Issue JWT token |
| `/assets` | GET | List tracked assets with current state snapshot |
| `/assets/{symbol}/history` | GET | Return OHLCV + indicator history for chart |
| `/assets/{symbol}/backtest` | GET | Return backtest P&L curve data |
| `/paper-trades` | GET | List all paper trades |
| `/paper-trades` | POST | Open a new paper trade |
| `/paper-trades/{id}` | PATCH | Close/update a paper trade |
| `/paper-trades/portfolio` | GET | Cumulative P&L, open positions summary |
| `/ws` | WS | Single WebSocket endpoint for real-time stream |

**Auth model:** JWT issued on login, passed as `?token=<jwt>` query parameter on WebSocket
connection (browser WebSocket API does not support custom headers). On REST endpoints, use
`Authorization: Bearer <jwt>` header. Validate the token before accepting the WebSocket.

### 5. SQLite / aiosqlite Layer

**Responsibility:** Persist paper trade history. Optionally cache backtest results.

**What it does NOT do:** Store live market data (in-memory only) or indicator state (reconstructed
on startup).

**Schema:**

```sql
-- Paper trades
CREATE TABLE paper_trades (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    direction   TEXT NOT NULL CHECK(direction IN ('long', 'short')),
    entry_price REAL NOT NULL,
    stop_price  REAL NOT NULL,
    target_price REAL NOT NULL,
    size        REAL NOT NULL DEFAULT 1.0,
    opened_at   TEXT NOT NULL,   -- ISO8601
    closed_at   TEXT,
    exit_price  REAL,
    pnl         REAL,
    status      TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open', 'closed', 'stopped'))
);

-- Optional: cache backtest signal events to avoid recalculating on every request
CREATE TABLE backtest_signals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol      TEXT NOT NULL,
    signal_time TEXT NOT NULL,
    direction   TEXT NOT NULL,
    entry_price REAL NOT NULL,
    exit_price  REAL,
    pnl         REAL,
    result      TEXT CHECK(result IN ('win', 'loss', 'open'))
);
```

**Use `aiosqlite`** (not raw `sqlite3`) to avoid blocking the event loop on DB writes. The
paper trade table is write-light (1 trade per day max per the strategy rules), so SQLite
is entirely sufficient.

### 6. React Frontend

**Responsibility:** Display signal state, chart, paper trade management. No business logic.

**Component structure:**

```
App
├── AuthGate (checks JWT in localStorage, redirects to login)
├── LoginPage
└── Dashboard
    ├── AssetSelector (dropdown/tabs for symbol switching)
    ├── SignalPanel
    │   ├── IFVGIndicator
    │   ├── CISDIndicator
    │   ├── EMAIndicator
    │   └── CombinedSignal (Long / Short / No Signal)
    ├── ChartPanel
    │   ├── CandlestickChart (Recharts or Lightweight Charts)
    │   ├── IFVGZoneOverlay
    │   └── SignalMarkers (entry arrows)
    ├── BacktestPanel
    │   └── PnLCurve
    └── PaperTradePanel
        ├── OpenPositions
        ├── TradeHistory
        └── NewTradeForm
```

**WebSocket hook strategy:** Use `react-use-websocket` (npm package, actively maintained) rather
than a raw `useEffect` implementation. It handles reconnection with exponential backoff and
prevents the common "WebSocket created on every render" mistake.

```typescript
const { lastJsonMessage } = useWebSocket(
  `wss://api.example.com/ws?token=${jwt}`,
  {
    reconnectAttempts: 10,
    reconnectInterval: (attemptNumber) =>
      Math.min(1000 * 2 ** attemptNumber, 30000),
    shouldReconnect: () => true,
  }
);
```

**State management:** Zustand (lightweight) or React Context is sufficient for a single-user
dashboard. Redux is overkill. Store the last received signal state per symbol in a map keyed
by symbol string.

---

## Data Flow

### Real-Time Signal Flow (hot path)

```
Binance WS stream          yfinance poll
      │                         │
      ▼                         ▼
 on_binance_kline()       poll_yfinance()
 (every 250ms,            (every 60s, async
  asyncio task)            coroutine)
      │                         │
      └───────────┬─────────────┘
                  ▼
          normalize_to_OHLCVBar()
          (filter: is_closed == True)
                  │
                  ▼
         strategy_engine.on_bar(bar)
         ├── update deque
         ├── recalculate EMA20
         ├── detect/update IFVG state
         ├── detect/update CISD level
         └── evaluate combined signal
                  │
                  ▼
         connection_manager.broadcast_json(signal_update)
                  │
                  ▼
         Browser WebSocket
                  │
                  ▼
         useWebSocket hook → Zustand store → React re-render
```

**Latency profile:**
- Crypto (Binance): ~250ms from close of candle to signal update in browser
- Stocks (yfinance): ~60-90s from close of candle to signal update (polling interval)
  This is acceptable for a 1-minute bar strategy; the signal is only valid at bar close anyway.

### Paper Trade Flow (cold path)

```
User clicks "Open Trade" in UI
      │
      ▼
POST /paper-trades (REST, with JWT)
      │
      ▼
PaperTradeService.open_trade(symbol, direction, entry, stop, target)
      │
      ▼
aiosqlite INSERT → paper_trades table
      │
      ▼
200 OK → UI updates via REST response (no WS needed)
```

### Authentication Flow

```
User enters credentials on LoginPage
      │
      ▼
POST /auth/login
      │
      ▼
Verify against env var DASHBOARD_PASSWORD (hashed, no DB needed for single user)
      │
      ▼
Return JWT (signed, 24h expiry)
      │
      ▼
Frontend stores in localStorage
      │
      ├── WebSocket: wss://host/ws?token=<jwt>
      └── REST: Authorization: Bearer <jwt>
```

**Single-user auth simplification:** No user table needed. Store the hashed password as an
environment variable (`DASHBOARD_PASSWORD_HASH`). On login, compare bcrypt hash. Issue a
standard JWT with `sub: "dashboard_user"`. This eliminates user management complexity entirely.

### Startup / State Reconstruction Flow

```
FastAPI lifespan(app) starts
      │
      ▼
For each tracked symbol:
  1. Fetch last 50 1-minute bars from yfinance (historical backfill)
  2. Feed each bar through strategy_engine.on_bar() to warm up indicator state
  3. Mark asset as "ready"
      │
      ▼
Start asyncio background tasks:
  - asyncio.create_task(run_binance_ws())   ← per crypto symbol
  - asyncio.create_task(run_yfinance_poll()) ← covers all stock symbols
      │
      ▼
FastAPI begins accepting connections
```

**Why backfill on startup:** EMA(20) requires 20 prior bars to be meaningful. IFVG state requires
scanning recent bars for imbalance zones. Without backfill, the first 20 minutes after server
start produce garbage signals.

---

## WebSocket Connection Lifecycle

This is the most failure-prone part of the system. Address it explicitly.

### Server Side

```
Client connects to /ws?token=<jwt>
      │
      ▼
Validate JWT (reject with 1008 if invalid/expired)
      │
      ▼
connection_manager.connect(websocket)
      │
      ▼
Send snapshot of current state for all assets immediately
(client should not need to wait for next bar close to see state)
      │
      ▼
Enter receive loop:
  try:
    while True:
      data = await websocket.receive_text()
      # Handle ping frames or client commands if needed
  except WebSocketDisconnect:
      connection_manager.disconnect(websocket)
```

**Critical:** The server must send an immediate state snapshot on connect. If the user opens
the dashboard mid-session, they need to see the current signal state, not wait up to 60 seconds
for the next bar.

### Client Side

```
useWebSocket connects with token in query param
      │
      ▼
On open: request snapshot (or receive automatic snapshot from server)
      │
      ├── On message: parse JSON, update Zustand store
      │
      ├── On close: reconnect with exponential backoff (react-use-websocket handles this)
      │
      └── On JWT expiry: catch 1008 close code, redirect to login
```

**JWT expiry on WebSocket:** When the server detects an expired token on reconnect, it closes
with code 1008 (policy violation). The client should treat code 1008 specifically as "session
expired" and redirect to login rather than attempting to reconnect with the same token.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Blocking asyncio with yfinance

**What goes wrong:** `yfinance.download()` is synchronous. Calling it directly in an async
function blocks the entire event loop, freezing all WebSocket sends and other async tasks.

**Instead:** Wrap with `asyncio.to_thread()`:
```python
bars = await asyncio.to_thread(
    yf.download, symbol, period="1d", interval="1m", progress=False
)
```

### Anti-Pattern 2: Recalculating indicators from scratch on every bar

**What goes wrong:** Fetching N bars and recalculating EMA/IFVG from scratch every 60 seconds
is wasteful and introduces latency. On server startup under load (10+ symbols), this causes
slow startup times.

**Instead:** Maintain `AssetState` in memory. Only compute the incremental update for the new bar.
Use `deque(maxlen=50)` as the rolling window — appending a new bar automatically drops the oldest.

### Anti-Pattern 3: Using in-process WebSocket for multi-process deployments

**What goes wrong:** ConnectionManager stores connections in-memory. On Render free tier this is
fine (single process). If you ever horizontally scale, clients on different processes cannot
receive broadcasts from each other.

**Not a concern for v1** (single free-tier instance), but document it. If scaling ever matters,
the solution is Redis pub/sub as a message bus between processes.

### Anti-Pattern 4: Storing live bar data in SQLite

**What goes wrong:** Writing every 1-minute bar to SQLite for 10 symbols at 390 bars/day creates
~4000 writes/day — not a problem for SQLite per se, but adds unnecessary complexity. Historical
data is already available on-demand from yfinance.

**Instead:** Keep live data in-memory only. Store only trade records and backtest results.

### Anti-Pattern 5: Reconnecting Binance WebSocket with a sleep loop

**What goes wrong:** `while True: connect(); sleep(5)` does not implement backoff and will
hammer Binance with reconnection attempts after a disconnect, potentially triggering IP bans.

**Instead:** Use `python-binance`'s built-in reconnection logic (exponential backoff, max 5
retries) or implement backoff manually with `asyncio.sleep(min(2**attempt, 60))`.

### Anti-Pattern 6: Sending full historical data over WebSocket on every bar

**What goes wrong:** Transmitting the full OHLCV history array every minute bloats bandwidth
and causes unnecessary React re-renders.

**Instead:** Use delta updates over WebSocket — send only the new/updated bar in each message.
The browser maintains its own local bar array, appending new bars as they arrive. Historical
data is fetched once via REST on page load.

---

## Suggested Build Order

Dependencies between components determine this order. Each layer must exist before the one
above it can be built.

```
Phase 1: Foundation
  └── FastAPI project scaffold + JWT auth (REST only, no WS yet)
      └── Depends on: nothing

Phase 2: Data Ingest
  └── yfinance poller + Binance WS client (logs bars to console, no engine yet)
      └── Depends on: Phase 1 (app instance, lifespan)

Phase 3: Strategy Engine
  └── AssetState + IFVG/CISD/EMA logic (unit-testable in isolation)
      └── Depends on: Phase 2 (OHLCVBar format)

Phase 4: WebSocket Layer
  └── ConnectionManager + /ws endpoint + broadcast on bar close
      └── Depends on: Phase 3 (signal output), Phase 1 (JWT auth)

Phase 5: SQLite + Paper Trading
  └── aiosqlite setup + paper trade REST endpoints
      └── Depends on: Phase 1 (REST patterns)

Phase 6: React Frontend
  └── Signal panel + WebSocket hook + chart + paper trade UI
      └── Depends on: Phases 1-5 (all endpoints working)

Phase 7: Deployment
  └── Render (backend) + Vercel (frontend) + CORS + production config
      └── Depends on: Phase 6 (fully working local system)
```

**Critical path:** The strategy engine (Phase 3) is the hardest component to get right. It
should be built and fully tested with a mock bar feed before any WebSocket or frontend work
begins. A broken strategy engine invalidates everything downstream.

---

## Scalability Considerations (for reference, not for v1)

| Concern | At 1 user (v1) | At 10 users | At 100+ users |
|---------|----------------|-------------|---------------|
| WS connections | In-memory set, trivial | Still in-memory, fine | Redis pub/sub needed |
| DB | SQLite, single writer | SQLite okay | PostgreSQL |
| Data ingest | Single asyncio task | Same, fan-out to more WS clients | Same |
| Strategy engine | In-memory per asset | Same | Potentially offload to workers |
| Auth | Single user, env var | User table in DB | Full auth service |

For v1 (single user, free tier), none of this matters. Document it here so architectural
decisions now do not accidentally foreclose future options.

---

## Sources

- FastAPI WebSocket official docs: https://fastapi.tiangolo.com/advanced/websockets/
- FastAPI WebSocket + background tasks: https://hexshift.medium.com/implementing-background-tasks-with-websockets-in-fastapi-034cdf803430
- FastAPI WebSocket JWT auth: https://hexshift.medium.com/authenticating-websocket-clients-in-fastapi-with-jwt-and-dependency-injection-d636d48fdf48
- WebSocket + asyncio fan-out: https://websockets.readthedocs.io/en/stable/reference/asyncio/server.html
- react-use-websocket library: https://github.com/robtaussig/react-use-websocket
- aiosqlite: https://aiosqlite.omnilib.dev/en/stable/
- Binance WebSocket kline stream: https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams
- python-binance WebSocket: https://python-binance.readthedocs.io/en/latest/websockets.html
- FastAPI lifespan pattern: https://dev.turmansolutions.ai/2025/09/27/understanding-fastapis-lifespan-events-proper-initialization-and-shutdown/
- yfinance polling pattern: https://www.khueapps.com/blog/article/generating-real-time-trading-signals-with-yfinance-and-python
- Real-time WebSocket patterns 2025: https://blog.greeden.me/en/2025/10/28/weaponizing-real-time-websocket-sse-notifications-with-fastapi-connection-management-rooms-reconnection-scale-out-and-observability/
