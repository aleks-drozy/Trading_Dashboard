"""
Paper trading engine — auto-places trades on entry signals, auto-closes on stop/target.

Entry condition (Pine lines 508-509):
  longEntry = bullDouble AND inTradingSession AND noTradeOpen AND canTradeNow AND close > ema
  shortEntry = bearDouble AND inTradingSession AND noTradeOpen AND canTradeNow AND close < ema

bullDouble (Pine line 443):
  (lastIfvgState == "Bullish" AND ifvgState == "Bullish" AND cisdTurnedBullish)
  OR (ifvgTurnedBullish AND cisdTurnedBullish)

For simplification in Phase 2, we detect entry as:
  Long: ifvg_state == "Bullish" AND cisd_state == "Bullish" AND ema_condition == "above"
  Short: ifvg_state == "Bearish" AND cisd_state == "Bearish" AND ema_condition == "below"

This is a conservative approximation — all three indicators must align.
Full bullDouble/bearDouble transition detection requires tracking previous bar state,
which can be added as a refinement in Phase 3.

Stop/target (Pine lines 489-490, 514-528):
  Long stop = min(low) over last 8 bars (swingLookback=8)
  Short stop = max(high) over last 8 bars
  Risk = abs(entry - stop)
  Target = entry + risk * 1.5 (riskRewardRatio=1.5)

Risk per trade: $1,000 fixed (CONTEXT.md Claude's discretion)
Quantity: risk_amount / abs(entry - stop)
"""

from datetime import datetime
from zoneinfo import ZoneInfo
import logging

from sqlmodel import Session

from backend.data.bar_store import bar_store, Bar
from backend.database import get_engine
from backend.paper.models import PaperTrade
from backend.paper.repository import PaperTradeRepository
from backend.signals.session import is_ny_session_active

# Lazy import to avoid pandas_ta -> numba -> llvmlite chain at module load
# (mirrors pattern from backend/signals/broadcaster.py)
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from backend.strategy.engine import StrategyResult

logger = logging.getLogger(__name__)

RISK_PER_TRADE = 1000.0  # $1,000 fixed risk per trade
SWING_LOOKBACK = 8
RISK_REWARD_RATIO = 1.5
STARTING_BALANCE = 100_000.0


class PaperTradingEngine:

    def check_and_close_open_trades(self) -> None:
        """Check all open trades against current bar data for stop/target hits."""
        with Session(get_engine()) as session:
            repo = PaperTradeRepository(session)
            open_trades = repo.get_open_trades()
            for trade in open_trades:
                bars = bar_store.get(trade.symbol)
                if not bars:
                    continue
                latest_bar = bars[-1]
                if trade.direction == "Long":
                    if latest_bar.low <= trade.stop_price:
                        repo.close_trade(trade, trade.stop_price, "Loss")
                        logger.info(f"Paper trade CLOSED (stop): {trade.symbol} Long at {trade.stop_price}")
                    elif latest_bar.high >= trade.target_price:
                        repo.close_trade(trade, trade.target_price, "Win")
                        logger.info(f"Paper trade CLOSED (target): {trade.symbol} Long at {trade.target_price}")
                else:  # Short
                    if latest_bar.high >= trade.stop_price:
                        repo.close_trade(trade, trade.stop_price, "Loss")
                        logger.info(f"Paper trade CLOSED (stop): {trade.symbol} Short at {trade.stop_price}")
                    elif latest_bar.low <= trade.target_price:
                        repo.close_trade(trade, trade.target_price, "Win")
                        logger.info(f"Paper trade CLOSED (target): {trade.symbol} Short at {trade.target_price}")

    def on_signal(self, symbol: str, result: "StrategyResult", bars: list[Bar]) -> PaperTrade | None:
        """
        Called after each signal computation. Places a paper trade if entry conditions are met.
        Returns the PaperTrade if one was placed, None otherwise.
        """
        if not is_ny_session_active():
            return None

        # Determine direction
        direction = None
        if result.ifvg_state == "Bullish" and result.cisd_state == "Bullish" and result.ema_condition == "above":
            direction = "Long"
        elif result.ifvg_state == "Bearish" and result.cisd_state == "Bearish" and result.ema_condition == "below":
            direction = "Short"

        if direction is None:
            return None

        now_et = datetime.now(ZoneInfo("America/New_York"))
        trade_date = now_et.strftime("%Y-%m-%d")

        with Session(get_engine()) as session:
            repo = PaperTradeRepository(session)

            # Max 1 trade per day per asset
            if repo.has_trade_today(symbol, trade_date):
                return None

            # No open trade for this symbol
            if repo.get_open_trades(symbol):
                return None

            # Entry price = close of current (signal) bar
            entry_price = bars[-1].close if bars else 0.0
            if entry_price == 0.0:
                return None

            # Swing high/low over last 8 bars
            lookback_bars = bars[-SWING_LOOKBACK:] if len(bars) >= SWING_LOOKBACK else bars
            if direction == "Long":
                stop_price = min(b.low for b in lookback_bars)
                risk = entry_price - stop_price
                if risk <= 0:
                    return None
                target_price = entry_price + risk * RISK_REWARD_RATIO
            else:
                stop_price = max(b.high for b in lookback_bars)
                risk = stop_price - entry_price
                if risk <= 0:
                    return None
                target_price = entry_price - risk * RISK_REWARD_RATIO

            quantity = RISK_PER_TRADE / risk

            trade = PaperTrade(
                symbol=symbol,
                direction=direction,
                entry_price=entry_price,
                stop_price=stop_price,
                target_price=target_price,
                risk_amount=RISK_PER_TRADE,
                quantity=quantity,
                trade_date=trade_date,
            )
            created = repo.create(trade)
            logger.info(f"Paper trade OPENED: {symbol} {direction} at {entry_price}, stop={stop_price}, target={target_price}")
            return created


paper_engine = PaperTradingEngine()
