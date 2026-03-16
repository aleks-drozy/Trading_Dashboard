"""
StrategyEngine integration tests and lookahead bias test.

The lookahead bias test must pass regardless of fixture data availability.
"""
import pytest
import pandas as pd
import numpy as np
from pathlib import Path
from dataclasses import dataclass

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
WARMUP = 60


def _load_fixture(name: str) -> pd.DataFrame:
    path = FIXTURES_DIR / name
    df = pd.read_csv(path, comment="#", parse_dates=["timestamp"])
    df = df.set_index("timestamp")
    return df


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    rename = {}
    for col in df.columns:
        lower = col.lower().strip()
        if lower in ("open", "o"):
            rename[col] = "open"
        elif lower in ("high", "h"):
            rename[col] = "high"
        elif lower in ("low", "l"):
            rename[col] = "low"
        elif lower in ("close", "c"):
            rename[col] = "close"
        elif lower in ("volume", "vol", "v"):
            rename[col] = "volume"
        elif lower in ("ifvg_state", "ifvg state", "ifvgstate"):
            rename[col] = "ifvg_state"
        elif lower in ("cisd_state", "cisd state", "cisdstate"):
            rename[col] = "cisd_state"
        elif lower in ("ema_20", "ema20", "ema 20"):
            rename[col] = "ema_20"
    return df.rename(columns=rename)


def _make_synthetic_df(n: int = 110) -> pd.DataFrame:
    """Create a synthetic OHLCV DataFrame for use when fixtures are placeholder-only."""
    np.random.seed(42)
    base = 400.0
    closes = base + np.cumsum(np.random.randn(n) * 0.5)
    opens = closes + np.random.randn(n) * 0.2
    highs = np.maximum(opens, closes) + np.abs(np.random.randn(n) * 0.3)
    lows = np.minimum(opens, closes) - np.abs(np.random.randn(n) * 0.3)
    volumes = np.random.randint(100_000, 1_000_000, size=n).astype(float)
    idx = pd.date_range("2025-01-02 09:30", periods=n, freq="1min")
    return pd.DataFrame({"open": opens, "high": highs, "low": lows, "close": closes, "volume": volumes}, index=idx)


def test_no_lookahead_bias():
    """
    The lookahead bias test must pass regardless of fixture data.

    Tampering the last bar (the open/current bar) must NOT change StrategyEngine output.
    This verifies the guardrail: engine.py first line is `df = df.iloc[:-1]`.
    """
    from backend.strategy.engine import StrategyEngine

    # Use synthetic data to avoid dependency on placeholder fixtures
    df = _make_synthetic_df(n=110)

    # Run engine on original
    result_a = StrategyEngine().run(df)

    # Tamper the last bar (extreme close change)
    df_tampered = df.copy()
    df_tampered.iloc[-1, df_tampered.columns.get_loc("close")] = (
        df_tampered.iloc[-1]["close"] * 10
    )
    result_b = StrategyEngine().run(df_tampered)

    assert result_a == result_b, (
        "Strategy result changed when open bar was tampered — lookahead bias present.\n"
        f"result_a: {result_a}\nresult_b: {result_b}"
    )


def test_engine_returns_strategy_result():
    """StrategyEngine.run() returns a StrategyResult dataclass with required fields."""
    from backend.strategy.engine import StrategyEngine, StrategyResult

    df = _make_synthetic_df(n=110)
    result = StrategyEngine().run(df)

    assert isinstance(result, StrategyResult)
    assert result.ifvg_state in ("Bullish", "Bearish", "None", "Expired")
    assert result.cisd_state in ("Bullish", "Bearish")
    assert result.ema_condition in ("above", "below")
    assert isinstance(result.ema_value, float)
    assert isinstance(result.bar_index, int)


def test_engine_bar_index_is_last_closed():
    """bar_index should be the index of the last CLOSED bar (second-to-last of input)."""
    from backend.strategy.engine import StrategyEngine

    df = _make_synthetic_df(n=110)
    result = StrategyEngine().run(df)

    # After iloc[:-1], last bar is index 108 (0-based) = len(df) - 2
    expected_bar_index = len(df) - 2
    assert result.bar_index == expected_bar_index


@pytest.mark.parametrize("fixture_name", [
    "spy_1min_tv_reference.csv",
    "btcusdt_1min_tv_reference.csv",
])
def test_engine_runs_on_fixture(fixture_name):
    """StrategyEngine runs without error on real fixture data."""
    from backend.strategy.engine import StrategyEngine, StrategyResult

    df = _load_fixture(fixture_name)
    df = _normalize_columns(df)

    if len(df) < WARMUP + 2:
        pytest.skip(f"Fixture {fixture_name} has no data rows — replace with real TradingView export to enable")

    result = StrategyEngine().run(df)
    assert isinstance(result, StrategyResult)
