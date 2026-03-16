from typing import Optional

from sqlmodel import Field, SQLModel


class WatchlistSymbol(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True, unique=True)
    asset_type: str  # "stock" | "crypto"
