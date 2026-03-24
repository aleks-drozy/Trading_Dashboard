"""
StrategyEngine — orchestrates IFVG + CISD + EMA computations.

CRITICAL GUARDRAIL: First operation in run() is `df = df.iloc[:-1]` which drops
the open (current, incomplete) bar. This prevents lookahead bias.

The engine returns a StrategyResult for the last CLOSED bar in the input DataFrame.

Logic reference:
  - IFVG: backend/strategy/ifvg.py (from FYP_BOT_1_3.pine lines 109-484)
  - CISD: backend/strategy/cisd.py (from FYP_BOT_1_3.pine lines 37-289)
  - EMA:  backend/strategy/ema.py  (from FYP_BOT_1_3.pine line 499)
  - Entry condition (Pine line 508-509):
      longEntry when close > ema  -> EMACondition "above"
      shortEntry when close < ema -> EMACondition "below"
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import pandas as pd

from backend.strategy.ifvg import compute_ifvg
from backend.strategy.cisd import compute_cisd
from backend.strategy.ema import compute_ema

IFVGState = Literal["Bullish", "Bearish", "None", "Expired"]
CISDState = Literal["Bullish", "Bearish"]
EMACondition = Literal["above", "below"]


@dataclass(frozen=True)
class StrategyResult:
    ifvg_state: IFVGState
    cisd_state: CISDState
    ema_condition: EMACondition
    ema_value: float
    bar_index: int

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, StrategyResult):
            return NotImplemented
        return (
            self.ifvg_state == other.ifvg_state
            and self.cisd_state == other.cisd_state
            and self.ema_condition == other.ema_condition
            and abs(self.ema_value - other.ema_value) < 1e-9
            and self.bar_index == other.bar_index
        )


class StrategyEngine:
    """
    Compute strategy signals for the last closed bar.

    Usage:
        result = StrategyEngine().run(df)

    df must contain columns: open, high, low, close, volume.
    The last row of df is the open (current, incomplete) bar and is EXCLUDED.
    """

    def run(self, df: pd.DataFrame) -> StrategyResult:
        """
        Run strategy on a DataFrame of bars.

        Parameters
        ----------
        df : pd.DataFrame
            OHLCV bars. Last row is the open bar (will be excluded).

        Returns
        -------
        StrategyResult
            Signal state for the last CLOSED bar (second-to-last of input).
        """
        # LOOKAHEAD GUARDRAIL: drop open bar before ANY computation
        df = df.iloc[:-1]

        ifvg_series = compute_ifvg(df)
        cisd_series = compute_cisd(df)
        ema_series = compute_ema(df, period=20)

        last_idx = len(df) - 1
        last_close = float(df["close"].iloc[last_idx])
        last_ema = float(ema_series.iloc[last_idx])

        ifvg_state: IFVGState = ifvg_series.iloc[last_idx]  # type: ignore[assignment]
        cisd_state: CISDState = cisd_series.iloc[last_idx]  # type: ignore[assignment]
        ema_condition: EMACondition = "above" if last_close > last_ema else "below"

        return StrategyResult(
            ifvg_state=ifvg_state,
            cisd_state=cisd_state,
            ema_condition=ema_condition,
            ema_value=last_ema,
            bar_index=last_idx,
        )
