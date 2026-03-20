from fastapi import APIRouter, Depends
from sqlmodel import Session

from backend.database import get_session
from backend.dependencies import get_current_user
from backend.paper.repository import PaperTradeRepository
from backend.paper.engine import STARTING_BALANCE

router = APIRouter()


@router.get("/trades")
def get_trades(
    session: Session = Depends(get_session),
    _user: str = Depends(get_current_user),
):
    repo = PaperTradeRepository(session)
    trades = repo.get_closed_trades()
    return [
        {
            "id": t.id,
            "symbol": t.symbol,
            "direction": t.direction,
            "entry_price": t.entry_price,
            "exit_price": t.exit_price,
            "stop_price": t.stop_price,
            "target_price": t.target_price,
            "pnl": t.pnl,
            "outcome": t.outcome,
            "closed_at": t.closed_at.isoformat() if t.closed_at else None,
        }
        for t in trades
    ]


@router.get("/portfolio")
def get_portfolio(
    session: Session = Depends(get_session),
    _user: str = Depends(get_current_user),
):
    repo = PaperTradeRepository(session)
    total_pnl = repo.get_total_pnl()
    balance = STARTING_BALANCE + total_pnl
    return {
        "starting_balance": STARTING_BALANCE,
        "total_pnl": total_pnl,
        "current_balance": balance,
        "pnl_percent": (total_pnl / STARTING_BALANCE) * 100 if STARTING_BALANCE else 0,
    }
