"""
Backtest endpoint: POST /backtest/run

Fetches 1-minute yfinance bars for the requested date range (max 7 days),
runs the IFVG + CISD + EMA strategy bar-by-bar, simulates paper trades with
the same stop/target logic as PaperTradingEngine, and returns bars, EMA,
entry markers, equity curve, and trade statistics.
"""

import asyncio
import math
from datetime import datetime, date

import numpy as np
import pandas as pd
import yfinance as yf
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.dependencies import get_current_user
from backend.strategy.ema import compute_ema
from backend.strategy.ifvg import compute_ifvg
from backend.strategy.cisd import compute_cisd

router = APIRouter()

# Match paper engine constants exactly
RISK_PER_TRADE = 1000.0
SWING_LOOKBACK = 8
RISK_REWARD_RATIO = 1.5
MAX_DATE_RANGE_DAYS = 7


class BacktestRequest(BaseModel):
    symbol: str
    start_date: str  # "YYYY-MM-DD"
    end_date: str    # "YYYY-MM-DD"


@router.post("/backtest/run")
async def run_backtest(
    req: BacktestRequest,
    _user: str = Depends(get_current_user),
) -> dict:
    """
    Run a historical backtest over 1-minute bars.

    Validates:
    - start_date < end_date
    - date range <= 7 days

    Returns bars, ema, markers, equity_curve, and trade stats.
    """
    # Parse and validate dates
    try:
        start = date.fromisoformat(req.start_date)
        end = date.fromisoformat(req.end_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Invalid date format: {e}")

    if start >= end:
        raise HTTPException(status_code=400, detail="Start date must be before end date.")

    delta_days = (end - start).days
    if delta_days > MAX_DATE_RANGE_DAYS:
        raise HTTPException(
            status_code=400,
            detail="Date range exceeds the 7-day limit for 1-minute data. Shorten your range.",
        )

    # Fetch 1m bars via yfinance (blocking I/O — offload to thread)
    symbol_upper = req.symbol.upper()
    df = await asyncio.to_thread(
        lambda: yf.Ticker(symbol_upper).history(
            start=req.start_date,
            end=req.end_date,
            interval="1m",
        )
    )

    if df.empty:
        raise HTTPException(
            status_code=404,
            detail="No data available for this symbol and date range.",
        )

    # Normalize column names
    df.columns = df.columns.str.lower()

    # Ensure index is tz-aware or tz-naive consistently — make tz-naive for simplicity
    if df.index.tz is not None:
        df.index = df.index.tz_localize(None)

    # Compute strategy indicators over full dataset
    ema_series = compute_ema(df, period=20)
    ifvg_states = compute_ifvg(df)
    cisd_states = compute_cisd(df)

    # --- Bar-by-bar trade simulation ---
    closes = df["close"].values
    highs = df["high"].values
    lows = df["low"].values
    index = df.index

    trades: list[dict] = []       # closed trades
    open_trade: dict | None = None  # at most 1 open trade at a time

    for i in range(SWING_LOOKBACK, len(df)):
        ifvg = ifvg_states.iloc[i]
        cisd = cisd_states.iloc[i]
        ema_val = ema_series.iloc[i]

        # Skip bars where EMA is not yet computed
        if math.isnan(float(ema_val)):
            continue

        close = closes[i]

        # --- Check if open trade hits stop or target on this bar ---
        if open_trade is not None:
            if open_trade["direction"] == "Long":
                if lows[i] <= open_trade["stop"]:
                    pnl = -open_trade["quantity"] * abs(open_trade["entry"] - open_trade["stop"])
                    open_trade["exit_price"] = open_trade["stop"]
                    open_trade["pnl"] = pnl
                    open_trade["outcome"] = "Loss"
                    open_trade["exit_time"] = index[i]
                    trades.append(open_trade)
                    open_trade = None
                elif highs[i] >= open_trade["target"]:
                    pnl = open_trade["quantity"] * abs(open_trade["target"] - open_trade["entry"])
                    open_trade["exit_price"] = open_trade["target"]
                    open_trade["pnl"] = pnl
                    open_trade["outcome"] = "Win"
                    open_trade["exit_time"] = index[i]
                    trades.append(open_trade)
                    open_trade = None
            else:  # Short
                if highs[i] >= open_trade["stop"]:
                    pnl = -open_trade["quantity"] * abs(open_trade["stop"] - open_trade["entry"])
                    open_trade["exit_price"] = open_trade["stop"]
                    open_trade["pnl"] = pnl
                    open_trade["outcome"] = "Loss"
                    open_trade["exit_time"] = index[i]
                    trades.append(open_trade)
                    open_trade = None
                elif lows[i] <= open_trade["target"]:
                    pnl = open_trade["quantity"] * abs(open_trade["entry"] - open_trade["target"])
                    open_trade["exit_price"] = open_trade["target"]
                    open_trade["pnl"] = pnl
                    open_trade["outcome"] = "Win"
                    open_trade["exit_time"] = index[i]
                    trades.append(open_trade)
                    open_trade = None

        # --- Check for new entry (only if no open trade) ---
        if open_trade is not None:
            continue

        direction = None
        if ifvg == "Bullish" and cisd == "Bullish" and close > ema_val:
            direction = "Long"
        elif ifvg == "Bearish" and cisd == "Bearish" and close < ema_val:
            direction = "Short"

        if direction is None:
            continue

        # Calculate stop/target using swing lookback
        lookback_lows = lows[max(0, i - SWING_LOOKBACK):i]
        lookback_highs = highs[max(0, i - SWING_LOOKBACK):i]

        if direction == "Long":
            stop = float(np.min(lookback_lows))
            risk = close - stop
            if risk <= 0:
                continue
            target = close + risk * RISK_REWARD_RATIO
        else:
            stop = float(np.max(lookback_highs))
            risk = stop - close
            if risk <= 0:
                continue
            target = close - risk * RISK_REWARD_RATIO

        quantity = RISK_PER_TRADE / risk

        open_trade = {
            "direction": direction,
            "entry": close,
            "stop": stop,
            "target": target,
            "quantity": quantity,
            "risk": risk,
            "entry_time": index[i],
            "pnl": 0.0,
            "outcome": "Open",
        }

    # Any remaining open trade at end of data: mark as open (pnl=0, excluded from stats)
    # (not appended to closed trades list)

    # --- Build equity curve (cumulative PnL from closed trades) ---
    equity_curve = []
    cum_pnl = 0.0
    for t in trades:
        cum_pnl += t["pnl"]
        exit_time = t["exit_time"]
        equity_curve.append({
            "date": exit_time.strftime("%Y-%m-%d %H:%M"),
            "cumPnl": round(cum_pnl, 2),
        })

    # --- Trade statistics ---
    total_trades = len(trades)
    wins = sum(1 for t in trades if t["outcome"] == "Win")
    win_rate = wins / total_trades if total_trades > 0 else 0.0
    avg_r_multiple = (
        sum(t["pnl"] / RISK_PER_TRADE for t in trades) / total_trades
        if total_trades > 0
        else 0.0
    )

    # --- Build chart data (bars, ema, markers) ---
    bars_out = [
        {
            "time": int(ts.timestamp()),
            "open": float(df.at[ts, "open"]),
            "high": float(df.at[ts, "high"]),
            "low": float(df.at[ts, "low"]),
            "close": float(df.at[ts, "close"]),
        }
        for ts in df.index
    ]

    ema_out = [
        {"time": int(ts.timestamp()), "value": float(val)}
        for ts, val in ema_series.items()
        if not math.isnan(float(val))
    ]

    markers = []
    for i in range(SWING_LOOKBACK, len(df)):
        ifvg = ifvg_states.iloc[i]
        cisd = cisd_states.iloc[i]
        ema_val = ema_series.iloc[i]
        if math.isnan(float(ema_val)):
            continue
        close = closes[i]
        ts = index[i]
        if ifvg == "Bullish" and cisd == "Bullish" and close > ema_val:
            markers.append({"time": int(ts.timestamp()), "direction": "Long"})
        elif ifvg == "Bearish" and cisd == "Bearish" and close < ema_val:
            markers.append({"time": int(ts.timestamp()), "direction": "Short"})

    return {
        "bars": bars_out,
        "ema": ema_out,
        "markers": markers,
        "equity_curve": equity_curve,
        "stats": {
            "total_trades": total_trades,
            "win_rate": round(win_rate, 4),
            "avg_r_multiple": round(avg_r_multiple, 4),
        },
    }
