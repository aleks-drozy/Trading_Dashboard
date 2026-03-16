"""
In-memory bar store: thread-safe symbol -> list[Bar] mapping.
Module-level singleton `bar_store` imported by feeds and strategy engine.
"""
import threading
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Bar:
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class BarStore:
    """Thread-safe in-memory store: symbol -> list of recent closed bars."""

    def __init__(self):
        self._data: dict[str, list[Bar]] = {}
        self._lock = threading.Lock()

    def update(self, symbol: str, bars: list[Bar]) -> None:
        with self._lock:
            self._data[symbol] = bars

    def get(self, symbol: str) -> list[Bar]:
        with self._lock:
            return self._data.get(symbol, [])

    def symbols(self) -> list[str]:
        with self._lock:
            return list(self._data.keys())


# Module-level singleton — imported by feeds and strategy engine
bar_store = BarStore()
