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
    quantity: float = 0.0
    avg_cost: Optional[float] = None
    last_price: Optional[float] = None
    market_value: float = 0.0
    unrealized_pnl: Optional[float] = None
    day_change_value: Optional[float] = None
    weight: float = 0.0
    source: str = "indmoney"
    updated_at: datetime

    @field_validator("updated_at", mode="before")
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


class PortfolioTotals(BaseModel):
    market_value: float
    day_change_value: float
    day_change_pct: Optional[float] = None
    unrealized_pnl: Optional[float] = None


class PortfolioAllocation(BaseModel):
    by_asset_type: List[AllocationSlice]
    by_currency: List[AllocationSlice]
    by_country: List[AllocationSlice]


class PortfolioAlerts(BaseModel):
    concentration: List[ConcentrationAlert] = Field(default_factory=list)
    stale_data: bool = False
    last_sync: Optional[datetime] = None
    missing_cost_basis: List[str] = Field(default_factory=list)


class PortfolioMeta(BaseModel):
    last_holdings_sync: Optional[datetime] = None
    last_price_sync: Optional[datetime] = None
    mode: str = "mock"
    mcp_endpoint: Optional[str] = None
    mcp_connected: bool = False
    mcp_degraded: bool = False
    tool_inventory: List[str] = Field(default_factory=list)
    # True if INDMONEY_MCP_BEARER_TOKEN is set in backend env (value never exposed to clients).
    mcp_bearer_configured: bool = False
    # True if OAuth tokens (or valid access) exist in DB for INDmoney MCP.
    indmoney_oauth_connected: bool = False


class PortfolioResponse(BaseModel):
    totals: PortfolioTotals
    allocation: PortfolioAllocation
    top_holdings: List[NormalizedHolding]
    alerts: PortfolioAlerts
    holdings: List[NormalizedHolding]
    meta: PortfolioMeta


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
