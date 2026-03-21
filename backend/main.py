import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from backend.database import create_db_and_tables, get_engine
from backend.auth.router import router as auth_router
from backend.watchlist.router import router as watchlist_router
from backend.watchlist.repository import WatchlistRepository
from backend.data.binance_feed import binance_feed
from backend.data.yfinance_feed import poll_yfinance_loop
from backend.signals.broadcaster import broadcaster
from backend.signals.router import router as signals_router
from backend.paper.router import router as paper_router
from backend.charts.router import router as charts_router
from backend.backtest.router import router as backtest_router

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")


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

    # Build a callable that reads the current watchlist symbols on each call
    def get_watchlist_symbols() -> list[str]:
        with Session(get_engine()) as s:
            return [w.symbol for w in WatchlistRepository(s).get_all()]

    # Start data feed background tasks
    binance_task = asyncio.create_task(binance_feed.run())
    yfinance_task = asyncio.create_task(poll_yfinance_loop(get_watchlist_symbols))
    signal_task = asyncio.create_task(broadcaster.run())

    yield

    # Graceful shutdown: cancel all background tasks
    binance_task.cancel()
    yfinance_task.cancel()
    signal_task.cancel()
    await asyncio.gather(binance_task, yfinance_task, signal_task, return_exceptions=True)


app = FastAPI(title="Trading Dashboard", lifespan=lifespan)

# CORS middleware — must be added before router includes
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(watchlist_router, prefix="/watchlist", tags=["watchlist"])
app.include_router(signals_router, tags=["signals"])
app.include_router(paper_router, prefix="/paper", tags=["paper"])
app.include_router(charts_router, tags=["charts"])
app.include_router(backtest_router, tags=["backtest"])


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    """Health check endpoint used by Render and the keep-alive cron job."""
    return {"status": "ok"}
