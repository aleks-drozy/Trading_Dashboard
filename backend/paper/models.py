from typing import Optional
from datetime import datetime
from sqlmodel import Field, SQLModel


class PaperTrade(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True)
    direction: str  # "Long" | "Short"
    entry_price: float
    exit_price: Optional[float] = None
    stop_price: float
    target_price: float
    risk_amount: float  # dollar risk = $1000 fixed per CONTEXT.md
    quantity: float  # risk_amount / abs(entry - stop)
    pnl: Optional[float] = None  # dollar P&L when closed
    outcome: Optional[str] = None  # "Win" | "Loss" | None (open)
    status: str = "open"  # "open" | "closed"
    opened_at: datetime = Field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None
    trade_date: str  # "YYYY-MM-DD" for max-1-per-day-per-symbol check
