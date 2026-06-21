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


def test_normalize_mf_maps_inr_india():
    raw = {
        "holdings": [
            {
                "investment": "Test Flexi Fund",
                "investment_code": "999",
                "asset_type": "MF",
                "assetclass_l2": "Equity",
                "total_units": 10,
                "unit_price": 12.5,
                "market_value": 125,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    h = out[0]
    assert h.asset_type == AssetType.MF
    assert h.currency == Currency.INR
    assert h.country == Country.IN
    assert h.asset_class_l2 == "Equity"


def test_normalize_prefers_ltp_over_close_for_price():
    raw = {
        "holdings": [
            {
                "name": "US Thing",
                "asset_type": "US_STOCK",
                "quantity": 1,
                "ltp": 500.0,
                "close": 65000.0,
                "market_value": 500.0,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    assert out[0].last_price == 500.0


def test_normalize_broker_inr_field():
    raw = {
        "holdings": [
            {
                "name": "VOO",
                "asset_type": "US_STOCK",
                "quantity": 1,
                "market_value": 600.0,
                "market_value_inr": 54000.0,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    assert out[0].inr_market_value == 54000.0


def test_normalize_dedupes_stable_id():
    raw = {
        "holdings": [
            {
                "ind_key": "abc-1",
                "name": "A",
                "asset_type": "MF",
                "quantity": 1,
                "market_value": 100,
            },
            {
                "ind_key": "abc-1",
                "name": "A dup",
                "asset_type": "MF",
                "quantity": 1,
                "market_value": 200,
            },
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    assert out[0].market_value == 200.0


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
