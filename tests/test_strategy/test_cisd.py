"""
CISD bar-by-bar tests vs TradingView reference fixtures.

When fixtures contain only header rows (placeholder CSVs), tests skip gracefully.
"""
import pytest
import pandas as pd
from pathlib import Path

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
WARMUP = 60


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
def test_cisd_matches_tradingview(fixture_name):
    from backend.strategy.cisd import compute_cisd

    df = _load_fixture(fixture_name)
    df = _normalize_columns(df)

    if len(df) < WARMUP + 1:
        pytest.skip(f"Fixture {fixture_name} has no data rows — replace with real TradingView export to enable")

    result_series = compute_cisd(df)

    ref = df["cisd_state"].iloc[WARMUP:]
    computed = result_series.iloc[WARMUP:]

    mismatches = (ref != computed).sum()
    assert mismatches == 0, (
        f"{mismatches} CISD mismatches vs TradingView in {fixture_name} — "
        f"first 5:\n{(ref != computed)[ref != computed].head()}"
    )
