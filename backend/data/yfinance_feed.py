"""
yfinance background poller for US stock symbols.
poll_yfinance_loop() is started as an asyncio task in the FastAPI lifespan.
"""
import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Callable

import pandas as pd
import yfinance as yf

from backend.data.bar_store import Bar, bar_store as _bar_store

logger = logging.getLogger(__name__)

# Bars must have their most recent timestamp within this window to be considered live
RECENCY_THRESHOLD_SECONDS = 90


def _apply_market_hours_filter(df: pd.DataFrame) -> pd.DataFrame:
    """
    Filter df to rows within 09:30–16:00 US/Eastern.
    Returns original df unchanged if conversion fails.
    """
    try:
        df_et = df.copy()
        df_et.index = df_et.index.tz_convert("US/Eastern")
        filtered_index = df_et.between_time("09:30", "16:00").index
        # Map back to UTC index
        utc_index = filtered_index.tz_convert("UTC")
        return df.loc[df.index.isin(utc_index)]
    except Exception as exc:
        logger.warning("Market-hours filter failed: %s — skipping filter", exc)
        return df


def _is_stale(newest_ts: pd.Timestamp) -> bool:
    """Return True if newest_ts is older than RECENCY_THRESHOLD_SECONDS from now."""
    now_utc = datetime.now(timezone.utc)
    age = now_utc - newest_ts.to_pydatetime()
    return age > timedelta(seconds=RECENCY_THRESHOLD_SECONDS)


async def fetch_closed_bars(symbol: str) -> list[Bar]:
    """
    Fetch 1-minute closed bars for `symbol` using yfinance.

    - Runs yf.Ticker.history() in a thread (non-blocking).
    - Drops the last row (open/incomplete bar guardrail).
    - Returns [] and logs a WARNING if the DataFrame is empty.
    - Applies market-hours filter (09:30–16:00 US/Eastern).
    - Checks recency: if the newest closed bar is older than RECENCY_THRESHOLD_SECONDS,
      logs a WARNING and returns [].
    """
    try:
        df = await asyncio.to_thread(
            lambda: yf.Ticker(symbol).history(period="1d", interval="1m")
        )
    except Exception as exc:
        logger.error("yfinance error for %s: %s", symbol, exc)
        return []

    if df is None or df.empty:
        logger.warning("yfinance returned empty DataFrame for %s", symbol)
        return []

    # Drop the last row — it is the currently open (incomplete) bar
    df = df.iloc[:-1]

    if df.empty:
        logger.warning(
            "yfinance returned only one bar (open bar) for %s — nothing left after drop",
            symbol,
        )
        return []

    # Convert index to UTC (yfinance returns tz-aware index)
    if df.index.tz is None:
        df.index = df.index.tz_localize("UTC")
    else:
        df.index = df.index.tz_convert("UTC")

    # Market-hours filter: 09:30–16:00 US/Eastern
    df = _apply_market_hours_filter(df)

    if df.empty:
        logger.warning("No bars in market hours for %s", symbol)
        return []

    # Recency check: newest closed bar must be within RECENCY_THRESHOLD_SECONDS
    newest_ts = df.index[-1]
    if _is_stale(newest_ts):
        logger.warning(
            "yfinance data for %s is stale (newest bar: %s) — skipping update",
            symbol,
            newest_ts,
        )
        return []

    bars = [
        Bar(
            timestamp=row.Index.to_pydatetime(),
            open=float(row.Open),
            high=float(row.High),
            low=float(row.Low),
            close=float(row.Close),
            volume=float(row.Volume),
        )
        for row in df.itertuples()
    ]
    return bars


async def poll_yfinance_loop(
    watchlist_getter: Callable[[], list[str]],
    interval_s: int = 60,
) -> None:
    """
    Background loop: poll yfinance for each symbol in the watchlist every `interval_s` seconds.

    `watchlist_getter` is a callable (not a snapshot list) so it always reads the
    current watchlist contents.
    """
    while True:
        symbols = watchlist_getter()
        for symbol in symbols:
            try:
                bars = await fetch_closed_bars(symbol)
                if bars:
                    _bar_store.update(symbol, bars)
            except Exception as exc:
                logger.error("Error polling %s: %s", symbol, exc)
            # Brief sleep between symbols to respect yfinance rate limits
            await asyncio.sleep(1)
        await asyncio.sleep(interval_s)
