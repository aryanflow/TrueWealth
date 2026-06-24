from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class HoldingCurrent(Base):
    __tablename__ = "holdings_current"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    name: Mapped[str] = mapped_column(String(512), default="")
    symbol: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    isin: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    asset_type: Mapped[str] = mapped_column(String(32), default="OTHER")
    country: Mapped[str] = mapped_column(String(8), default="OTHER")
    currency: Mapped[str] = mapped_column(String(8), default="OTHER")
    quantity: Mapped[float] = mapped_column(Float, default=0.0)
    avg_cost: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    market_value: Mapped[float] = mapped_column(Float, default=0.0)
    unrealized_pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    day_change_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # Book in INR (native MV/PnL/day remain in `market_value` / unrealized / day_change in native CCY).
    inr_market_value: Mapped[float] = mapped_column(Float, default=0.0)
    inr_unrealized_pnl: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    inr_day_change_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fx_usd_inr_used: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    fx_as_of: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    asset_class_l2: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    weight: Mapped[float] = mapped_column(Float, default=0.0)
    source: Mapped[str] = mapped_column(String(64), default="indmoney")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(128), primary_key=True)
    holding_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    txn_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    quantity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    price: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    currency: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    traded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    raw_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class FxRate(Base):
    __tablename__ = "fx_rates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pair: Mapped[str] = mapped_column(String(16), default="USDINR")
    rate: Mapped[float] = mapped_column(Float, default=0.0)
    as_of: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    source: Mapped[str] = mapped_column(String(64), default="static")


class MfFundCache(Base):
    __tablename__ = "mf_fund_cache"

    cache_key: Mapped[str] = mapped_column(String(256), primary_key=True)
    payload_json: Mapped[str] = mapped_column(Text, default="{}")
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PortfolioView(Base):
    __tablename__ = "portfolio_views"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(128), default="All assets")
    include_asset_groups: Mapped[str] = mapped_column(Text, default="{}")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PortfolioSnapshot(Base):
    __tablename__ = "portfolio_snapshots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    snapshot_date: Mapped[str] = mapped_column(String(16))
    market_value: Mapped[float] = mapped_column(Float, default=0.0)
    payload_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Rule(Base):
    __tablename__ = "rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    concentration_threshold_pct: Mapped[float] = mapped_column(Float, default=15.0)
    price_refresh_sec: Mapped[int] = mapped_column(Integer, default=10)
    holdings_refresh_sec: Mapped[int] = mapped_column(Integer, default=120)
    mcp_endpoint: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    # Optional Bearer for MCP JSON-RPC (dashboard paste). Local dev only; do not commit DB with secrets.
    mcp_bearer_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active_portfolio_view_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("portfolio_views.id", ondelete="SET NULL"), nullable=True
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RefreshLog(Base):
    __tablename__ = "refresh_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32))
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class NewsItem(Base):
    __tablename__ = "news_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    headline: Mapped[str] = mapped_column(String(1024), default="")
    source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class FundamentalRow(Base):
    __tablename__ = "fundamentals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    symbol: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    metric_key: Mapped[str] = mapped_column(String(128), default="")
    metric_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    as_of: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    pipeline_name: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="stub")
    items_count: Mapped[int] = mapped_column(Integer, default=0)
    ran_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


class IndmoneyOAuth(Base):
    """Single-user INDmoney OAuth row (id=1). DCR client + tokens."""

    __tablename__ = "indmoney_oauth"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    client_secret: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    redirect_uri: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    access_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class IndmoneyOAuthPending(Base):
    __tablename__ = "indmoney_oauth_pending"

    state: Mapped[str] = mapped_column(String(128), primary_key=True)
    code_verifier: Mapped[str] = mapped_column(Text)
    scope: Mapped[str] = mapped_column(String(512))
    return_base: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class HoldingCostOverride(Base):
    __tablename__ = "holding_cost_overrides"

    holding_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    avg_cost: Mapped[float] = mapped_column(Float, default=0.0)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    kind: Mapped[str] = mapped_column(String(64), default="")
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
