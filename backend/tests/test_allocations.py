from datetime import datetime, timezone

from app.models import Rule
from app.schemas import AssetType, Country, Currency, NormalizedHolding, PortfolioMeta
from app.services.allocations import build_allocations
from app.services.portfolio_service import compute_portfolio


def test_compute_portfolio_weights_and_concentration():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    hs = [
        NormalizedHolding(
            id="1",
            name="Big",
            symbol="BIG",
            quantity=1,
            last_price=900,
            market_value=900,
            updated_at=now,
            asset_type=AssetType.IN_STOCK,
            country=Country.IN,
            currency=Currency.INR,
        ),
        NormalizedHolding(
            id="2",
            name="Small",
            symbol="SML",
            quantity=1,
            last_price=100,
            market_value=100,
            updated_at=now,
            asset_type=AssetType.IN_STOCK,
            country=Country.IN,
            currency=Currency.INR,
        ),
    ]
    rule = Rule(
        id=1,
        concentration_threshold_pct=50.0,
        price_refresh_sec=10,
        holdings_refresh_sec=120,
        updated_at=now,
    )
    meta = PortfolioMeta(
        last_holdings_sync=now,
        last_price_sync=now,
        mode="mock",
        mcp_endpoint=None,
        mcp_connected=False,
        mcp_degraded=False,
        tool_inventory=[],
        mcp_bearer_configured=False,
    )
    pr = compute_portfolio(hs, rule=rule, meta=meta)
    assert pr.totals.market_value == 1000.0
    assert pr.global_equity_offshore_pct == 0.0
    top = pr.top_holdings[0]
    assert top.weight == 90.0
    assert len(pr.alerts.concentration) == 1
    assert pr.alerts.concentration[0].holding_id == "1"


def test_compute_portfolio_global_equity_offshore_and_usd_leg():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    hs = [
        NormalizedHolding(
            id="1",
            name="US",
            symbol="AMZN",
            quantity=1,
            last_price=100,
            market_value=100,
            updated_at=now,
            asset_type=AssetType.US_STOCK,
            country=Country.US,
            currency=Currency.USD,
            inr_market_value=8300.0,
        ),
        NormalizedHolding(
            id="2",
            name="IN",
            symbol="RELIANCE",
            quantity=1,
            last_price=1000,
            market_value=1700,
            updated_at=now,
            asset_type=AssetType.IN_STOCK,
            country=Country.IN,
            currency=Currency.INR,
            inr_market_value=1700.0,
        ),
    ]
    rule = Rule(
        id=1,
        concentration_threshold_pct=99.0,
        price_refresh_sec=10,
        holdings_refresh_sec=120,
        updated_at=now,
    )
    meta = PortfolioMeta(
        last_holdings_sync=now,
        last_price_sync=now,
        mode="mock",
        mcp_endpoint=None,
        mcp_connected=False,
        mcp_degraded=False,
        tool_inventory=[],
        mcp_bearer_configured=False,
    )
    pr = compute_portfolio(hs, rule=rule, meta=meta)
    assert abs(pr.global_equity_offshore_pct - 83.0) < 0.2
    assert abs(pr.usd_exposure_pct - 83.0) < 0.2


def test_build_allocations_pct_sums_to_book_total():
    """Bucket % must use the same INR-book denominator as line weights (not raw native MV)."""
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    hs = [
        NormalizedHolding(
            id="1",
            name="US",
            symbol="AMZN",
            quantity=1,
            last_price=100,
            market_value=100,
            updated_at=now,
            asset_type=AssetType.US_STOCK,
            country=Country.US,
            currency=Currency.USD,
            inr_market_value=8300.0,
        ),
        NormalizedHolding(
            id="2",
            name="IN",
            symbol="RELIANCE",
            quantity=1,
            last_price=1000,
            market_value=1700,
            updated_at=now,
            asset_type=AssetType.IN_STOCK,
            country=Country.IN,
            currency=Currency.INR,
            inr_market_value=0.0,
        ),
    ]
    by_t, by_c, _ = build_allocations(hs)
    assert abs(sum(s.pct for s in by_t) - 100.0) < 0.05
    assert abs(sum(s.pct for s in by_c) - 100.0) < 0.05
