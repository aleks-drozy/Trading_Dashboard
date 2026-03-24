"""
Unit tests for resample_bars helper and chart endpoint timeframe param.

Tests:
  1. resample identity: resample_bars(df, 1) returns df.iloc[:-1]
  2. resample 5m: resample_bars(df, 5) returns correct OHLCV aggregation
  3. resample dropna: non-contiguous timestamps produce no NaN rows
  4. invalid timeframe: resample_bars(df, 7) raises ValueError
  5. endpoint 422: GET /chart/bars/SPY?timeframe=7 returns 422
  6. endpoint passes timeframe: GET /chart/bars/SPY?timeframe=5 returns resampled bars
  7. insufficient bars 404: GET /chart/bars/SPY?timeframe=60 returns 404 when <22 resampled rows
"""
import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch
from fastapi.testclient import TestClient

from backend.charts.router import resample_bars, VALID_TIMEFRAMES, MIN_BARS_REQUIRED
from backend.data.bar_store import Bar
from backend.main import app
from backend.dependencies import get_current_user


def _make_1m_df(n: int, start: str = "2026-03-20 09:30") -> pd.DataFrame:
    """Build a synthetic 1-minute OHLCV DataFrame with DatetimeIndex."""
    idx = pd.date_range(start=start, periods=n, freq="1min", tz="UTC")
    df = pd.DataFrame(
        {
            "open":   [100.0 + i * 0.1 for i in range(n)],
            "high":   [101.0 + i * 0.1 for i in range(n)],
            "low":    [99.0  + i * 0.1 for i in range(n)],
            "close":  [100.5 + i * 0.1 for i in range(n)],
            "volume": [1000.0] * n,
        },
        index=idx,
    )
    return df


def _make_bars(n: int, start: str = "2026-03-20 09:30") -> list[Bar]:
    """Build a list of Bar objects for mocking bar_store.get()."""
    idx = pd.date_range(start=start, periods=n, freq="1min", tz="UTC")
    bars = []
    for i, ts in enumerate(idx):
        bars.append(
            Bar(
                timestamp=ts.to_pydatetime(),
                open=100.0 + i * 0.1,
                high=101.0 + i * 0.1,
                low=99.0  + i * 0.1,
                close=100.5 + i * 0.1,
                volume=1000.0,
            )
        )
    return bars


# ---------------------------------------------------------------------------
# Test 1: resample identity (timeframe=1 returns df.iloc[:-1])
# ---------------------------------------------------------------------------

def test_resample_identity_drops_last_bar():
    """resample_bars(df, 1) should return df.iloc[:-1] — drops in-progress bar only."""
    df = _make_1m_df(10)
    result = resample_bars(df, 1)
    expected = df.iloc[:-1]

    assert len(result) == len(expected), f"Expected {len(expected)} rows, got {len(result)}"
    pd.testing.assert_frame_equal(result, expected)


# ---------------------------------------------------------------------------
# Test 2: resample 5m OHLCV aggregation
# ---------------------------------------------------------------------------

def test_resample_5m_aggregation():
    """resample_bars(df_10_1m_bars, 5) returns 1 complete row with correct OHLCV."""
    df = _make_1m_df(10)
    result = resample_bars(df, 5)

    # 10 bars / 5 = 2 buckets; iloc[:-1] drops last in-progress = 1 row
    assert len(result) == 1, f"Expected 1 row, got {len(result)}"

    # First 5-minute bucket: bars 0-4
    assert result.iloc[0]["open"]   == df.iloc[0]["open"],   "open should be first 1m open"
    assert result.iloc[0]["high"]   == df.iloc[:5]["high"].max(), "high should be max of 5 highs"
    assert result.iloc[0]["low"]    == df.iloc[:5]["low"].min(),  "low should be min of 5 lows"
    assert result.iloc[0]["close"]  == df.iloc[4]["close"],  "close should be last 1m close"
    assert result.iloc[0]["volume"] == df.iloc[:5]["volume"].sum(), "volume should be sum"


# ---------------------------------------------------------------------------
# Test 3: resample dropna (gaps produce no NaN rows)
# ---------------------------------------------------------------------------

def test_resample_dropna_with_gaps():
    """resample_bars with non-contiguous timestamps should produce no NaN rows."""
    # Create two separate 5-bar blocks with a gap between them
    idx1 = pd.date_range(start="2026-03-20 09:30", periods=5, freq="1min", tz="UTC")
    idx2 = pd.date_range(start="2026-03-20 11:00", periods=5, freq="1min", tz="UTC")
    idx = idx1.append(idx2)

    df = pd.DataFrame(
        {
            "open":   [100.0] * 10,
            "high":   [101.0] * 10,
            "low":    [99.0]  * 10,
            "close":  [100.5] * 10,
            "volume": [1000.0] * 10,
        },
        index=idx,
    )

    result = resample_bars(df, 5)

    # No NaN values anywhere
    assert not result.isnull().any().any(), "Result should contain no NaN values after dropna"
    assert len(result) >= 1, "Should have at least one complete resampled bar"


# ---------------------------------------------------------------------------
# Test 4: invalid timeframe raises ValueError
# ---------------------------------------------------------------------------

def test_resample_invalid_timeframe_raises():
    """resample_bars(df, 7) should raise ValueError for unsupported timeframes."""
    df = _make_1m_df(20)
    with pytest.raises(ValueError, match="Invalid timeframe"):
        resample_bars(df, 7)


def test_resample_valid_timeframes_accepted():
    """All valid timeframes (1, 5, 15, 60) should not raise ValueError."""
    df = _make_1m_df(200)
    for tf in VALID_TIMEFRAMES:
        # Should not raise
        result = resample_bars(df, tf)
        assert isinstance(result, pd.DataFrame)


# ---------------------------------------------------------------------------
# Endpoint tests (using FastAPI TestClient with mocked auth + bar_store)
# ---------------------------------------------------------------------------

@pytest.fixture
def auth_override():
    """Override get_current_user so all endpoint tests pass auth."""
    app.dependency_overrides[get_current_user] = lambda: "testuser"
    yield
    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Test 5: endpoint 422 on invalid timeframe
# ---------------------------------------------------------------------------

def test_endpoint_invalid_timeframe_returns_422(auth_override):
    """GET /chart/bars/SPY?timeframe=7 should return 422."""
    # Provide enough bars so we don't hit the 404 for no bars
    mock_bars = _make_bars(50)

    with patch("backend.charts.router.bar_store") as mock_store:
        mock_store.get.return_value = mock_bars
        with TestClient(app) as client:
            response = client.get("/chart/bars/SPY?timeframe=7")

    assert response.status_code == 422, f"Expected 422, got {response.status_code}"
    assert "timeframe must be 1, 5, 15, or 60" in response.json()["detail"]


# ---------------------------------------------------------------------------
# Test 6: endpoint returns resampled bars for timeframe=5
# ---------------------------------------------------------------------------

def test_endpoint_timeframe_5_returns_resampled_bars(auth_override):
    """GET /chart/bars/SPY?timeframe=5 should return bars aggregated to 5-minute resolution."""
    # 100 1m bars -> 20 complete 5m buckets -> after iloc[:-1] -> 19 bars (above MIN_BARS_REQUIRED=22)
    # Use more bars to ensure we have at least 22 after resampling
    mock_bars = _make_bars(200)

    with patch("backend.charts.router.bar_store") as mock_store:
        mock_store.get.return_value = mock_bars
        with TestClient(app) as client:
            response = client.get("/chart/bars/SPY?timeframe=5")

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "bars" in data
    assert len(data["bars"]) > 0

    # All bar timestamps should be at 5-minute boundaries (divisible by 300 seconds)
    for bar in data["bars"]:
        ts = bar["time"]
        assert ts % 300 == 0, f"Timestamp {ts} is not at a 5-minute boundary"


# ---------------------------------------------------------------------------
# Test 7: endpoint returns 404 when insufficient bars for 60m timeframe
# ---------------------------------------------------------------------------

def test_endpoint_insufficient_bars_for_1h_returns_404(auth_override):
    """GET /chart/bars/SPY?timeframe=60 returns 404 when fewer than 22 resampled bars."""
    # 30 1m bars resampled to 60m gives 0 complete 60m bars (after iloc[:-1])
    # This will definitely be < 22 bars
    mock_bars = _make_bars(30)

    with patch("backend.charts.router.bar_store") as mock_store:
        mock_store.get.return_value = mock_bars
        with TestClient(app) as client:
            response = client.get("/chart/bars/SPY?timeframe=60")

    assert response.status_code == 404, f"Expected 404, got {response.status_code}: {response.text}"
    assert "Insufficient bars" in response.json()["detail"]
