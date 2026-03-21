# Phase 5: Multi-Timeframe Chart Aggregation - Research

**Researched:** 2026-03-21
**Domain:** pandas OHLCV resampling, FastAPI query params, React state persistence, lightweight-charts v5
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHART-06 | Chart page has a timeframe switcher (1m / 5m / 15m / 1h) that changes the bar resolution displayed | Pill group in React with useState; `?timeframe=` query param to existing `/chart/bars/{symbol}` endpoint |
| CHART-07 | Chart overlays (IFVG zones, CISD levels, entry markers) are recomputed for the selected timeframe | pandas `resample()` in `charts/router.py` before passing resampled df to `extract_ifvg_zones`, `extract_cisd_level`, `extract_entry_markers` |
</phase_requirements>

---

## Summary

Phase 5 adds a four-option timeframe switcher (1m / 5m / 15m / 1h) to the Chart page. The bar resolution selected drives a query parameter on the existing `/chart/bars/{symbol}` endpoint. For resolutions above 1m the backend resamples the 1-minute BarStore data with `pandas.DataFrame.resample()` before running the strategy engine, ensuring that IFVG zones, CISD levels, and EMA are computed on correctly aggregated bars — not repainted 1m signals.

The architectural decision is already locked in STATE.md: aggregation happens on-demand in `charts/router.py`; there are no pre-computed per-TF BarStore entries. The `resampled.iloc[:-1]` guard must be applied before passing the resampled DataFrame to any strategy function to prevent lookahead on the in-progress bar.

The frontend change is isolated to `ChartPage.tsx`: add a `timeframe` state variable, render a pill group, include it as a query param in the `fetchWithAuth` call, and persist it in `useRef` so it survives symbol switches.

**Primary recommendation:** Add `?timeframe=5` (minutes as integer) query param to the chart endpoint; resample 1m bars server-side with `df.resample('5min').agg({...}).dropna()` then call all existing extract functions on the resampled DataFrame unchanged.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pandas | already installed | `DataFrame.resample()` for OHLCV aggregation | Standard Python data stack; already used throughout backend |
| lightweight-charts | ^5.1.0 (already installed) | Candlestick chart rendering in browser | Already used in `CandlestickChart.tsx` |
| React `useState` | 19.x (already installed) | Timeframe pill selection state | Already the state management pattern used across all pages |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-router-dom | ^7.13.1 (already installed) | `useSearchParams` if timeframe needs URL persistence | Optional: URL persistence of timeframe is not a requirement in this phase |

No new dependencies are required for this phase.

**Installation:**
```bash
# No new packages needed
```

---

## Architecture Patterns

### Backend: Query Parameter on Existing Endpoint

Add an optional `timeframe` query param (integer minutes) to `GET /chart/bars/{symbol}`:

```python
# Source: pattern consistent with FastAPI optional query params
@router.get("/chart/bars/{symbol}")
async def get_chart_bars(
    symbol: str,
    timeframe: int = 1,          # minutes; 1 | 5 | 15 | 60
    _user: str = Depends(get_current_user),
) -> dict:
```

Valid values: `1, 5, 15, 60`. Any other value should raise `HTTPException(status_code=422, detail="timeframe must be 1, 5, 15, or 60")`.

### Backend: pandas OHLCV Resample

The standard aggregation rule for OHLCV bars is:

```python
# Source: pandas docs — resample OHLCV
RESAMPLE_RULES = {
    "open":   "first",
    "high":   "max",
    "low":    "min",
    "close":  "last",
    "volume": "sum",
}

def resample_bars(df: pd.DataFrame, minutes: int) -> pd.DataFrame:
    """
    Resample a 1m OHLCV DataFrame to a higher timeframe.
    Drops the last (in-progress) bar with iloc[:-1] after resampling.
    """
    if minutes == 1:
        return df.iloc[:-1].copy()   # still drop in-progress 1m bar

    rule = f"{minutes}min"
    resampled = (
        df
        .resample(rule)
        .agg(RESAMPLE_RULES)
        .dropna()          # removes empty buckets (e.g. pre-market with no bars)
    )
    return resampled.iloc[:-1]   # drop last in-progress aggregated bar
```

The `iloc[:-1]` guard is already established project convention for lookahead prevention (see STATE.md decision: "resampled.iloc[:-1] guard before strategy computation").

After resampling, pass `resampled_df` to the existing `extract_ifvg_zones`, `extract_cisd_level`, `extract_entry_markers`, and `compute_ema`/`compute_ifvg`/`compute_cisd` functions unchanged. No modifications to strategy functions are needed.

### Backend: Minimum Bar Count Guard

The IFVG computation requires `IFVG_LOOKBACK = 10` bars, EMA needs at least `period = 20` bars. After resampling, validate that enough bars remain:

```python
MIN_BARS_REQUIRED = 22   # 20 for EMA warm-up + 2 for IFVG detection window

if len(resampled_df) < MIN_BARS_REQUIRED:
    raise HTTPException(
        status_code=404,
        detail=f"Insufficient bars for {minutes}m timeframe — need at least {MIN_BARS_REQUIRED}, got {len(resampled_df)}"
    )
```

With 500 1m bars in BarStore (from `backfill_bars` and the Alpaca feed cap):
- 5m resolution yields ~100 bars (500 / 5) — sufficient
- 15m resolution yields ~33 bars — sufficient
- 1h (60m) resolution yields ~8 bars from a single day's trading session (6.5 hours = 390 minutes = 6.5 bars). This is the edge case: after `dropna()` and `iloc[:-1]`, only ~5 closed 1h bars may exist during a trading session. The minimum bar guard must fire for 1h if the count is below threshold; the frontend should show the same "No chart data available" empty state it already handles for 404 responses.

**Implication for backfill:** 500 1m bars spans ~8.3 hours of market time (1 bar/min x 500 = ~1.3 days including pre/post market gaps). For 1h to be useful, `backfill_bars` should fetch enough bars. The current `n_bars=200` default fetches ~3.3 hours; the `AlpacaFeed` cap is 500. The phase plan should ensure `backfill_bars` is called with `n_bars=500` (already the bar_store cap) so 1h has enough history. This is already set in `alpaca_feed.py` `bars[-500:]` — no change needed.

### Frontend: Timeframe Pill Group

Add `timeframe` state to `ChartPage.tsx`. Use a `timeframeRef` to persist across symbol switches:

```typescript
// Pattern: persist timeframe across symbol changes using ref
const TIMEFRAMES = [
  { label: '1m',  value: 1  },
  { label: '5m',  value: 5  },
  { label: '15m', value: 15 },
  { label: '1h',  value: 60 },
] as const

type Timeframe = typeof TIMEFRAMES[number]['value']

// In component:
const [timeframe, setTimeframe] = useState<Timeframe>(1)
const timeframeRef = useRef<Timeframe>(1)

const handleTimeframeChange = (tf: Timeframe) => {
  timeframeRef.current = tf
  setTimeframe(tf)
}
```

The fetch useEffect already depends on `[selectedSymbol]`. Add `timeframe` to the dependency array so switching timeframe also triggers a reload:

```typescript
useEffect(() => {
  if (!selectedSymbol) return
  // ...
  fetchWithAuth(`/chart/bars/${selectedSymbol}?timeframe=${timeframe}`)
  // ...
}, [selectedSymbol, timeframe])
```

Because `timeframe` is in state AND the ref tracks the last value, when `selectedSymbol` changes the effect re-runs with the current timeframe state value — so the timeframe persists across symbol switches without any extra logic.

### Frontend: Pill Group Styling

The existing symbol selector pills in `ChartPage.tsx` (lines 97-113) provide the exact styling pattern. Replicate:

```tsx
{TIMEFRAMES.map(tf => (
  <button
    key={tf.value}
    onClick={() => handleTimeframeChange(tf.value)}
    className="px-3 py-1 rounded text-sm font-medium transition-colors"
    style={{
      backgroundColor: timeframe === tf.value ? '#3B82F6' : 'transparent',
      color: timeframe === tf.value ? '#FFFFFF' : '#6B7280',
      border: `1px solid ${timeframe === tf.value ? '#3B82F6' : '#2D3148'}`,
    }}
  >
    {tf.label}
  </button>
))}
```

Place the timeframe pills in their own row below the symbol selector, separated by a small margin.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OHLCV bar aggregation | Manual loop over 1m bars grouping them by N-minute buckets | `pandas.DataFrame.resample().agg()` | Handles partial buckets, NaT/NaN, timezone-aware DatetimeIndex, and market gaps correctly — manual grouping will produce wrong open/close on DST transitions and market halt gaps |
| Timeframe persistence across navigation | Redux store, Context, or localStorage | `useRef` + `useState` in `ChartPage.tsx` | The chart page is never unmounted between symbol switches (same component, different symbol prop) — a ref is sufficient and keeps the implementation local |

**Key insight:** All strategy functions (`compute_ema`, `compute_ifvg`, `compute_cisd`, `extract_ifvg_zones`, `extract_cisd_level`, `extract_entry_markers`) already accept a generic `pd.DataFrame` — they do not know or care about the source timeframe. Resampling before calling them is the entire implementation on the backend side.

---

## Common Pitfalls

### Pitfall 1: In-Progress Bar Lookahead
**What goes wrong:** The most recent bar in `bar_store.get(symbol)` may be the currently-forming 1m bar. After `resample('5min')`, the final bucket may include only 1-4 completed 1m bars, making it a partial aggregated bar. Passing it to strategy functions produces a signal that "looks ahead" because the final 5m bar is not yet closed.
**Why it happens:** BarStore is updated on every 1m bar close (from Alpaca), so the last entry is always the most recent complete 1m bar. After resample, the last bucket is the in-progress aggregate.
**How to avoid:** Apply `iloc[:-1]` to the resampled DataFrame before any strategy call. This is already an established project convention (STATE.md line 116).
**Warning signs:** IFVG zones appearing mid-candle on higher timeframes; signals appearing at non-round times.

### Pitfall 2: Empty Buckets After resample().dropna()
**What goes wrong:** Resampling a DatetimeIndex that has gaps (pre-market bars, market close to next open) produces NaN rows for empty periods. `dropna()` removes them, but if `dropna()` is omitted the strategy loops receive NaN OHLCV values and produce wrong results.
**Why it happens:** pandas `resample()` fills gaps with NaN by default.
**How to avoid:** Always call `.dropna()` after `.agg()`. Verify with `assert not resampled.isnull().any().any()` in tests.
**Warning signs:** IFVG or CISD returning unexpected "None" states for most bars.

### Pitfall 3: IFVG Daily Reset on Higher Timeframes
**What goes wrong:** `compute_ifvg` resets `fvg_array` on each new calendar day (line 69-73 in `ifvg.py`). For 1h bars, only 6-7 bars exist per day, so the reset fires frequently and IFVG state is often "None" on higher timeframes — this is **correct** behavior matching the Pine strategy's daily session reset, but the trader may expect to see zones carry over across days.
**Why it happens:** The Pine strategy intentionally resets FVG tracking at session open.
**How to avoid:** No code change needed — this is correct per-spec behavior. Document it so the planner does not add a "fix" for it.
**Warning signs:** None — this is expected.

### Pitfall 4: 1h Bars Insufficient Data on IEX Free Tier
**What goes wrong:** With 200 backfill bars (the old default) and 390 1m bars per trading day, 1h resampling gives only ~3 closed 1h bars per day × 1 day = 3 bars. Below the 22-bar minimum guard, the endpoint returns 404.
**Why it happens:** `backfill_bars` default was `n_bars=200`. The current cap in `_on_bar` is 500.
**How to avoid:** Verify `backfill_bars` is called with `n_bars=500` (already the bar_store cap per `alpaca_feed.py` line 66: `bars[-500:]`). Check the `backfill_bars` call site in `main.py` — the `n_bars` parameter defaults to 200 in the function signature (line 123 of `alpaca_feed.py`). The plan must update that call to `n_bars=500`.
**Warning signs:** 1h tab always shows empty state on first load; 404 from `/chart/bars/SPY?timeframe=60`.

### Pitfall 5: lightweight-charts Timestamp Collision
**What goes wrong:** lightweight-charts requires that bar `time` values are strictly ascending integers (Unix seconds). After resampling, the `time` values for 5m bars will be at 0, 5, 10... minute marks. If the DatetimeIndex after resample contains duplicate timestamps (e.g., from backfill deduplication edge cases), `setData()` will throw or silently drop bars.
**Why it happens:** pandas `resample` uses the period-start timestamp as the bucket key; deduplication should prevent duplicates, but worth verifying.
**How to avoid:** Sort and deduplicate by timestamp in the bars_out loop, or assert `df.index.is_monotonic_increasing and df.index.is_unique` after resample.
**Warning signs:** Blank chart area with no error; browser console shows lightweight-charts exception.

---

## Code Examples

### Backend: resample_bars Helper (Verified pattern — pandas docs)

```python
VALID_TIMEFRAMES = {1, 5, 15, 60}
RESAMPLE_RULES = {
    "open":   "first",
    "high":   "max",
    "low":    "min",
    "close":  "last",
    "volume": "sum",
}

def resample_bars(df: pd.DataFrame, minutes: int) -> pd.DataFrame:
    if minutes not in VALID_TIMEFRAMES:
        raise ValueError(f"Invalid timeframe: {minutes}")
    if minutes == 1:
        return df.iloc[:-1].copy()
    resampled = df.resample(f"{minutes}min").agg(RESAMPLE_RULES).dropna()
    return resampled.iloc[:-1]
```

### Backend: Updated endpoint signature

```python
@router.get("/chart/bars/{symbol}")
async def get_chart_bars(
    symbol: str,
    timeframe: int = 1,
    _user: str = Depends(get_current_user),
) -> dict:
    if timeframe not in {1, 5, 15, 60}:
        raise HTTPException(status_code=422, detail="timeframe must be 1, 5, 15, or 60")
    bars = bar_store.get(symbol.upper())
    if not bars:
        raise HTTPException(status_code=404, detail=f"No bars available for {symbol.upper()}")
    # ... build df as before ...
    df = resample_bars(df, timeframe)
    if len(df) < MIN_BARS_REQUIRED:
        raise HTTPException(status_code=404, detail="Insufficient bars for selected timeframe")
    # ... rest unchanged ...
```

### Frontend: fetch with timeframe param

```typescript
fetchWithAuth(`/chart/bars/${selectedSymbol}?timeframe=${timeframe}`)
```

The existing `fetchWithAuth` utility in `src/lib/api.ts` appends query strings correctly since the URL is a plain string — no changes to the utility required.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Pre-compute per-TF BarStore (store 4 separate bar lists per symbol) | On-demand resample in endpoint handler | Simpler; no background aggregation task; slightly more CPU per request (acceptable for single-user dashboard) |

**Key prior decision from STATE.md (line 116, HIGH confidence):**
> "Multi-timeframe aggregation is on-demand pandas resample in charts/router.py — no pre-computed per-TF BarStore entries; resampled.iloc[:-1] guard before strategy computation"

This decision is locked. The plan must not introduce a pre-computed multi-TF BarStore.

---

## Open Questions

1. **1h bars on IEX free tier with default backfill depth**
   - What we know: `backfill_bars` in `main.py` is called without `n_bars` override, so defaults to 200 bars. 200 1m bars = ~3.3 hours market time = ~3 closed 1h bars. Below the 22-bar minimum.
   - What's unclear: Whether the Alpaca free IEX feed allows `limit=500` on historical calls (it does per Alpaca docs, but latency may be higher).
   - Recommendation: Plan task must update the `backfill_bars` call in `main.py` to `n_bars=500`. This is a one-line change with no risk.

2. **IFVG zone `startTime`/`endTime` meaning at higher timeframes**
   - What we know: `extract_ifvg_zones` returns `startTime` and `endTime` as Unix seconds from the resampled bar's index timestamp. For 5m bars these will be 5-minute-aligned epoch values. lightweight-charts will render them at the correct position on the time axis.
   - What's unclear: Whether the existing IFVG zone rendering (two horizontal price lines) still looks correct at higher timeframes — it likely does since price lines are horizontal and not time-bounded.
   - Recommendation: No code change to the chart rendering layer; the price-line approach is time-agnostic.

---

## Sources

### Primary (HIGH confidence)
- Existing codebase: `backend/charts/router.py` — full endpoint implementation read directly
- Existing codebase: `backend/data/bar_store.py`, `backend/data/alpaca_feed.py` — BarStore cap (500 bars) confirmed
- Existing codebase: `backend/strategy/ifvg.py`, `backend/strategy/cisd.py`, `backend/strategy/ema.py` — strategy functions accept generic DataFrames; no timeframe awareness
- STATE.md line 116 — architectural decision for on-demand resample locked by prior roadmap discussion
- `frontend/src/pages/ChartPage.tsx`, `frontend/src/components/CandlestickChart.tsx` — full frontend chart implementation read directly
- `frontend/package.json` — confirmed lightweight-charts ^5.1.0, React 19, Vite 6; no missing dependencies

### Secondary (MEDIUM confidence)
- pandas documentation pattern: `df.resample(rule).agg({'open':'first','high':'max','low':'min','close':'last','volume':'sum'})` — standard OHLCV resample, well-established

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all libraries already installed and in use
- Architecture: HIGH — on-demand resample decision is locked in STATE.md; endpoint pattern is clear
- Pitfalls: HIGH — derived from direct code inspection of bar_store cap, backfill call site, and strategy function signatures
- Frontend state management: HIGH — identical pattern to existing symbol selector pills

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable domain; lightweight-charts and pandas are not fast-moving for this use case)
