from datetime import datetime, timezone

from app.schemas import AssetType, Country, Currency, NormalizedHolding
from app.services.allocations import build_allocations
from app.services.normalizer import normalize_payload


def test_normalize_indian_equity():
    raw = {
        "holdings": [
            {
                "name": "Test Co",
                "symbol": "TEST",
                "quantity": 10,
                "avg_cost": 100,
                "last_price": 110,
                "day_change": 5,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    h = out[0]
    assert h.symbol == "TEST"
    assert h.market_value == 1100.0


def test_allocation_pcts_sum():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    hs = [
        NormalizedHolding(
            id="1",
            name="A",
            symbol="A",
            quantity=1,
            last_price=100,
            market_value=100,
            updated_at=now,
            asset_type=AssetType.IN_STOCK,
            country=Country.IN,
            currency=Currency.INR,
        ),
        NormalizedHolding(
            id="2",
            name="B",
            symbol="B",
            quantity=1,
            last_price=300,
            market_value=300,
            updated_at=now,
            asset_type=AssetType.US_STOCK,
            country=Country.US,
            currency=Currency.USD,
        ),
    ]
    by_type, by_ccy, by_country = build_allocations(hs)
    assert abs(sum(s.pct for s in by_type) - 100.0) < 0.01
    assert abs(sum(s.pct for s in by_ccy) - 100.0) < 0.01
    assert abs(sum(s.pct for s in by_country) - 100.0) < 0.01
    keys = {s.key for s in by_type}
    assert "IN_STOCK" in keys and "US_STOCK" in keys
