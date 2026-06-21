"""Portfolio view CRUD, asset-group toggles, and holdings filter (single-user)."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import PortfolioView, Rule
from app.schemas import AssetType, NormalizedHolding, PortfolioCoverage
from app.services.fx_book import book_value_inr, sum_inr_market

log = logging.getLogger(__name__)

VIEW_GROUP_KEYS = (
    "mf",
    "in_stocks",
    "us_stocks",
    "etfs",
    "cash",
    "fd",
    "epf",
    "crypto",
    "gold",
    "other",
)

_LABELS: dict[str, str] = {
    "mf": "MFs",
    "in_stocks": "IN stocks",
    "us_stocks": "US stocks",
    "etfs": "ETFs",
    "cash": "Cash",
    "fd": "FD",
    "epf": "EPF",
    "crypto": "Crypto",
    "gold": "Gold",
    "other": "Other",
}

_ASSET_TO_GROUP: dict[AssetType, str] = {
    AssetType.MF: "mf",
    AssetType.IN_STOCK: "in_stocks",
    AssetType.US_STOCK: "us_stocks",
    AssetType.ETF: "etfs",
    AssetType.CASH: "cash",
    AssetType.FD: "fd",
    AssetType.EPF: "epf",
    AssetType.CRYPTO: "crypto",
    AssetType.GOLD: "gold",
    AssetType.OTHER: "other",
    AssetType.PPF: "other",
    AssetType.BOND: "other",
    AssetType.NPS: "other",
    AssetType.SA: "other",
    AssetType.RD: "other",
    AssetType.INSURANCE: "other",
    AssetType.VEHICLE: "other",
    AssetType.RE: "other",
    AssetType.AIF: "other",
    AssetType.PMS: "other",
}


def default_include_map() -> dict[str, bool]:
    return {k: True for k in VIEW_GROUP_KEYS}


def preset_investable_only() -> dict[str, bool]:
    m = default_include_map()
    for k in ("fd", "epf", "gold", "other"):
        m[k] = False
    return m


def preset_locked_long_term() -> dict[str, bool]:
    """Emphasize locked sleeves; trim liquid trading for a long-horizon read."""
    m = {k: False for k in VIEW_GROUP_KEYS}
    for k in ("fd", "epf", "gold", "other"):
        m[k] = True
    return m


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def asset_group_for(h: NormalizedHolding) -> str:
    return _ASSET_TO_GROUP.get(h.asset_type, "other")


def filter_holdings_for_view(holdings: list[NormalizedHolding], include: dict[str, bool]) -> list[NormalizedHolding]:
    out: list[NormalizedHolding] = []
    for h in holdings:
        g = asset_group_for(h)
        if include.get(g, True):
            out.append(h)
    return out


def _group_inr_totals(holdings: list[NormalizedHolding]) -> dict[str, float]:
    acc: dict[str, float] = {k: 0.0 for k in VIEW_GROUP_KEYS}
    for h in holdings:
        g = asset_group_for(h)
        acc[g] = acc.get(g, 0.0) + book_value_inr(h)
    return acc


def build_coverage(
    full_holdings: list[NormalizedHolding],
    *,
    mcp_live: bool,
) -> PortfolioCoverage:
    """When live MCP book has zero MV for a toggle group, treat as absent from feed."""
    totals = _group_inr_totals(full_holdings)
    provided: list[str] = []
    absent: list[str] = []
    if not mcp_live:
        return PortfolioCoverage(provided=[], absent=[])
    for key in VIEW_GROUP_KEYS:
        label = _LABELS[key]
        if totals.get(key, 0.0) > 1e-6:
            provided.append(label)
        else:
            absent.append(label)
    return PortfolioCoverage(provided=provided, absent=absent)


def parse_include_json(raw: str | None) -> dict[str, bool]:
    m = default_include_map()
    if not raw:
        return m
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return m
    if not isinstance(data, dict):
        return m
    for k in VIEW_GROUP_KEYS:
        if k in data and isinstance(data[k], bool):
            m[k] = data[k]
    return m


def dumps_include(m: dict[str, bool]) -> str:
    ordered = {k: bool(m.get(k, True)) for k in VIEW_GROUP_KEYS}
    return json.dumps(ordered)


async def list_views(session: AsyncSession) -> list[PortfolioView]:
    res = await session.execute(select(PortfolioView).order_by(PortfolioView.created_at.asc()))
    return list(res.scalars().all())


async def get_active_view_id(session: AsyncSession) -> str | None:
    rule = (await session.execute(select(Rule).order_by(Rule.id.asc()).limit(1))).scalar_one_or_none()
    if rule is None:
        return None
    return rule.active_portfolio_view_id


async def load_active_view_row(session: AsyncSession) -> tuple[PortfolioView | None, dict[str, bool]]:
    vid = await get_active_view_id(session)
    if not vid:
        return None, default_include_map()
    res = await session.execute(select(PortfolioView).where(PortfolioView.id == vid))
    row = res.scalar_one_or_none()
    if row is None:
        return None, default_include_map()
    return row, parse_include_json(row.include_asset_groups)


async def ensure_default_view(session: AsyncSession) -> PortfolioView:
    rows = await list_views(session)
    if rows:
        return rows[0]
    now = _utc_now()
    vid = str(uuid.uuid4())
    pv = PortfolioView(
        id=vid,
        name="All assets",
        include_asset_groups=dumps_include(default_include_map()),
        created_at=now,
        updated_at=now,
    )
    session.add(pv)
    rule = (await session.execute(select(Rule).order_by(Rule.id.asc()).limit(1))).scalar_one_or_none()
    if rule:
        rule.active_portfolio_view_id = vid
        rule.updated_at = now
    await session.commit()
    await session.refresh(pv)
    return pv


async def create_view(session: AsyncSession, name: str, include: dict[str, bool] | None) -> PortfolioView:
    now = _utc_now()
    inc = include or default_include_map()
    pv = PortfolioView(
        id=str(uuid.uuid4()),
        name=name.strip() or "Custom view",
        include_asset_groups=dumps_include(inc),
        created_at=now,
        updated_at=now,
    )
    session.add(pv)
    await session.commit()
    await session.refresh(pv)
    return pv


async def update_view(
    session: AsyncSession,
    view_id: str,
    *,
    name: str | None = None,
    include: dict[str, bool] | None = None,
) -> PortfolioView | None:
    res = await session.execute(select(PortfolioView).where(PortfolioView.id == view_id))
    row = res.scalar_one_or_none()
    if row is None:
        return None
    if name is not None:
        row.name = name.strip() or row.name
    if include is not None:
        row.include_asset_groups = dumps_include(include)
    row.updated_at = _utc_now()
    await session.commit()
    await session.refresh(row)
    return row


async def set_active_view(session: AsyncSession, view_id: str) -> bool:
    res = await session.execute(select(PortfolioView).where(PortfolioView.id == view_id))
    if res.scalar_one_or_none() is None:
        return False
    rule = (await session.execute(select(Rule).order_by(Rule.id.asc()).limit(1))).scalar_one_or_none()
    if rule is None:
        return False
    rule.active_portfolio_view_id = view_id
    rule.updated_at = _utc_now()
    await session.commit()
    return True


async def reset_view_to_all(session: AsyncSession, view_id: str) -> PortfolioView | None:
    return await update_view(session, view_id, include=default_include_map())
