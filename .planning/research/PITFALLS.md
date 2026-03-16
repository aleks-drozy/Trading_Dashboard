# Domain Pitfalls

**Domain:** Real-time trading signal dashboard (FastAPI + React + WebSockets + market data APIs)
**Project:** Trading Dashboard — IFVG + CISD + 20-EMA strategy
**Researched:** 2026-03-16

---

## Critical Pitfalls

Mistakes that cause rewrites, silently wrong results, or production-breaking failures.

---

### Pitfall 1: Lookahead Bias — Computing Signals on the Live (Unclosed) Bar

**What goes wrong:**
The strategy computes IFVG zones and CISD levels on the current forming candle. In PineScript, `bar_index[0]` refers to the current live bar that is still ticking. When you re-implement this in Python and run calculations on the last returned bar from yfinance or Binance, that bar is incomplete — its high, low, and close will change until the minute closes. Signals fire on partial data, then "disappear" or shift when the bar closes, creating phantom signals that would never appear on closed-bar logic.

**Why it happens:**
PineScript abstracts this with `barstate.isconfirmed` and `barstate.isrealtime` flags, which developers miss when manually translating logic. Python with pandas has no equivalent automatic protection — you must explicitly drop the last row or mark it as live.

**Consequences:**
- Signals fire mid-candle, then vanish when the bar closes (repainting behavior in live mode)
- Backtests appear better than live results because historical data only shows closed bars
- IFVG formation requires 3 confirmed candles; using a live candle as the third introduces instability

**Prevention:**
- In PineScript, check how the original script uses `barstate.isconfirmed` — use that as the boundary
- In Python, always slice off the last bar when computing signals: `df = df.iloc[:-1]` before strategy logic, then add live-bar display separately
- Maintain two signal states: `confirmed` (last closed bar) and `live` (current forming bar) — display them differently in the UI
- Write unit tests comparing Python output on the same historical OHLC data as TradingView

**Detection (warning signs):**
- Signal shows "Long" then disappears without a new candle arriving
- Backtest signals do not align with manually verified TradingView entries
- Strategy fires more signals in "live" mode than on replay

**Phase to address:** Phase 1 (strategy engine foundation) — this is the most fundamental correctness problem and must be solved before any UI or paper trading work.

---

### Pitfall 2: PineScript-to-Python Logic Translation Bugs (IFVG / CISD)

**What goes wrong:**
PineScript is an implicit time-series language. Every variable is automatically a rolling series indexed backwards from the current bar. Python/pandas requires explicit indexing. The following translations are commonly wrong:

- `nz(x, 0)` in Pine → no equivalent; Python raises or silently returns NaN without explicit `.fillna(0)`
- `ta.ema(close, 20)` in Pine uses a specific initialization (SMA seed for first N bars) → pandas `ewm(span=20)` uses a different default (adjust=True, different starting value) — produces a small but compounding divergence
- `high[1]`, `low[1]` in Pine refers to the *previous bar* → in Python, this is `df['high'].shift(1)`, not `df['high'].iloc[-1]`
- Boolean series in Pine propagate as per-bar states; Python conditions on entire dataframes can silently short-circuit

**Why it happens:**
The IFVG pattern (3-candle imbalance: candle[2] high < candle[0] low) and CISD (structure flip detection) both rely on multi-bar lookback comparisons that are easy to mis-index by one bar.

**Consequences:**
- IFVG zones calculated at wrong price levels
- CISD flips detected one bar early or late, shifting all signal timing
- EMA values diverge from TradingView by 0.01–0.1% across the first 50 bars, compounding over a session

**Prevention:**
- Export the raw PineScript bar-by-bar output (using `plotchar` or `label.new` in Pine to dump values to data window) for a specific date range
- Reproduce the same date range in Python and diff the outputs row-by-row
- For EMA: use `ewm(span=20, adjust=False, min_periods=20)` to match PineScript's behavior
- Treat the Pine source file as the specification; write Python logic as tests against it, not from scratch

**Detection (warning signs):**
- EMA value in Python differs from TradingView by more than 0.01% on bar 50+
- IFVG zones appear at prices not visible on TradingView
- Signal timestamps are off by exactly 1 bar compared to TradingView

**Phase to address:** Phase 1 (strategy engine). Do not build UI on top of unvalidated signal logic.

---

### Pitfall 3: Render Free Tier Sleep Kills WebSocket Connections

**What goes wrong:**
Render's free tier puts the service to sleep after 15 minutes of inactivity. The cold start takes 2–3 minutes. Any WebSocket connection made to the Render backend from the Vercel frontend will hard-fail during this window — the connection upgrade request hits a sleeping process. The frontend will show a blank dashboard or a spinner with no clear error.

**Why it happens:**
WebSocket connections require a live, running process to accept the TCP upgrade. Unlike REST endpoints where a cold start only affects a single request's latency, a sleeping WebSocket server simply cannot be woken up by a WebSocket connection attempt — only an HTTP request triggers the wake-up.

**Consequences:**
- User opens the dashboard during the NY session (9:30–10:30 AM) and sees no data if nobody visited in the last 15 minutes
- Frontend reconnect loops fail silently while Render wakes up, appearing as a permanent outage
- The dashboard's core value (instant signal visibility at session open) is undermined if traders have to wait 2 minutes for a cold start

**Prevention:**
- Implement a keep-alive ping: send a lightweight HTTP GET to the Render health endpoint every 10 minutes using an external cron (cron-job.org free tier, GitHub Actions on schedule, or UptimeRobot free tier)
- Implement the WebSocket connection in the frontend with exponential backoff reconnect (start at 1s, cap at 30s) — so when Render wakes up (after ~2 min), the frontend auto-reconnects without user action
- Show a clear "Reconnecting..." status in the UI rather than blank data during the cold start window
- Design the keep-alive ping to trigger before the NY session opens (e.g., 9:20 AM ET) so the service is warm when it matters

**Detection (warning signs):**
- Dashboard works locally but shows blank data 15 minutes after deployment
- WebSocket connection error appears immediately when first opening the page
- Logs on Render show the process starting up at the same time the frontend reports connection failure

**Phase to address:** Phase 3 or 4 (deployment / infrastructure). Must be documented in the README so it is not forgotten at go-live.

---

### Pitfall 4: yfinance Data Is Unofficial, Rate-Limited, and Occasionally Delayed

**What goes wrong:**
yfinance scrapes Yahoo Finance web endpoints — it is not an official API. Yahoo has progressively tightened limits. In production:
- Rapid polling (e.g., fetching 1-minute bars every 30 seconds for multiple tickers) triggers HTTP 429 errors
- 1-minute intraday data has reported delays of up to 15 minutes in some configurations
- The intraday data endpoint returns only the last 7 days of 1-minute bars — historical backtest data must use daily bars or a different interval
- Yahoo can change the endpoint structure without notice, breaking yfinance silently

**Why it happens:**
The library is community-maintained, reverse-engineered from Yahoo's web interface. Any Yahoo-side change propagates as a breakage with no warning.

**Consequences:**
- Strategy runs on stale data during the NY session without the user knowing
- Burst requests (e.g., switching assets rapidly in the UI) hit rate limits and return empty data frames
- Data silently returns partial bars or NaN rows, which cascade into incorrect signal calculations

**Prevention:**
- Add explicit data validation after every yfinance call: check that the returned dataframe is non-empty, that the last bar timestamp is within an expected recency window (e.g., within 5 minutes of "now" during market hours), and that OHLC values are non-NaN
- Cache the most recently fetched bars in-memory and serve from cache if the new fetch fails or is rate-limited — do not let a fetch failure blank out the UI
- Implement retry with exponential backoff (1s, 2s, 4s) on 429 errors
- For intraday (1m) bars: fetch in a single call at start-of-session, then use Binance WebSocket for crypto and a separate polling strategy for stocks rather than constant yfinance polling
- Do not rely on yfinance for the 60-day+ historical backtest display; fetch that data at build/startup time and store it in SQLite rather than re-fetching on every page load

**Detection (warning signs):**
- `YFRateLimitError` exceptions in logs
- Returned dataframe has fewer rows than expected (e.g., only 5 bars returned for a 30-bar request)
- Last bar timestamp is more than 5 minutes old during live market hours

**Phase to address:** Phase 2 (data feeds integration). Build validation and caching into the data layer from the start, not as a retrofit.

---

### Pitfall 5: Binance WebSocket Silently Drops and Has a Hard 24-Hour Limit

**What goes wrong:**
Binance WebSocket connections have two known disconnection vectors:

1. **Ping/pong timeout**: Binance sends a ping every 20 seconds (Spot). If no pong is returned within 60 seconds, the connection is terminated. Many WebSocket client libraries handle this automatically, but async Python libraries (e.g., `websockets`) require explicit pong handling.

2. **24-hour hard limit**: Binance forcibly closes every WebSocket connection at the 24-hour mark. This is documented and non-negotiable. Sending keep-alive pings does not prevent it. The application must reconnect.

**Why it happens:**
It is a Binance server-side policy. The 24-hour limit catches many developers who test for hours without noticing, then find the production deployment silently stops receiving data overnight.

**Consequences:**
- Crypto price stream stops updating at T+24h with no error message in the UI
- If the disconnect happens during the NY session the next day, the dashboard shows stale crypto prices
- Silent failures are the worst: the UI still shows signal state from the last received message, appearing live when it is not

**Prevention:**
- Track last-received-message timestamp for every WebSocket subscription — if no message in 30 seconds during expected market hours, treat the connection as dead and reconnect
- Implement a reconnect manager: on disconnect (any close code), wait 1 second, then re-establish the stream subscription from scratch
- On reconnect, fetch a REST snapshot of the latest bars to fill any gap before resuming WebSocket updates
- Explicitly schedule a proactive reconnect every 23 hours to prevent the hard-disconnect from occurring mid-session

**Detection (warning signs):**
- Crypto price stops updating while stock prices continue (asymmetric staleness)
- Last message timestamp in backend logs shows a 24-hour gap
- Binance stream connection log shows close code 1000 at exactly T+24h

**Phase to address:** Phase 2 (data feeds). Reconnect logic must be in-scope from day one of Binance integration, not added later.

---

## Moderate Pitfalls

---

### Pitfall 6: React WebSocket Creates Multiple Connections on Re-Render

**What goes wrong:**
If the WebSocket connection is instantiated inside a `useEffect` without a proper dependency array and cleanup, every React re-render that causes the effect to re-run creates a new WebSocket connection. The old connections remain open on the server and on the Binance stream side, leaking resources and receiving duplicate messages.

**Prevention:**
- Use `useRef` to store the WebSocket instance, not `useState`
- The `useEffect` cleanup function must call `ws.close()` explicitly
- Extract the connection into a singleton or custom hook (`useWebSocket`) that is instantiated once at the application root, not per-component
- On the backend, track connected clients in a `ConnectionManager` class with explicit disconnect cleanup using `try/finally` blocks

**Phase to address:** Phase 3 (frontend WebSocket integration).

---

### Pitfall 7: Paper Trading Engine Uses Closed-Bar Fill Prices (Overly Optimistic)

**What goes wrong:**
When a signal fires (e.g., at the close of bar N), the paper trading engine fills the simulated order at the close price of bar N. In practice, you would enter at the open of bar N+1 at best. Filling at the same bar's close introduces a 1-bar lookahead in fill simulation, making the paper trading results appear better than any real execution would be.

**Why it happens:**
It is the simplest thing to code: signal fires → fill at `close[N]`. The 1-bar shift requires explicit handling.

**Consequences:**
- Paper P&L is systematically inflated
- The dashboard presents misleading performance metrics when used as a portfolio demonstration

**Prevention:**
- Fill simulated orders at the open of the next bar after the signal fires (`open[N+1]`)
- For the "live" paper trade case (signal fires on current bar), fill at the next tick/next bar open
- Document the fill assumption clearly in the UI (e.g., "Simulated fill at next bar open")

**Phase to address:** Phase 3 (paper trading engine).

---

### Pitfall 8: SQLite Write Contention Under Async FastAPI

**What goes wrong:**
FastAPI is async. SQLite's default mode allows only one writer at a time and is not safe for concurrent access from multiple async coroutines sharing the same connection object. If the paper trading engine writes a fill at the same time the WebSocket handler writes a price update, you get `database is locked` errors.

**Prevention:**
- Use `aiosqlite` (async SQLite wrapper) rather than synchronous `sqlite3` with `asyncio.to_thread()`
- Enable WAL mode: `PRAGMA journal_mode=WAL` — this allows concurrent reads while a write is in progress
- Keep the write surface small: only the paper trading engine writes; price data is in-memory, not persisted per-tick
- Use a single dedicated writer task/queue rather than writing from multiple concurrent coroutines

**Phase to address:** Phase 3 (paper trading engine + database layer).

---

### Pitfall 9: CORS Misconfiguration Between Vercel Frontend and Render Backend

**What goes wrong:**
The Vercel frontend domain (e.g., `trading-dashboard.vercel.app`) must be explicitly allowed in FastAPI's CORS middleware. A common mistake is setting `allow_origins=["*"]` in development and forgetting to tighten it for production — or the reverse: setting it correctly for one Vercel preview URL but forgetting that Vercel generates unique per-deployment preview URLs that do not match the wildcard.

WebSocket connections also require CORS-equivalent `Origin` header validation, which is separate from the HTTP CORS middleware.

**Prevention:**
- Set `ALLOWED_ORIGINS` as an environment variable on Render — list the production Vercel domain explicitly
- Test the CORS configuration with the actual deployed Vercel URL before considering deployment done
- Note: WebSocket upgrade requests are validated by the `Origin` header — FastAPI's `CORSMiddleware` does not automatically protect WebSocket endpoints, so add origin validation in the WebSocket route handler itself

**Phase to address:** Phase 4 (deployment).

---

## Minor Pitfalls

---

### Pitfall 10: NY Session Filter Timezone Handling

**What goes wrong:**
The strategy only generates signals during 9:30–10:30 AM ET. If the backend server runs in UTC (which Render does), timezone-naive datetime comparisons silently evaluate the session window incorrectly, either never activating the filter or evaluating it against UTC time.

**Prevention:**
- Always use timezone-aware datetimes throughout: `datetime.now(tz=ZoneInfo("America/New_York"))`
- Store and compare all timestamps in UTC internally; convert to ET only for display and session-window checks
- Write a unit test that verifies the session filter passes at 9:35 AM ET and rejects at 9:25 AM ET and 10:35 AM ET

**Phase to address:** Phase 1 (strategy engine).

---

### Pitfall 11: IFVG Expiry Logic Off-By-One

**What goes wrong:**
The IFVG expires after 10 bars. If the expiry counter starts at 0 on the bar the zone forms (inclusive), it expires at bar 10 (the 11th bar). If it starts at 1, it expires at bar 9. PineScript's original logic must be read carefully — an off-by-one shifts all expiry events by one bar and causes zones to appear slightly too long or too short on the chart, which will be visually confusing to compare against TradingView.

**Prevention:**
- Extract the exact expiry condition from `FYP_BOT_1_3.pine` and add it as a comment in the Python implementation with the source line number
- Write a test: given a known IFVG formation bar, assert the zone is marked expired on exactly the correct bar

**Phase to address:** Phase 1 (strategy engine).

---

### Pitfall 12: Historical Backtest Data Loaded Repeatedly (Performance)

**What goes wrong:**
If the frontend fetches the full historical backtest (60+ days of 1m bars, hundreds of signals) from the backend on every page load or asset switch, the response time will be slow and yfinance will be hit repeatedly.

**Prevention:**
- Cache historical backtest results in SQLite at startup or on first request; serve from cache on subsequent requests
- Add a cache invalidation timestamp — refresh historical data once per day, not on every request
- For the chart, paginate or windowed-load the candlestick data (load the last 500 bars by default, fetch more on scroll)

**Phase to address:** Phase 2 (data layer) / Phase 4 (performance).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|---|---|---|
| Strategy engine (IFVG/CISD/EMA) | Lookahead bias on live bar | Slice off last bar before computing signals; treat live bar as display-only |
| Strategy engine (Python translation) | EMA divergence from PineScript | Use `ewm(adjust=False)` and diff against TradingView export |
| Strategy engine (CISD/IFVG logic) | Off-by-one bar indexing | Validate against PineScript output row-by-row for a known date range |
| NY session filter | UTC vs ET timezone mismatch | Timezone-aware datetimes throughout; unit test session boundaries |
| Data feeds (yfinance) | Rate limiting + delayed 1m data | Validate freshness on every fetch; cache last successful response |
| Data feeds (Binance WS) | Silent drop + 24h hard disconnect | Track last-message timestamp; proactive reconnect at 23h mark |
| Paper trading engine | Fill at signal bar's close (optimistic) | Fill at next bar open; document assumption in UI |
| Paper trading engine + DB | SQLite write contention in async context | aiosqlite + WAL mode + single writer |
| Frontend WebSocket | Connection leak on re-render | useRef for WS instance; cleanup in useEffect return |
| Frontend WebSocket | Stale UI when disconnected | Show explicit "Reconnecting..." state; never display stale data without a staleness indicator |
| Deployment | Render cold start breaks WS on session open | Keep-alive cron at 9:20 AM ET; frontend exponential backoff reconnect |
| Deployment | CORS between Vercel and Render | Explicit `ALLOWED_ORIGINS` env var; verify with deployed URL before launch |

---

## Sources

- [yfinance rate limiting discussion (GitHub)](https://github.com/ranaroussi/yfinance/discussions/2431)
- [yfinance 429 rate limit issue (GitHub)](https://github.com/ranaroussi/yfinance/issues/2125)
- [Why yfinance Gets Blocked (Medium)](https://medium.com/@trading.dude/why-yfinance-keeps-getting-blocked-and-what-to-use-instead-92d84bb2cc01)
- [yfinance delayed live data issue (GitHub)](https://github.com/ranaroussi/yfinance/issues/1050)
- [Binance WebSocket stream limits (Binance Academy)](https://academy.binance.com/en/articles/what-are-binance-websocket-limits)
- [Binance WebSocket Streams — official docs (24h limit documented)](https://developers.binance.com/docs/binance-spot-api-docs/web-socket-streams)
- [Avoiding stale Binance WebSocket connections (Binance Dev Community)](https://dev.binance.vision/t/avoiding-detecting-stale-websocket-user-data-stream-connections/4248)
- [How to avoid data loss across Binance disconnect/reconnect (Binance Dev Community)](https://dev.binance.vision/t/how-to-avoid-losing-data-across-user-data-stream-disconnect-reconnects/12354)
- [PineScript to Python conversion guide (Pineify, 2026)](https://pineify.app/resources/blog/converting-pine-script-to-python-a-comprehensive-guide)
- [How to keep FastAPI active on Render free tier (Medium)](https://medium.com/@saveriomazza/how-to-keep-your-fastapi-server-active-on-renders-free-tier-93767b70365c)
- [FastAPI WebSocket disconnection handling (Hex Shift, Medium)](https://hexshift.medium.com/handling-websocket-disconnections-gracefully-in-fastapi-9f0a1de365da)
- [The most dangerous bug in real-time systems (DEV Community)](https://dev.to/ricardosaumeth/--5c7g)
- [Vercel WebSocket limitation — cannot upgrade (copyprogramming.com, 2026)](https://copyprogramming.com/howto/can-t-connect-to-websocket-server-after-pushing-to-vercel)
- [SQLite concurrency pitfalls in FastAPI (GitHub PictoPy issue)](https://github.com/AOSSIE-Org/PictoPy/issues/943)
- [SQLite WAL mode for concurrent access (Piccolo ORM docs)](https://piccolo-orm.readthedocs.io/en/1.1.1/piccolo/tutorials/using_sqlite_and_asyncio_effectively.html)
- [Common backtesting mistakes — slippage and fill accuracy (QuantInsti)](https://blog.quantinsti.com/common-mistakes-backtesting/)
