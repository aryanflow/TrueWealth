"""Allocation buckets and percentages."""

from __future__ import annotations

from collections import defaultdict

from app.schemas import AllocationSlice, NormalizedHolding
from app.services.fx_book import book_value_inr


def _bucket_totals(holdings: list[NormalizedHolding], key_fn) -> dict[str, float]:
    acc: dict[str, float] = defaultdict(float)
    for h in holdings:
        acc[key_fn(h)] += book_value_inr(h)
    return dict(acc)


def build_allocations(holdings: list[NormalizedHolding]) -> tuple[list[AllocationSlice], list[AllocationSlice], list[AllocationSlice]]:
    total = sum(float(h.market_value or 0) for h in holdings) or 1.0

    def slices(totals: dict[str, float]) -> list[AllocationSlice]:
        items = sorted(totals.items(), key=lambda x: -x[1])
        return [AllocationSlice(key=k, value=v, pct=round(100.0 * v / total, 4)) for k, v in items]

    by_type = _bucket_totals(holdings, lambda h: h.asset_type.value)
    by_ccy = _bucket_totals(holdings, lambda h: h.currency.value)
    by_country = _bucket_totals(holdings, lambda h: h.country.value)
    return slices(by_type), slices(by_ccy), slices(by_country)
