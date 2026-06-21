from datetime import datetime, timezone

from app.schemas import AssetType, Country, Currency, NormalizedHolding
from app.services.fx_book import apply_inr_book


def test_apply_inr_does_not_double_fx_when_broker_inr_present():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    h = NormalizedHolding(
        id="1",
        name="VOO",
        symbol="VOO",
        quantity=10,
        last_price=500.0,
        market_value=5000.0,
        asset_type=AssetType.ETF,
        country=Country.US,
        currency=Currency.USD,
        inr_market_value=450_000.0,
        updated_at=now,
    )
    out = apply_inr_book([h], usd_inr=90.0, fx_as_of=now)
    assert out[0].inr_market_value == 450_000.0
