"""
Chart data endpoint: GET /chart/bars/{symbol}

Returns OHLCV bars, EMA values, IFVG zone geometry, CISD level price,
and entry markers for the given symbol — all from the in-memory bar store
and existing strategy engine functions.

All timestamps are Unix epoch SECONDS (not milliseconds) — required by
lightweight-charts on the frontend.
"""

import math
import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException

from backend.data.bar_store import bar_store
from backend.dependencies import get_current_user
from backend.strategy.ema import compute_ema
from backend.strategy.ifvg import compute_ifvg, IFVG_LOOKBACK
from backend.strategy.cisd import compute_cisd

router = APIRouter()

RISK_PER_TRADE = 1000.0
SWING_LOOKBACK = 8
RISK_REWARD_RATIO = 1.5


def extract_ifvg_zones(df: pd.DataFrame) -> list[dict]:
    """
    Replicate the core IFVG loop from compute_ifvg but return zone geometry
    instead of state strings.

    Returns a list of dicts for inverted, non-expired zones:
        {
            "top": float,
            "bottom": float,
            "startTime": int (unix seconds),
            "endTime": int (unix seconds),
            "type": "bullish" | "bearish"
        }

    Zone type meaning (what the IFVG state becomes after inversion):
        - Inverted bullish FVG  -> ifvgState == "Bearish"  -> type = "bearish"
        - Inverted bearish FVG  -> ifvgState == "Bullish"  -> type = "bullish"
    """
    n = len(df)
    highs = df["high"].values
    lows = df["low"].values
    closes = df["close"].values
    dates = df.index

    fvg_array: list[dict] = []
    last_trade_day = -1

    for i in range(2, n):
        current_day = dates[i].date() if hasattr(dates[i], "date") else i
        if current_day != last_trade_day:
            fvg_array = []
            last_trade_day = current_day

        # Bullish FVG: low[i] > high[i-2]
        if lows[i] > highs[i - 2]:
            fvg_array.insert(0, {
                "top": lows[i],
                "bottom": highs[i - 2],
                "is_bullish": True,
                "start_bar": i,
                "is_inverted": False,
                "invert_bar": None,
            })

        # Bearish FVG: high[i] < low[i-2]
        if highs[i] < lows[i - 2]:
            fvg_array.insert(0, {
                "top": lows[i - 2],
                "bottom": highs[i],
                "is_bullish": False,
                "start_bar": i,
                "is_inverted": False,
                "invert_bar": None,
            })

        # Inversion check
        for fvg in fvg_array:
            if not fvg["is_inverted"]:
                if fvg["is_bullish"]:
                    if closes[i] < fvg["bottom"]:
                        fvg["is_inverted"] = True
                        fvg["invert_bar"] = i
                else:
                    if closes[i] > fvg["top"]:
                        fvg["is_inverted"] = True
                        fvg["invert_bar"] = i

    # Collect non-expired inverted zones
    last_bar_idx = n - 1
    zones = []
    for fvg in fvg_array:
        if fvg["is_inverted"]:
            bars_since_inversion = last_bar_idx - fvg["invert_bar"]
            if bars_since_inversion <= IFVG_LOOKBACK:
                start_ts = dates[fvg["start_bar"]]
                end_ts = dates[fvg["invert_bar"]]
                # Inverted bullish FVG -> IFVG state is "Bearish" -> zone type "bearish"
                # Inverted bearish FVG -> IFVG state is "Bullish" -> zone type "bullish"
                zone_type = "bearish" if fvg["is_bullish"] else "bullish"
                zones.append({
                    "top": float(fvg["top"]),
                    "bottom": float(fvg["bottom"]),
                    "startTime": int(start_ts.timestamp()),
                    "endTime": int(end_ts.timestamp()),
                    "type": zone_type,
                })

    return zones


def extract_cisd_level(df: pd.DataFrame) -> float | None:
    """
    Replicate the core CISD loop and return the final active CISD level price.

    After processing all bars:
    - If current_state is True (Bullish): the key level crossed was bear_cisd_level
    - If current_state is False (Bearish): the key level crossed was bull_cisd_level

    Returns None if the level is NaN.
    """
    import math as _math

    n = len(df)
    opens = df["open"].values.astype(float)
    highs = df["high"].values.astype(float)
    lows = df["low"].values.astype(float)
    closes = df["close"].values.astype(float)

    struct_top = 0.0
    struct_bottom = 0.0

    cisd_levels_bu: list[dict] = []
    cisd_levels_be: list[dict] = []

    is_bullish_pullback = False
    is_bearish_pullback = False
    potential_top = float("nan")
    potential_bottom = float("nan")
    bullish_break_idx = -1
    bearish_break_idx = -1

    bull_cisd_level = float("nan")
    bear_cisd_level = float("nan")
    current_state = False

    for i in range(1, n):
        bearish_pullback_detected = closes[i - 1] > opens[i - 1]
        bullish_pullback_detected = closes[i - 1] < opens[i - 1]

        if bearish_pullback_detected and not is_bearish_pullback:
            is_bearish_pullback = True
            potential_top = opens[i - 1]
            bullish_break_idx = i - 1

        if bullish_pullback_detected and not is_bullish_pullback:
            is_bullish_pullback = True
            potential_bottom = opens[i - 1]
            bearish_break_idx = i - 1

        if is_bullish_pullback:
            if opens[i] < potential_bottom:
                potential_bottom = opens[i]
                bearish_break_idx = i
            if (closes[i] < opens[i]) and (opens[i] > potential_bottom):
                potential_bottom = opens[i]
                bearish_break_idx = i

        if is_bearish_pullback:
            if opens[i] > potential_top:
                potential_top = opens[i]
                bullish_break_idx = i
            if (closes[i] > opens[i]) and opens[i] < potential_top:
                potential_top = opens[i]
                bullish_break_idx = i

        if lows[i] < struct_bottom:
            struct_bottom = lows[i]

            if is_bearish_pullback and (i - bullish_break_idx) != 0:
                offset = i - bullish_break_idx
                h1 = highs[i - offset] if (i - offset) >= 0 else float("nan")
                h2 = highs[i - offset + 1] if (i - offset + 1) >= 0 else float("nan")
                struct_top = max(h1, h2) if not (_math.isnan(h1) or _math.isnan(h2)) else max(h1, h2, default=0.0)
                is_bearish_pullback = False
                cisd_levels_be.append({"price": potential_top, "completed": False})
            elif closes[i - 1] > opens[i - 1] and closes[i] < opens[i]:
                struct_top = highs[i - 1]
                is_bearish_pullback = False
                cisd_levels_be.append({"price": potential_top, "completed": False})

        if highs[i] > struct_top:
            struct_top = highs[i]

            if is_bullish_pullback and (i - bearish_break_idx) != 0:
                offset = i - bearish_break_idx
                l1 = lows[i - offset] if (i - offset) >= 0 else float("nan")
                l2 = lows[i - offset + 1] if (i - offset + 1) >= 0 else float("nan")
                struct_bottom = min(l1, l2) if not (_math.isnan(l1) or _math.isnan(l2)) else min(l1, l2)
                is_bullish_pullback = False
                cisd_levels_bu.append({"price": potential_bottom, "completed": False})
            elif closes[i - 1] < opens[i - 1] and closes[i] > opens[i]:
                struct_bottom = lows[i - 1]
                is_bullish_pullback = False
                cisd_levels_bu.append({"price": potential_bottom, "completed": False})

        while len(cisd_levels_bu) > 1:
            cisd_levels_bu.pop(0)
        while len(cisd_levels_be) > 1:
            cisd_levels_be.pop(0)

        if cisd_levels_bu:
            latest = cisd_levels_bu[0]
            if closes[i] < latest["price"] and not latest["completed"] and closes[i - 1] > latest["price"]:
                latest["completed"] = True

        if cisd_levels_be:
            latest = cisd_levels_be[0]
            if closes[i] > latest["price"] and not latest["completed"] and closes[i - 1] < latest["price"]:
                latest["completed"] = True

        bull_cisd_level = cisd_levels_bu[0]["price"] if cisd_levels_bu else float("nan")
        bear_cisd_level = cisd_levels_be[0]["price"] if cisd_levels_be else float("nan")

        bull_cross = (
            not _math.isnan(bear_cisd_level)
            and closes[i] > bear_cisd_level
            and closes[i - 1] <= bear_cisd_level
        )
        bear_cross = (
            not _math.isnan(bull_cisd_level)
            and closes[i] < bull_cisd_level
            and closes[i - 1] >= bull_cisd_level
        )

        if bull_cross:
            current_state = True
        elif bear_cross:
            current_state = False

    # Return the level that defines the current state
    if current_state:
        # Bullish state: crossed above bear_cisd_level
        level = bear_cisd_level
    else:
        # Bearish state: crossed below bull_cisd_level
        level = bull_cisd_level

    return None if math.isnan(level) else float(level)


def extract_entry_markers(
    df: pd.DataFrame,
    ifvg_states: pd.Series,
    cisd_states: pd.Series,
    ema_series: pd.Series,
) -> list[dict]:
    """
    Detect entry conditions bar-by-bar and return markers.

    Long: ifvg_state=="Bullish" AND cisd_state=="Bullish" AND close > ema
    Short: ifvg_state=="Bearish" AND cisd_state=="Bearish" AND close < ema

    Returns list of {"time": int (unix seconds), "direction": "Long" | "Short"}.
    """
    markers = []
    closes = df["close"].values
    index = df.index

    for i, ts in enumerate(index):
        ifvg = ifvg_states.iloc[i]
        cisd = cisd_states.iloc[i]
        ema_val = ema_series.iloc[i]

        try:
            if math.isnan(float(ema_val)):
                continue
        except (TypeError, ValueError):
            continue

        close = closes[i]

        if ifvg == "Bullish" and cisd == "Bullish" and close > ema_val:
            markers.append({"time": int(ts.timestamp()), "direction": "Long"})
        elif ifvg == "Bearish" and cisd == "Bearish" and close < ema_val:
            markers.append({"time": int(ts.timestamp()), "direction": "Short"})

    return markers


@router.get("/chart/bars/{symbol}")
async def get_chart_bars(
    symbol: str,
    _user: str = Depends(get_current_user),
) -> dict:
    """
    Return OHLCV bars, EMA, IFVG zones, CISD level, and entry markers for a symbol.

    All timestamps are Unix epoch seconds (required by lightweight-charts).
    """
    bars = bar_store.get(symbol.upper())
    if not bars:
        raise HTTPException(status_code=404, detail=f"No bars available for symbol {symbol.upper()}")

    # Build DataFrame
    df = pd.DataFrame([
        {
            "timestamp": pd.to_datetime(b.timestamp),
            "open": b.open,
            "high": b.high,
            "low": b.low,
            "close": b.close,
            "volume": b.volume,
        }
        for b in bars
    ])
    df.set_index("timestamp", inplace=True)

    # Compute strategy overlays
    ema_series = compute_ema(df, period=20)
    ifvg_states = compute_ifvg(df)
    cisd_states = compute_cisd(df)

    # Build response lists
    bars_out = [
        {
            "time": int(ts.timestamp()),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
        }
        for ts, row in df.iterrows()
    ]

    ema_out = [
        {"time": int(ts.timestamp()), "value": float(val)}
        for ts, val in ema_series.items()
        if not math.isnan(float(val))
    ]

    ifvg_zones = extract_ifvg_zones(df)
    cisd_level = extract_cisd_level(df)
    markers = extract_entry_markers(df, ifvg_states, cisd_states, ema_series)

    return {
        "bars": bars_out,
        "ema": ema_out,
        "ifvg_zones": ifvg_zones,
        "cisd_level": cisd_level,
        "markers": markers,
    }
