"""
EMA bar-by-bar tests vs TradingView reference fixtures.

When fixtures contain only header rows (placeholder CSVs), tests skip gracefully.
EMA tolerance: 0.01% relative (TradingView and pandas-ta both use adjust=False recursive EMA).
"""
import pytest
import pandas as pd
import numpy as np
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
WARMUP = 60
EMA_TOLERANCE = 0.0001  # 0.01% relative tolerance


def _load_fixture(name: str) -> pd.DataFrame:
    path = FIXTURES_DIR / name
    df = pd.read_csv(path, comment="#", parse_dates=["timestamp"])
    df = df.set_index("timestamp")
    return df


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize column names to expected schema."""
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


@pytest.mark.parametrize("fixture_name", [
    "spy_1min_tv_reference.csv",
    "btcusdt_1min_tv_reference.csv",
])
def test_ema_matches_tradingview(fixture_name):
    from backend.strategy.ema import compute_ema

    df = _load_fixture(fixture_name)
    df = _normalize_columns(df)

    if len(df) < WARMUP + 1:
        pytest.skip(f"Fixture {fixture_name} has no data rows — replace with real TradingView export to enable")

    result_series = compute_ema(df, period=20)

    ref = df["ema_20"].iloc[WARMUP:].astype(float)
    computed = result_series.iloc[WARMUP:].astype(float)

    # Relative tolerance: abs(computed - ref) / ref < 0.01%
    rel_diff = np.abs(computed.values - ref.values) / np.abs(ref.values)
    violations = (rel_diff >= EMA_TOLERANCE).sum()

    assert violations == 0, (
        f"{violations} EMA values exceed 0.01% tolerance in {fixture_name} — "
        f"max deviation: {rel_diff.max():.6f}"
    )
