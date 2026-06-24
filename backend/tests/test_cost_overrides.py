"""Tests for manual cost basis overrides."""

from __future__ import annotations

from datetime import datetime, timezone

from app.schemas import AssetType, Country, Currency, NormalizedHolding
from app.services.cost_overrides import apply_cost_overrides


def _h(**kw) -> NormalizedHolding:
    base = dict(
        id="h1",
        name="Test",
        symbol="T",
        isin=None,
        asset_type=AssetType.IN_STOCK,
        country=Country.IN,
        currency=Currency.INR,
        quantity=10.0,
        avg_cost=None,
        last_price=120.0,
        market_value=1200.0,
        unrealized_pnl=None,
        day_change_value=None,
        weight=0.0,
        source="test",
        updated_at=datetime.now(timezone.utc),
        inr_market_value=1200.0,
    )
    base.update(kw)
    return NormalizedHolding.model_validate(base)


def test_apply_cost_override_sets_pnl() -> None:
    h = _h()
    out = apply_cost_overrides([h], {"h1": 100.0})
    assert out[0].avg_cost == 100.0
    assert out[0].cost_basis_source == "manual"
    assert out[0].unrealized_pnl == 200.0
