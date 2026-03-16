from sqlmodel import Session, select

from backend.watchlist.models import WatchlistSymbol


class WatchlistRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_all(self) -> list[WatchlistSymbol]:
        return list(self._session.exec(select(WatchlistSymbol)).all())

    def add(self, symbol: str, asset_type: str) -> WatchlistSymbol:
        item = WatchlistSymbol(symbol=symbol.upper(), asset_type=asset_type)
        self._session.add(item)
        self._session.commit()
        self._session.refresh(item)
        return item

    def remove(self, symbol: str) -> bool:
        item = self._session.exec(
            select(WatchlistSymbol).where(WatchlistSymbol.symbol == symbol.upper())
        ).first()
        if item is None:
            return False
        self._session.delete(item)
        self._session.commit()
        return True
