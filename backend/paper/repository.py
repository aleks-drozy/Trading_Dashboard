from sqlmodel import Session, select
from backend.paper.models import PaperTrade
from datetime import datetime


class PaperTradeRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create(self, trade: PaperTrade) -> PaperTrade:
        self._session.add(trade)
        self._session.commit()
        self._session.refresh(trade)
        return trade

    def get_open_trades(self, symbol: str | None = None) -> list[PaperTrade]:
        stmt = select(PaperTrade).where(PaperTrade.status == "open")
        if symbol:
            stmt = stmt.where(PaperTrade.symbol == symbol)
        return list(self._session.exec(stmt).all())

    def get_closed_trades(self) -> list[PaperTrade]:
        return list(self._session.exec(
            select(PaperTrade).where(PaperTrade.status == "closed").order_by(PaperTrade.closed_at.desc())
        ).all())

    def has_trade_today(self, symbol: str, trade_date: str) -> bool:
        result = self._session.exec(
            select(PaperTrade).where(
                PaperTrade.symbol == symbol,
                PaperTrade.trade_date == trade_date
            )
        ).first()
        return result is not None

    def close_trade(self, trade: PaperTrade, exit_price: float, outcome: str) -> PaperTrade:
        trade.exit_price = exit_price
        trade.outcome = outcome
        trade.status = "closed"
        trade.closed_at = datetime.utcnow()
        if trade.direction == "Long":
            trade.pnl = (exit_price - trade.entry_price) * trade.quantity
        else:
            trade.pnl = (trade.entry_price - exit_price) * trade.quantity
        self._session.add(trade)
        self._session.commit()
        self._session.refresh(trade)
        return trade

    def get_total_pnl(self) -> float:
        trades = self.get_closed_trades()
        return sum(t.pnl or 0.0 for t in trades)
