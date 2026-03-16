"""
EMA (Exponential Moving Average) computation.

Logic extracted from docs/reference/FYP_BOT_1_3.pine line 499:
    ema = ta.ema(emaSource, emaLength)   # emaLength = 20, emaSource = close

pandas-ta with adjust=False matches TradingView's recursive EMA formula:
    EMA[t] = alpha * close[t] + (1 - alpha) * EMA[t-1]
    alpha = 2 / (length + 1)

Do NOT use:
- TA-Lib (C binary, unreliable on Render)
- rolling().mean() (that is SMA)
- pandas ewm(adjust=True)
"""

import pandas as pd
import pandas_ta as ta  # type: ignore


def compute_ema(df: pd.DataFrame, period: int = 20) -> pd.Series:
    """
    Compute EMA of close prices.

    Parameters
    ----------
    df : pd.DataFrame
        OHLCV DataFrame with 'close' column.
    period : int
        EMA period. Default 20 (matches Pine source emaLength=20).

    Returns
    -------
    pd.Series
        EMA values. Index matches df.index.
        First (period - 1) values will be NaN (insufficient history).
    """
    result = df.ta.ema(close=df["close"], length=period, adjust=False)
    if result is None:
        raise ValueError(f"pandas-ta returned None for EMA(period={period}) — check DataFrame length")
    result.name = "ema_20"
    return result
