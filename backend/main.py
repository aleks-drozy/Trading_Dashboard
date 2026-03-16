from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.database import create_db_and_tables
from backend.auth.router import router as auth_router
from backend.watchlist.router import router as watchlist_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    yield


app = FastAPI(title="Trading Dashboard", lifespan=lifespan)
app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(watchlist_router, prefix="/watchlist", tags=["watchlist"])
