"""Drawdown, volatility, and snapshot-based performance (INR book)."""

from __future__ import annotations

import math
from statistics import mean, pstdev
from typing import Any

from app.schemas import PortfolioPerformance


def _daily_returns(series: list[float]) -> list[float]:
    out: list[float] = []
    for i in range(1, len(series)):
        a, b = series[i - 1], series[i]
        if a <= 0:
            continue
        out.append((b - a) / a)
    return out


def _max_drawdown(series: list[float]) -> tuple[float | None, float | None]:
    """Return (max_drawdown_pct, current_drawdown_pct) as negative fractions * 100."""
    if len(series) < 2:
        return None, None
    peak = series[0]
    max_dd = 0.0
    cur = series[-1]
    cur_peak = peak
    for v in series:
        if v > peak:
            peak = v
        dd = (v - peak) / peak if peak > 0 else 0.0
        if dd < max_dd:
            max_dd = dd
        cur_peak = max(cur_peak, v)
    cur_dd = (cur - cur_peak) / cur_peak if cur_peak > 0 else None
    return round(max_dd * 100.0, 4), round((cur_dd or 0.0) * 100.0, 4) if cur_dd is not None else (round(max_dd * 100.0, 4), None)


def _ann_vol(returns: list[float], window: int) -> float | None:
    if len(returns) < window:
        return None
    chunk = returns[-window:]
    if len(chunk) < 2:
        return None
    sd = pstdev(chunk)
    return round(sd * math.sqrt(252.0) * 100.0, 4)


def _sharpe(returns: list[float], window: int, rf_daily: float = 0.0) -> float | None:
    if len(returns) < window:
        return None
    chunk = [r - rf_daily for r in returns[-window:]]
    if len(chunk) < 2:
        return None
    mu = mean(chunk)
    sd = pstdev(chunk)
    if sd == 0:
        return None
    return round((mu / sd) * math.sqrt(252.0), 4)


def _naive_twrr(returns: list[float]) -> float | None:
    if not returns:
        return None
    acc = 1.0
    for r in returns:
        acc *= 1.0 + r
    return round((acc - 1.0) * 100.0, 4)


def compute_performance_from_history(history: list[dict[str, Any]], txs_count: int) -> PortfolioPerformance:
    """`history` rows: snapshot_date, inr_market_value (float)."""
    xirr_status = "unavailable"
    if txs_count == 0:
        xirr_status = "no_cashflows"
    perf = PortfolioPerformance(xirr_status=xirr_status)
    vals = [float(h["inr_market_value"]) for h in history if h.get("inr_market_value") is not None]
    if len(vals) < 3:
        return perf
    rets = _daily_returns(vals)
    if len(rets) < 2:
        return perf
    mdd, cdd = _max_drawdown(vals)
    perf.max_drawdown_pct = mdd
    perf.current_drawdown_pct = cdd
    perf.vol_30d_ann_pct = _ann_vol(rets, 30)
    perf.vol_90d_ann_pct = _ann_vol(rets, 90)
    perf.sharpe_90d = _sharpe(rets, 90)
    perf.twrr_since_first_snapshot = _naive_twrr(rets)
    return perf
