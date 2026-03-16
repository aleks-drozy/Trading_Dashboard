from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import Session

from backend.database import create_db_and_tables, get_engine
from backend.auth.router import router as auth_router
from backend.watchlist.router import router as watchlist_router
from backend.watchlist.repository import WatchlistRepository


def seed_defaults(session: Session) -> None:
    """Seed SPY + BTCUSDT if watchlist is empty."""
    repo = WatchlistRepository(session)
    if not repo.get_all():
        repo.add("SPY", "stock")
        repo.add("BTCUSDT", "crypto")


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    with Session(get_engine()) as session:
        seed_defaults(session)
    yield


app = FastAPI(title="Trading Dashboard", lifespan=lifespan)
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(watchlist_router, prefix="/watchlist", tags=["watchlist"])
