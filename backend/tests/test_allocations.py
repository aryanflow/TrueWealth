from datetime import datetime, timezone

from app.models import Rule
from app.schemas import AssetType, Country, Currency, NormalizedHolding, PortfolioMeta
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
    top = pr.top_holdings[0]
    assert top.weight == 90.0
    assert len(pr.alerts.concentration) == 1
    assert pr.alerts.concentration[0].holding_id == "1"
