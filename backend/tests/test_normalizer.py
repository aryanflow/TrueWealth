from datetime import datetime, timezone

from app.schemas import AssetType, Country, Currency, NormalizedHolding
from app.services.allocations import build_allocations
from app.services.normalizer import _broker_reported_inr, normalize_payload


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


def test_normalize_epf_balance_is_corpus_not_quantity():
    """INDmoney-style EPF rows often use `balance` for INR corpus; mapping it to qty breaks cost and MV."""
    raw = {
        "holdings": [
            {
                "name": "Some Employer Pvt Ltd",
                "asset_type": "EPF",
                "balance": 500000.0,
                "invested_amount": 350000.0,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    h = out[0]
    assert h.asset_type == AssetType.EPF
    assert h.quantity == 0.0
    assert h.market_value == 500000.0
    assert h.avg_cost is None


def test_normalize_epf_explicit_type_wins_over_equity_in_name():
    raw = {
        "holdings": [
            {
                "name": "Equity Partners India Ltd",
                "asset_type": "EPF",
                "market_value": 120000.0,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    assert out[0].asset_type == AssetType.EPF


def test_normalize_mf_prefers_total_units_over_quantity():
    """INDmoney-style MF rows: `quantity` may be 1 while `total_units` holds scheme units."""
    raw = {
        "holdings": [
            {
                "name": "Test Flexi Fund",
                "asset_type": "MF",
                "quantity": 1,
                "total_units": 500.25,
                "unit_price": 20.0,
                "market_value": 10005.0,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    assert abs(out[0].quantity - 500.25) < 1e-6


def test_dedupe_keeps_distinct_folios_same_isin():
    """Same ISIN in two folios must not collapse to one line (regression: ISIN-only dedupe key)."""
    from app.services.fx_book import dedupe_holdings_by_instrument

    now = datetime(2026, 1, 1, tzinfo=timezone.utc)

    def row(hid: str, mv: float) -> NormalizedHolding:
        return NormalizedHolding(
            id=hid,
            name="Scheme",
            symbol="SCHEME",
            isin="INF204KA1",
            quantity=100.0,
            last_price=10.0,
            market_value=mv,
            updated_at=now,
            asset_type=AssetType.MF,
            country=Country.IN,
            currency=Currency.INR,
        )

    out = dedupe_holdings_by_instrument([row("folio-a", 1000.0), row("folio-b", 2000.0)])
    assert len(out) == 2


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


def test_broker_reported_inr_accepts_camel_case_keys():
    row = {"currentValueInr": 64_500.0, "marketValue": 5000.0}
    assert _broker_reported_inr(row) == 64_500.0


def test_broker_reported_inr_prefers_inr_market_value():
    row = {"inr_market_value": 100.0, "current_value_inr": 200.0}
    assert _broker_reported_inr(row) == 100.0


def test_normalize_us_stock_inr_quoted_ltp_converted_to_usd_and_inflated_mv_clamped():
    """INDmoney can send INR per-share in ``ltp`` while ``market_value`` is still wrong USD scale."""
    from app.config import settings

    rate = float(settings.usdinr_rate)
    raw = {
        "holdings": [
            {
                "name": "NVIDIA Corporation",
                "asset_type": "US_STOCK",
                "quantity": 0.141,
                "ltp": 19893.35,
                "market_value": 2802.17,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    h = out[0]
    usd_ltp = 19893.35 / rate
    assert abs(h.last_price - usd_ltp) < 0.05
    assert h.market_value < 500.0
    assert abs(h.market_value - (0.141 * usd_ltp)) < 1.0


def test_normalize_us_stock_brk_high_usd_ltp_not_converted_as_inr():
    raw = {
        "holdings": [
            {
                "name": "Berkshire Hathaway Inc A",
                "asset_type": "US_STOCK",
                "quantity": 0.01,
                "ltp": 650_000.0,
                "market_value": 6500.0,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    assert out[0].last_price == 650_000.0


    raw = {
        "holdings": [
            {
                "name": "Vanguard S&P 500 ETF",
                "asset_type": "US_STOCK",
                "quantity": 0.076,
                "ltp": 688.11,
                "market_value": 688.11,
                "current_value": 52.28,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    assert abs(out[0].market_value - 52.28) < 0.02


def test_normalize_us_stock_when_market_value_echoes_ltp_uses_qty_times_ltp():
    """If only per-share echo is present, position USD = qty * ltp (fractional shares)."""
    raw = {
        "holdings": [
            {
                "name": "VOO",
                "asset_type": "US_STOCK",
                "quantity": 0.076,
                "ltp": 688.11,
                "market_value": 688.11,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    assert abs(out[0].market_value - (0.076 * 688.11)) < 0.02


def test_normalize_us_stock_inr_invested_and_total_pnl_for_unrealized():
    """INDmoney US rows: invested_amount and total_pnl are INR; avg/unreal must not mix INR with USD LTP."""
    from app.config import settings

    rate = float(settings.usdinr_rate)
    raw = {
        "holdings": [
            {
                "name": "Amazon.com, Inc. Common Stock",
                "asset_type": "US_STOCK",
                "total_units": 0.0807651,
                "unit_price": 23075.30329487915,
                "invested_amount": 1888.3999633789062,
                "market_value": 1863.6791781412444,
                "total_pnl": -24.720785237661858,
            }
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 1
    h = out[0]
    usd_ltp = 23075.30329487915 / rate
    assert abs(h.last_price - usd_ltp) < 0.05
    assert abs(h.avg_cost - (1888.3999633789062 / rate / 0.0807651)) < 0.05
    assert abs(h.unrealized_pnl - (-24.720785237661858 / rate)) < 0.05
    assert abs(h.inr_unrealized_pnl - (-24.720785237661858)) < 0.02
    assert abs(h.inr_market_value - 1863.6791781412444) < 0.02


def test_normalize_two_epf_same_ind_key_different_names_are_not_deduped():
    raw = {
        "holdings": [
            {
                "name": "Employer A Ltd — EPF",
                "asset_type": "EPF",
                "ind_key": "epf-generic",
                "market_value": 129_858.0,
            },
            {
                "name": "Employer B Ltd — EPF",
                "asset_type": "EPF",
                "ind_key": "epf-generic",
                "market_value": 129_619.0,
            },
        ]
    }
    out = normalize_payload(raw, now=datetime(2026, 1, 1, tzinfo=timezone.utc))
    assert len(out) == 2
    assert abs(sum(h.market_value for h in out) - (129_858.0 + 129_619.0)) < 0.01
