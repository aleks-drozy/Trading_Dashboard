# Phase 1: Foundation + Strategy Engine - Research

**Researched:** 2026-03-16
**Domain:** FastAPI backend, JWT auth, SQLite persistence, yfinance polling, Binance WebSocket, IFVG/CISD/EMA strategy engine
**Confidence:** HIGH (core stack), MEDIUM (IFVG/CISD algorithm specifics — Pine source is the specification)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **PineScript source:** `FYP_BOT_1_3.pine` must be committed to `docs/reference/` as Task 1 before any strategy engine work begins. The Pine source is the strict specification — any ambiguity in Python logic is resolved by reading the Pine source, not by researcher interpretation. No creative interpretation of strategy rules is permitted.
- **TradingView validation:** Reference data is a CSV exported from TradingView (timestamp, open, high, low, close, volume, IFVG state, CISD state, EMA value per bar). CSV covers at least one US stock symbol and one crypto symbol, minimum 2 weeks of 1-minute bars. CSV lives in `tests/fixtures/`. Planner must include a task to export this CSV as a prerequisite before strategy engine tests are written.
- **Watchlist persistence:** SQLite (not in-memory, not JSON file). Abstracted behind a repository layer (thin repository class per model — keeps routes clean, consistent with Phase 2 paper trades). Database is seeded with defaults: SPY (stock) + BTCUSDT (crypto).
- **Auth credentials:** Single user: `ADMIN_EMAIL` + `ADMIN_PASSWORD_HASH` (bcrypt) stored in `.env`. No users table — credentials are env vars, not database rows. JWT access token expiry: 8 hours. Token stored in localStorage on the frontend (persists across browser refresh — satisfies AUTH-02). Phase 1 delivers backend `/auth/login` endpoint only — no React login page (that's Phase 2).
- **Libraries (pre-build decisions):**
  - JWT: PyJWT 2.8+ (NOT python-jose — abandoned library)
  - Technical indicators: pandas-ta (NOT TA-Lib — C binary unreliable on Render)
- **Lookahead bias guardrail:** Strategy engine must only process closed bars (`df.iloc[:-1]`). Unit tests must confirm no lookahead bias before Phase 2 begins.
- **Pre-build decisions from STATE.md:**
  - Do NOT use `python-jose` — abandoned, use PyJWT 2.8+ instead
  - Do NOT use TA-Lib — C binary compilation unreliable on Render; use pandas-ta (pure Python)
  - Strategy engine must be validated bar-by-bar against TradingView output BEFORE any UI or WebSocket work begins
  - SQLite persistence decision needed before Phase 2 — three options: accept ephemeral, add export endpoint, or add Render Persistent Disk ($1/month)

### Claude's Discretion

- FastAPI project structure and directory layout
- SQLite schema design (tables, column names)
- Exact bcrypt rounds for password hashing
- Error handling and HTTP status codes for auth failures
- Binance WebSocket reconnection implementation details (beyond the 23-hour proactive schedule)
- yfinance polling interval and retry logic

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTH-01 | User can log in with email and password | FastAPI OAuth2PasswordBearer + PyJWT encode/decode + bcrypt verify |
| AUTH-02 | User session persists across browser refresh (JWT) | 8-hour JWT stored in localStorage; decode on every protected request |
| AUTH-03 | User can log out from any page | Stateless JWT — logout is client-side token deletion; backend `/auth/logout` returns 200 (no server state to clear) |
| DATA-01 | Backend fetches 1-minute OHLCV bars for US stock symbols via yfinance | `yf.Ticker(symbol).history(period="1d", interval="1m")` polled every 60 s in FastAPI lifespan background task |
| DATA-02 | Backend streams 1-minute crypto bars from Binance WebSocket | python-binance 1.0.35 AsyncClient + BinanceSocketManager kline_socket with kline_is_closed guard |
| DATA-03 | Data layer validates bar recency and handles stale/missing data gracefully | Recency check: reject bars older than 90 s; return last-known state if feed silent |
| DATA-04 | Backend auto-reconnects to Binance WebSocket on drop (including 24-hour forced disconnect) | Built-in 5-retry backoff + proactive 23-hour asyncio task restart |
| ASSET-01 | User can add symbols (stocks and crypto pairs) to their watchlist via the API | SQLModel WatchlistSymbol table + POST /watchlist endpoint + repository layer |
| ASSET-02 | User can remove symbols from the watchlist | DELETE /watchlist/{symbol} endpoint + repository layer |
</phase_requirements>

---

## Summary

Phase 1 builds the entire Python backend in isolation — no frontend. The stack is FastAPI + SQLModel/SQLite + PyJWT + bcrypt (direct) + pandas-ta + python-binance + yfinance. All of these are battle-tested, pure-Python, and Render-compatible.

The strategy engine is the highest-risk deliverable. IFVG and CISD algorithms must be extracted verbatim from `FYP_BOT_1_3.pine` and implemented in Python bar-by-bar. EMA can use pandas-ta with `adjust=False` to match TradingView, but requires a warmup buffer of at least 100 bars before the strategy window begins to avoid seeding divergence. The TradingView CSV fixture must be produced before strategy tests are written — the fixture is the source of truth, not any interpretation of the algorithm.

Data infrastructure has two distinct patterns: yfinance is a REST poll (run every 60 seconds in a background asyncio task, fetch `period="1d", interval="1m"`, slice to the last closed bar), while Binance is a persistent WebSocket stream. Binance enforces a hard 24-hour connection drop; the implementation must schedule a proactive reconnect at 23 hours and layer the library's built-in 5-retry exponential backoff on top for crash recovery.

**Primary recommendation:** Implement in strict sequence: scaffold + config → auth → database + watchlist CRUD → data feeds → strategy engine → validation tests. Do not write strategy code until the Pine source is committed and TradingView fixture CSV is in `tests/fixtures/`.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| fastapi | 0.115+ | ASGI web framework + routing | De-facto Python API standard; async-native |
| uvicorn | 0.30+ | ASGI server | FastAPI's standard server; supports lifespan |
| sqlmodel | 0.0.21+ | ORM combining SQLAlchemy + Pydantic | Recommended by FastAPI author; eliminates model duplication |
| PyJWT | 2.12.1 | JWT encode/decode | Actively maintained (released 2026-03-13); locked decision — not python-jose |
| bcrypt | 4.2+ | Password hashing | Direct library use; avoids passlib (abandoned, fails Python 3.13) |
| pydantic-settings | 2.x | `.env` → typed settings | Official Pydantic v2 settings management |
| python-dotenv | 1.x | Load `.env` for pydantic-settings | Companion to pydantic-settings |
| python-binance | 1.0.35 | Binance WebSocket kline streams | AsyncClient + BinanceSocketManager; reconnect support; updated 2026-02-16 |
| yfinance | 0.2.50+ | US stock 1-minute OHLCV bars | Only free source for Yahoo Finance intraday; pure Python |
| pandas | 2.x | DataFrame operations for strategy | Required by yfinance and pandas-ta |
| pandas-ta | 0.4.71b0 | EMA calculation | Pure Python; locked decision — not TA-Lib; Python >=3.12 required |
| pytest | 8.x | Test framework | Standard; TestClient integration |
| httpx | 0.27+ | Async HTTP client for TestClient | Required by FastAPI test suite |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest-asyncio | 0.23+ | Async test support | Required for testing async routes and data feed mocks |
| python-multipart | 0.0.9+ | Form data parsing | Required for OAuth2PasswordRequestForm (login form) |
| aiofiles | 23.x | Async file I/O | Optional — only if streaming CSV fixtures |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bcrypt direct | passlib | passlib is abandoned — fails on Python 3.11+ crypt deprecation; bcrypt direct is cleaner |
| passlib | pwdlib[argon2] | pwdlib is FastAPI's new recommendation; Argon2 is stronger but bcrypt is already decided via env hash |
| pandas-ta | TA-Lib | TA-Lib requires C compilation — unreliable on Render; locked decision |
| PyJWT | python-jose | python-jose is abandoned; locked decision |
| SQLModel | SQLAlchemy + Pydantic separately | SQLModel reduces duplication; same author as FastAPI; fits Phase 2 extension |

**Installation:**
```bash
pip install fastapi uvicorn[standard] sqlmodel pyjwt bcrypt pydantic-settings python-dotenv \
            python-binance yfinance pandas pandas-ta pytest httpx pytest-asyncio python-multipart
```

---

## Architecture Patterns

### Recommended Project Structure

```
trading-dashboard/
├── backend/
│   ├── main.py                  # FastAPI app, lifespan, router registration
│   ├── config.py                # pydantic-settings BaseSettings, loads .env
│   ├── dependencies.py          # Shared FastAPI Depends: get_db, get_current_user
│   ├── auth/
│   │   ├── router.py            # POST /auth/login, POST /auth/logout
│   │   └── service.py           # verify_password, create_access_token
│   ├── watchlist/
│   │   ├── router.py            # GET/POST/DELETE /watchlist
│   │   ├── models.py            # SQLModel WatchlistSymbol table model
│   │   └── repository.py        # WatchlistRepository: add, remove, get_all
│   ├── data/
│   │   ├── yfinance_feed.py     # poll_yfinance() — runs every 60 s in background
│   │   ├── binance_feed.py      # BinanceFeed class — AsyncClient + kline_socket
│   │   └── bar_store.py         # In-memory dict: symbol → list[Bar] (recent bars)
│   ├── strategy/
│   │   ├── engine.py            # StrategyEngine.run(df) → StrategyResult
│   │   ├── ifvg.py              # compute_ifvg(df) — extracted from Pine
│   │   ├── cisd.py              # compute_cisd(df) — extracted from Pine
│   │   └── ema.py               # compute_ema(df, period=20) — pandas-ta wrapper
│   └── database.py              # SQLModel engine, create_db_and_tables, get_session
├── tests/
│   ├── conftest.py              # Shared fixtures: test app, test db, test client
│   ├── fixtures/                # TradingView reference CSVs
│   │   ├── spy_1min_tv_reference.csv
│   │   └── btcusdt_1min_tv_reference.csv
│   ├── test_auth.py
│   ├── test_watchlist.py
│   └── test_strategy/
│       ├── test_ifvg.py
│       ├── test_cisd.py
│       └── test_ema.py
├── docs/
│   └── reference/
│       └── FYP_BOT_1_3.pine     # Pine source — committed as Task 1
├── .env                         # ADMIN_EMAIL, ADMIN_PASSWORD_HASH, SECRET_KEY, etc.
├── .env.example
└── requirements.txt
```

### Pattern 1: FastAPI Lifespan for Background Tasks

**What:** Start long-running asyncio tasks (Binance WebSocket, yfinance poller) inside a lifespan context manager, not `on_event()` (deprecated).

**When to use:** Any background work that must start at app startup and stop cleanly at shutdown.

```python
# Source: https://fastapi.tiangolo.com/advanced/events/
from contextlib import asynccontextmanager
import asyncio
from fastapi import FastAPI

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    binance_task = asyncio.create_task(binance_feed.run())
    yfinance_task = asyncio.create_task(poll_yfinance_loop())
    yield
    # Shutdown
    binance_task.cancel()
    yfinance_task.cancel()
    await asyncio.gather(binance_task, yfinance_task, return_exceptions=True)

app = FastAPI(lifespan=lifespan)
```

### Pattern 2: PyJWT Auth with bcrypt Direct

**What:** Login endpoint verifies bcrypt hash from env, issues 8-hour JWT. Protected routes decode Bearer token via Depends.

**When to use:** All `/watchlist` routes and any future protected endpoints.

```python
# Source: https://pyjwt.readthedocs.io/en/2.8.0/usage.html
import jwt
import bcrypt
from datetime import datetime, timezone, timedelta

SECRET_KEY = settings.secret_key
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 8

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def create_access_token(sub: str) -> str:
    payload = {
        "sub": sub,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
```

### Pattern 3: SQLModel Repository Layer

**What:** Thin repository class wraps all DB operations. Router calls repository, never touches session directly.

**When to use:** Watchlist CRUD (and extended for Phase 2 paper trades).

```python
# Source: https://sqlmodel.tiangolo.com/tutorial/fastapi/
from sqlmodel import Session, select
from backend.watchlist.models import WatchlistSymbol

class WatchlistRepository:
    def __init__(self, session: Session):
        self.session = session

    def get_all(self) -> list[WatchlistSymbol]:
        return self.session.exec(select(WatchlistSymbol)).all()

    def add(self, symbol: str, asset_type: str) -> WatchlistSymbol:
        row = WatchlistSymbol(symbol=symbol.upper(), asset_type=asset_type)
        self.session.add(row)
        self.session.commit()
        self.session.refresh(row)
        return row

    def remove(self, symbol: str) -> bool:
        row = self.session.exec(
            select(WatchlistSymbol).where(WatchlistSymbol.symbol == symbol.upper())
        ).first()
        if not row:
            return False
        self.session.delete(row)
        self.session.commit()
        return True
```

### Pattern 4: Binance WebSocket with Proactive 23-Hour Restart

**What:** Binance enforces a hard 24-hour disconnect on all streams. The library's 5-retry backoff handles unexpected drops but does NOT reschedule after the forced drop. A proactive 23-hour restart avoids the hard cut.

**When to use:** Always — this is the correct Binance stream lifecycle pattern.

```python
# Source: https://python-binance.readthedocs.io/en/latest/websockets.html
import asyncio
from binance import AsyncClient, BinanceSocketManager

RECONNECT_INTERVAL_SECONDS = 23 * 3600  # 23 hours — proactive before Binance's 24h cut

class BinanceFeed:
    async def run(self):
        while True:  # outer loop for 23-hour proactive restart
            client = await AsyncClient.create(api_key=None, api_secret=None)
            bm = BinanceSocketManager(client)
            async with bm.kline_socket("BTCUSDT", interval="1m") as stream:
                deadline = asyncio.get_event_loop().time() + RECONNECT_INTERVAL_SECONDS
                while asyncio.get_event_loop().time() < deadline:
                    msg = await stream.recv()
                    if msg.get("e") == "error":
                        break  # triggers outer loop restart
                    kline = msg["k"]
                    if kline["x"]:  # x == True means bar is closed
                        self._on_closed_bar(kline)
            await client.close_connection()
            # brief pause before reconnect
            await asyncio.sleep(1)
```

### Pattern 5: EMA Matching TradingView

**What:** TradingView EMA uses `adjust=False` (recursive formula). pandas-ta defaults match this, but diverge from TradingView for the first `period` bars depending on seeding. Provide a warmup buffer of at least 3× the period (60+ bars for a 20-EMA) before the strategy window.

**When to use:** Any EMA calculation that must be validated against TradingView bar-by-bar.

```python
# Source: https://github.com/twopirllc/pandas-ta (Issue #519 analysis)
import pandas_ta as ta

def compute_ema(df: pd.DataFrame, period: int = 20) -> pd.Series:
    # pandas-ta ema() uses adjust=False by default, matching TradingView's recursive EMA.
    # Provide at least 3*period bars as warmup before the comparison window starts.
    return df.ta.ema(length=period)
    # After computing, discard the first (period - 1) bars in comparisons:
    # valid_from_index = period - 1
```

### Anti-Patterns to Avoid

- **Accessing `df.iloc[-1]` in strategy engine:** The current (open) bar is incomplete. Always slice with `df.iloc[:-1]` before running strategy logic. Lookahead bias produces optimistic test results that collapse in production.
- **Using `on_event()` decorator for startup/shutdown:** Deprecated in FastAPI. Use the lifespan context manager pattern.
- **Running yfinance inside a request handler:** yfinance HTTP calls block the event loop if called without `asyncio.to_thread`. Always run in the background poller, never in a route.
- **Storing `ADMIN_PASSWORD_HASH` as plaintext:** The `.env` must store the bcrypt hash, not the raw password. Hash generation is a one-time offline step before deployment.
- **Comparing EMA from bar 0:** EMA seeds diverge for the first ~20 bars depending on implementation. Compare only from bar 60+ (3× period warmup) in TradingView validation tests.
- **Encoding JWT algorithm dynamically from token header:** Hard-code `algorithms=["HS256"]` in `jwt.decode()` — never derive from token data (security vulnerability).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT encode/decode + expiry | Custom token format | PyJWT 2.12.1 | Handles exp, iat, nbf, signature verification, error types |
| Password hashing + constant-time compare | Custom hash function | bcrypt direct (`bcrypt.hashpw`, `bcrypt.checkpw`) | Timing-safe comparison; work factor tunable |
| EMA calculation | Rolling mean loop | pandas-ta `df.ta.ema(length=20)` | adjust=False, matches TradingView; handles NaN seeding |
| Env var loading + type validation | `os.getenv()` everywhere | pydantic-settings BaseSettings | Type coercion, validation, `.env` file, `@lru_cache` |
| Binance reconnection logic | Manual socket retry loop | python-binance BinanceSocketManager | Built-in 5-retry exponential backoff; async context manager |
| SQLite session lifecycle | Manual `conn.close()` | SQLModel `Session` with `yield` dependency | Clean per-request sessions; works with dependency override in tests |

**Key insight:** The strategy engine (IFVG, CISD logic) is the one area where there is no suitable library — it must be implemented from the Pine source. Everything else in this phase has a well-maintained library solution.

---

## Common Pitfalls

### Pitfall 1: Lookahead Bias in Strategy Engine

**What goes wrong:** Strategy reads `df.iloc[-1]` (current open bar), computes a signal, and a test with historical data appears to match TradingView — but live signals fire one bar early.

**Why it happens:** The in-progress bar is included in the DataFrame before it closes.

**How to avoid:** Enforce `df = df.iloc[:-1]` as the first line of `StrategyEngine.run()`. Add a unit test that passes a DataFrame where the last bar is artificial and asserts the strategy result does not change when that bar changes.

**Warning signs:** TradingView CSV test passes but signals appear one bar ahead when compared bar-by-bar.

### Pitfall 2: EMA Seed Divergence vs TradingView

**What goes wrong:** Python EMA matches for bars 50+, but the first 20-50 bars show divergence. Bar-by-bar diff fails at the start of the fixture CSV.

**Why it happens:** TradingView uses a specific seed for the first EMA value (typically SMA of the first N bars). pandas-ta matches this with enough warmup bars, but if the CSV starts at bar 0, the first ~20 values will differ.

**How to avoid:** Export the TradingView fixture CSV with at least 100 bars of pre-history before the comparison window. Skip the first `max(60, 3 * period)` rows in bar-by-bar diff assertions.

**Warning signs:** Diff fails only on early rows; later rows match perfectly.

### Pitfall 3: Binance 24-Hour Hard Disconnect Not Handled

**What goes wrong:** The stream silently dies at hour 24. The background task believes it is still running. No new bars arrive. No error is logged.

**Why it happens:** Binance closes the connection server-side. The library's 5-retry backoff fires but cannot reconnect because the closure is intentional, not a network error.

**How to avoid:** Proactive 23-hour restart (outer `while True` loop as shown in Pattern 4). Add a watchdog: if no bar arrives for >3 minutes during market hours, log an error and force reconnect.

**Warning signs:** Crypto signals stop updating while stock signals continue; last bar timestamp is exactly 23-24 hours ago.

### Pitfall 4: yfinance Rate Limiting / Silent Empty Response

**What goes wrong:** `yf.Ticker(symbol).history(period="1d", interval="1m")` returns an empty DataFrame silently during high-traffic periods or after rapid polling.

**Why it happens:** Yahoo Finance rate-limits the unofficial API (used by yfinance). No exception is raised — an empty DataFrame is returned.

**How to avoid:** Check `len(df) == 0` after every fetch. Log a warning, retain last-known bars. Implement a 60-second minimum poll interval. Do not poll more than one symbol per call — use sequential polling with a 1–2 second delay between symbols.

**Warning signs:** Stock signals stop updating; no exception logged; bars DataFrame empty.

### Pitfall 5: passlib Breaking on Python 3.12/3.13

**What goes wrong:** `from passlib.context import CryptContext` raises a `DeprecationWarning` on Python 3.11 and an `ImportError` on Python 3.13 because the underlying `crypt` module was removed.

**Why it happens:** passlib has not been maintained since ~2022 and depends on the now-removed `crypt` stdlib module.

**How to avoid:** Use `bcrypt` directly (no passlib). The ADMIN_PASSWORD_HASH in `.env` is generated once offline:
```python
import bcrypt
hash = bcrypt.hashpw(b"your-password", bcrypt.gensalt(rounds=12)).decode()
```
Verify at login: `bcrypt.checkpw(plain.encode(), stored_hash.encode())`.

**Warning signs:** Import errors or deprecation warnings when starting the FastAPI app.

### Pitfall 6: Pine → Python Algorithm Misinterpretation

**What goes wrong:** Developer interprets IFVG expiry or CISD flip condition from documentation summaries or blog posts instead of the Pine source, producing subtly wrong bar-by-bar output.

**Why it happens:** IFVG and CISD definitions vary across ICT community sources. The exact conditions (bar index boundaries, overlap thresholds, expiry triggers) differ per implementation.

**How to avoid:** Read `FYP_BOT_1_3.pine` line by line before writing any Python. Extract the exact condition expressions and translate them verbatim. When in doubt, the Pine expression is the truth, not any English description.

**Warning signs:** Test passes for 90% of bars but fails on edge cases involving IFVG expiry transitions or direction changes.

---

## Code Examples

Verified patterns from official sources:

### pydantic-settings Config Pattern

```python
# Source: https://fastapi.tiangolo.com/advanced/settings/
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    admin_email: str
    admin_password_hash: str
    secret_key: str
    database_url: str = "sqlite:///./trading.db"

    model_config = SettingsConfigDict(env_file=".env")

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

### SQLModel Database Setup

```python
# Source: https://fastapi.tiangolo.com/tutorial/sql-databases/
from sqlmodel import SQLModel, create_engine, Session

engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
```

### WatchlistSymbol Model

```python
from sqlmodel import SQLModel, Field
from typing import Optional

class WatchlistSymbol(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True, unique=True)
    asset_type: str  # "stock" | "crypto"
```

### yfinance Closed-Bar Fetch

```python
# Source: https://ranaroussi.github.io/yfinance/
import yfinance as yf
import pandas as pd

def fetch_closed_bars(symbol: str, interval: str = "1m") -> pd.DataFrame:
    """Fetch the last day of 1-minute bars, return only closed bars."""
    df = yf.Ticker(symbol).history(period="1d", interval=interval)
    if df.empty:
        return df
    # Drop the current (open) bar — it is not closed yet
    df = df.iloc[:-1]
    df.index = df.index.tz_convert("UTC")
    return df
```

### pytest Dependency Override for DB

```python
# Source: https://sqlmodel.tiangolo.com/tutorial/fastapi/tests/
from sqlmodel import SQLModel, create_engine, Session, StaticPool
from fastapi.testclient import TestClient
from backend.main import app
from backend.database import get_session
import pytest

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `on_event("startup")` decorator | `lifespan` context manager | FastAPI 0.93 (2023) | `on_event` is deprecated; lifespan required for background tasks |
| passlib + CryptContext | bcrypt direct or pwdlib | 2023 (passlib abandoned) | passlib fails on Python 3.13; use bcrypt directly |
| python-jose for JWT | PyJWT 2.x | 2022 (python-jose abandoned) | python-jose has unpatched CVEs; PyJWT 2.12.1 is current |
| TA-Lib for indicators | pandas-ta (pure Python) | Pre-build decision | TA-Lib C compilation breaks on Render; pandas-ta is drop-in |
| `app.add_event_handler()` | `lifespan` context manager | FastAPI 0.93 | Same as on_event deprecation |

**Deprecated/outdated:**
- `python-jose`: Abandoned. Not maintained. Use PyJWT.
- `passlib`: Abandoned. Fails on Python 3.12+ with crypt deprecation. Use bcrypt directly.
- `TA-Lib`: Requires C binary. Fails on Render free tier. Use pandas-ta.
- FastAPI `on_event()`: Deprecated. Use `lifespan`.

---

## Open Questions

1. **Exact IFVG expiry condition**
   - What we know: IFVG expires when price closes beyond the gap boundary (Bullish IFVG expires when price closes below gap low; Bearish IFVG when price closes above gap high). The 50% consequent encroachment level is the key midpoint.
   - What's unclear: The exact Pine expression for expiry in `FYP_BOT_1_3.pine` — does it use close, high, or low for the expiry check? Does it track "touched" vs "filled"?
   - Recommendation: This is resolved in Task 1 — read Pine source line by line. Do not code IFVG until Pine source is read.

2. **CISD structure-flip definition in the Pine source**
   - What we know: General ICT definition is a close beyond the open of a prior opposite-direction run. Multiple community sources define it slightly differently.
   - What's unclear: The exact bar-index boundaries and which prior candle's open is used as the flip level in this specific Pine script.
   - Recommendation: Same as above — Pine source is specification. Extract verbatim.

3. **yfinance data during pre-market / post-market**
   - What we know: 1-minute data is available for US market hours. Behavior outside regular hours (9:30–16:00 ET) may include sparse bars or empty responses.
   - What's unclear: Whether `prepost=False` (default) reliably excludes pre/post bars or whether the strategy engine needs to filter by time.
   - Recommendation: Add a market-hours filter: only process bars between 09:30 and 16:00 ET. Implement in `fetch_closed_bars()`.

4. **SQLite on Render ephemeral filesystem**
   - What we know: Render's free tier uses an ephemeral filesystem — SQLite data is lost on each deploy/restart. STATE.md lists three options: accept ephemeral, add export endpoint, or add Render Persistent Disk ($1/month).
   - What's unclear: Which option will be chosen.
   - Recommendation: This is a Phase 2 deployment concern. For Phase 1, accept ephemeral + re-seed defaults on startup. Log a warning on first run if DB is empty.

---

## Sources

### Primary (HIGH confidence)

- [FastAPI official docs — lifespan events](https://fastapi.tiangolo.com/advanced/events/) — lifespan pattern, background task management
- [FastAPI official docs — SQL databases](https://fastapi.tiangolo.com/tutorial/sql-databases/) — SQLModel setup, session dependency
- [FastAPI official docs — OAuth2 + JWT](https://fastapi.tiangolo.com/tutorial/security/oauth2-jwt/) — complete auth flow, PyJWT usage, pwdlib (confirms passlib migration)
- [FastAPI official docs — settings](https://fastapi.tiangolo.com/advanced/settings/) — pydantic-settings pattern, lru_cache
- [PyJWT 2.8.0 usage docs](https://pyjwt.readthedocs.io/en/2.8.0/usage.html) — encode/decode, exp claim, ExpiredSignatureError
- [PyJWT 2.12.1 PyPI page](https://pypi.org/project/PyJWT/) — version 2.12.1 confirmed, released 2026-03-13
- [python-binance 1.0.35 docs](https://python-binance.readthedocs.io/en/latest/websockets.html) — AsyncClient + BinanceSocketManager kline_socket, 5-retry backoff
- [python-binance PyPI](https://pypi.org/project/python-binance/) — version 1.0.35, released 2026-02-16
- [pandas-ta PyPI](https://pypi.org/project/pandas-ta/) — version 0.4.71b0, Python >=3.12, active maintenance
- [SQLModel testing docs](https://sqlmodel.tiangolo.com/tutorial/fastapi/tests/) — StaticPool in-memory SQLite for tests, dependency override pattern
- [yfinance GitHub issue #356](https://github.com/ranaroussi/yfinance/issues/356) — 7-day 1m limit confirmed

### Secondary (MEDIUM confidence)

- [Binance developer community — kline WebSocket reliability](https://dev.binance.vision/t/best-way-to-reliabley-use-of-websocket-with-python-kline/11833) — 24-hour disconnect, REST backfill strategy
- [FastAPI discussion #11773 — passlib abandonment](https://github.com/fastapi/fastapi/discussions/11773) — passlib maintenance concerns; bcrypt/pwdlib migration trend
- [yfinance rate limit issue #2422](https://github.com/ranaroussi/yfinance/issues/2422) — silent empty DataFrame on rate limit
- [pandas-ta issue #519 — EMA vs TradingView](https://43.135.153.188/twopirllc/pandas-ta/issues/519) — adjust=False, warmup requirement
- [LuxAlgo CISD indicator definition](https://www.luxalgo.com/library/indicator/change-in-state-of-delivery-cisd/) — CISD conceptual definition; NOT used as code specification (Pine source is authoritative)
- [PineScript Market — IFVG definition](https://pinescriptmarket.com/learn/price-action/inverse-fair-value-gap) — IFVG conceptual definition; NOT used as code specification

### Tertiary (LOW confidence — flagged for validation)

- Community blog posts on IFVG/CISD algorithm details — not used; Pine source is specification
- yfinance rate limit behavior during high-traffic periods — observed by community, not officially documented by Yahoo Finance

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all library versions verified via PyPI and official docs as of 2026-03-16
- Auth pattern: HIGH — FastAPI official docs show exact PyJWT + OAuth2PasswordBearer pattern
- Data feeds: HIGH (Binance structure), MEDIUM (yfinance rate-limit behavior — not officially documented)
- Strategy engine (IFVG/CISD algorithms): LOW until Pine source is read — conceptual definitions only; Pine source is the specification
- EMA/TradingView matching: MEDIUM — adjust=False + warmup principle verified; exact first-bar seeding behavior requires empirical test with fixture CSV
- Architecture patterns: HIGH — FastAPI best practice sources from 2025–2026

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable stack — 30-day estimate; pandas-ta is pre-release/beta, re-check if issues arise)
