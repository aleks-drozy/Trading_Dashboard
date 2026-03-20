"""
EMA (Exponential Moving Average) computation.

Logic extracted from docs/reference/FYP_BOT_1_3.pine line 499:
    ema = ta.ema(emaSource, emaLength)   # emaLength = 20, emaSource = close

pandas ewm(adjust=False) matches TradingView's recursive EMA formula exactly:
    EMA[t] = alpha * close[t] + (1 - alpha) * EMA[t-1]
    alpha = 2 / (length + 1)

Do NOT use:
- TA-Lib (C binary, unreliable on Render)
- rolling().mean() (that is SMA)
- pandas ewm(adjust=True)
"""

import pandas as pd


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
    result = df["close"].ewm(span=period, adjust=False).mean()
    result.name = "ema_20"
    return result
