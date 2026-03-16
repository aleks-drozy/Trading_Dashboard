from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from backend.database import get_session
from backend.dependencies import get_current_user
from backend.watchlist.repository import WatchlistRepository

router = APIRouter()


class WatchlistAddRequest(BaseModel):
    symbol: str
    asset_type: Literal["stock", "crypto"]


@router.get("")
def list_watchlist(
    session: Session = Depends(get_session),
    current_user: str = Depends(get_current_user),
):
    repo = WatchlistRepository(session)
    return repo.get_all()


@router.post("", status_code=status.HTTP_201_CREATED)
def add_to_watchlist(
    body: WatchlistAddRequest,
    session: Session = Depends(get_session),
    current_user: str = Depends(get_current_user),
):
    repo = WatchlistRepository(session)
    try:
        item = repo.add(body.symbol, body.asset_type)
    except IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Symbol already in watchlist",
        )
    return item


@router.delete("/{symbol}", status_code=status.HTTP_200_OK)
def remove_from_watchlist(
    symbol: str,
    session: Session = Depends(get_session),
    current_user: str = Depends(get_current_user),
):
    repo = WatchlistRepository(session)
    removed = repo.remove(symbol.upper())
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Symbol not found",
        )
    return {"detail": "Symbol removed"}
