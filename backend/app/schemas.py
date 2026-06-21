from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator


class AssetType(str, Enum):
    IN_STOCK = "IN_STOCK"
    US_STOCK = "US_STOCK"
    ETF = "ETF"
    MF = "MF"
    CASH = "CASH"
    GOLD = "GOLD"
    EPF = "EPF"
    CRYPTO = "CRYPTO"
    FD = "FD"
    PPF = "PPF"
    BOND = "BOND"
    NPS = "NPS"
    SA = "SA"
    RD = "RD"
    INSURANCE = "INSURANCE"
    VEHICLE = "VEHICLE"
    RE = "RE"
    AIF = "AIF"
    PMS = "PMS"
    OTHER = "OTHER"


class Country(str, Enum):
    IN = "IN"
    US = "US"
    OTHER = "OTHER"


class Currency(str, Enum):
    INR = "INR"
    USD = "USD"
    OTHER = "OTHER"


class NormalizedHolding(BaseModel):
    id: str
    name: str
    symbol: Optional[str] = None
    isin: Optional[str] = None
    asset_type: AssetType = AssetType.OTHER
    country: Country = Country.OTHER
    currency: Currency = Currency.OTHER
    """MCP/broker native market value in `currency` units."""
    quantity: float = 0.0
    avg_cost: Optional[float] = None
    last_price: Optional[float] = None
    market_value: float = 0.0
    unrealized_pnl: Optional[float] = None
    day_change_value: Optional[float] = None
    weight: float = 0.0
    source: str = "indmoney"
    updated_at: datetime
    asset_class_l2: Optional[str] = None
    # INR book (aggregations use these; native MV/PnL/day stay above).
    inr_market_value: float = 0.0
    inr_unrealized_pnl: Optional[float] = None
    inr_day_change_value: Optional[float] = None
    fx_usd_inr_used: Optional[float] = None
    fx_as_of: Optional[datetime] = None
    return_local_pct: Optional[float] = None
    return_fx_inr_pct: Optional[float] = None
    return_total_inr_pct: Optional[float] = None
    book_include: bool = Field(
        default=True,
        description="If false, this line is excluded from INR book totals (e.g. absurd native price).",
    )

    @field_validator("updated_at", "fx_as_of", mode="before")
    @classmethod
    def _ensure_tz(cls, v: Any) -> Any:
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v


class AllocationSlice(BaseModel):
    key: str
    value: float
    pct: float


class ConcentrationAlert(BaseModel):
    holding_id: str
    name: str
    weight: float
    threshold: float
    target_weight_pct: float = 0.0
    inr_market_value: float = 0.0
    suggested_trim_inr: float = 0.0
    suggested_dilute_inr: float = 0.0


class PortfolioTotals(BaseModel):
    """All monetary fields are in `base_currency` (INR)."""
    market_value: float
    day_change_value: float
    day_change_pct: Optional[float] = None
    unrealized_pnl: Optional[float] = None
    base_currency: str = "INR"


class PortfolioAllocation(BaseModel):
    by_asset_type: List[AllocationSlice]
    by_currency: List[AllocationSlice]
    by_country: List[AllocationSlice]


class PortfolioAlerts(BaseModel):
    concentration: List[ConcentrationAlert] = Field(default_factory=list)
    stale_data: bool = False
    last_sync: Optional[datetime] = None
    missing_cost_basis: List[str] = Field(default_factory=list)


class DataCompleteness(BaseModel):
    score: float = 100.0
    fx_mode: str = "static"
    missing_cost_basis_count: int = 0
    transactions_available: bool = False
    ohlc_coverage_pct: float = 0.0
    excluded_suspicious_price_count: int = 0
    excluded_suspicious_price_hint: str = ""


class ActionPlanItem(BaseModel):
    rank: int
    issue: str
    why_it_matters: str
    fix_a: str
    fix_b: str
    constraints: str = ""
    confidence: str = "medium"
    suggested_trim_inr: Optional[float] = None
    suggested_dilute_inr: Optional[float] = None
    holding_id: Optional[str] = None


class PortfolioPerformance(BaseModel):
    xirr_annualized: Optional[float] = None
    xirr_status: str = "unavailable"
    twrr_since_first_snapshot: Optional[float] = None
    max_drawdown_pct: Optional[float] = None
    current_drawdown_pct: Optional[float] = None
    vol_30d_ann_pct: Optional[float] = None
    vol_90d_ann_pct: Optional[float] = None
    sharpe_90d: Optional[float] = None


class ActiveViewSummary(BaseModel):
    id: str
    name: str
    include_asset_groups: Dict[str, bool] = Field(default_factory=dict)


class PortfolioCoverage(BaseModel):
    """Feed coverage hints for the dashboard strip."""

    provided: List[str] = Field(default_factory=list)
    absent: List[str] = Field(default_factory=list)


class MfFundSummary(BaseModel):
    holding_id: str
    name: str
    symbol: Optional[str] = None
    category: Optional[str] = None
    expense_ratio: Optional[float] = None
    benchmark_name: Optional[str] = None
    data_status: str = "pending"


class PortfolioMeta(BaseModel):
    last_holdings_sync: Optional[datetime] = None
    last_price_sync: Optional[datetime] = None
    mode: str = "mock"
    mcp_endpoint: Optional[str] = None
    mcp_connected: bool = False
    mcp_degraded: bool = False
    tool_inventory: List[str] = Field(default_factory=list)
    mcp_bearer_configured: bool = False
    indmoney_oauth_connected: bool = False
    base_currency: str = "INR"
    fx_usd_inr: Optional[float] = None
    fx_as_of: Optional[datetime] = None
    data_completeness: DataCompleteness = Field(default_factory=DataCompleteness)
    active_view: Optional[ActiveViewSummary] = None
    full_book_totals: Optional[PortfolioTotals] = None
    excluded_value: float = 0.0
    coverage: PortfolioCoverage = Field(default_factory=PortfolioCoverage)
    history_matches_view: bool = True
    last_snapshot_at: Optional[datetime] = None


class PortfolioHistoryPoint(BaseModel):
    snapshot_date: str
    inr_market_value: float


class PortfolioResponse(BaseModel):
    totals: PortfolioTotals
    allocation: PortfolioAllocation
    top_holdings: List[NormalizedHolding]
    alerts: PortfolioAlerts
    holdings: List[NormalizedHolding]
    meta: PortfolioMeta
    action_plan: List[ActionPlanItem] = Field(default_factory=list)
    performance: PortfolioPerformance = Field(default_factory=PortfolioPerformance)
    mf_lab: List[MfFundSummary] = Field(default_factory=list)
    history: List[Dict[str, Any]] = Field(default_factory=list)


class RulesUpdate(BaseModel):
    concentration_threshold_pct: Optional[float] = None
    price_refresh_sec: Optional[int] = Field(default=None, ge=5, le=300)
    holdings_refresh_sec: Optional[int] = Field(default=None, ge=30, le=3600)


class RulesResponse(BaseModel):
    concentration_threshold_pct: float
    price_refresh_sec: int
    holdings_refresh_sec: int
    mcp_endpoint: Optional[str] = None
    mcp_bearer_saved: bool = False
    indmoney_oauth_connected: bool = False


class McpConnectResponse(BaseModel):
    ok: bool
    mcp_endpoint: Optional[str] = None
    mcp_connected: bool = False
    mcp_degraded: bool = False
    tool_inventory: List[str] = Field(default_factory=list)
    mode: str = "mock"


class SSEEnvelope(BaseModel):
    channel: str
    payload: Dict[str, Any]
    ts: datetime


class PortfolioViewDTO(BaseModel):
    id: str
    name: str
    include_asset_groups: Dict[str, bool] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class PortfolioViewsListResponse(BaseModel):
    views: List[PortfolioViewDTO]
    active_id: Optional[str] = None


class PortfolioViewCreate(BaseModel):
    name: str = "Custom view"
    include_asset_groups: Optional[Dict[str, bool]] = None


class PortfolioViewUpdate(BaseModel):
    name: Optional[str] = None
    include_asset_groups: Optional[Dict[str, bool]] = None
