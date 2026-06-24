"""Manual per-holding cost basis overrides (device-local book corrections)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import HoldingCostOverride, HoldingCurrent
from app.schemas import NormalizedHolding
from app.services.audit import append_audit


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def load_cost_overrides(session: AsyncSession) -> dict[str, float]:
    res = await session.execute(select(HoldingCostOverride))
    return {r.holding_id: float(r.avg_cost) for r in res.scalars().all()}


def apply_cost_overrides(holdings: list[NormalizedHolding], overrides: dict[str, float]) -> list[NormalizedHolding]:
    if not overrides:
        return holdings
    out: list[NormalizedHolding] = []
    for h in holdings:
        oc = overrides.get(h.id)
        if oc is None:
            out.append(h)
            continue
        upd: dict[str, Any] = {"avg_cost": oc, "cost_basis_source": "manual"}
        if h.last_price is not None and h.quantity:
            pnl = (float(h.last_price) - oc) * float(h.quantity)
            upd["unrealized_pnl"] = round(pnl, 4)
        out.append(h.model_copy(update=upd))
    return out


async def set_cost_override(
    session: AsyncSession,
    holding_id: str,
    avg_cost: float,
    note: str | None = None,
) -> NormalizedHolding | None:
    res = await session.execute(select(HoldingCurrent).where(HoldingCurrent.id == holding_id))
    row = res.scalar_one_or_none()
    if row is None:
        return None

    await session.execute(delete(HoldingCostOverride).where(HoldingCostOverride.holding_id == holding_id))
    session.add(
        HoldingCostOverride(
            holding_id=holding_id,
            avg_cost=avg_cost,
            note=(note or "").strip() or None,
            updated_at=_now(),
        )
    )
    row.avg_cost = avg_cost
    if row.last_price is not None and row.quantity:
        row.unrealized_pnl = round((float(row.last_price) - avg_cost) * float(row.quantity), 4)
    await append_audit(
        session,
        "cost_override",
        f"holding={holding_id} avg_cost={avg_cost}",
    )
    await session.commit()
    return NormalizedHolding.model_validate(
        {
            "id": row.id,
            "name": row.name,
            "symbol": row.symbol,
            "isin": row.isin,
            "asset_type": row.asset_type,
            "country": row.country,
            "currency": row.currency,
            "quantity": row.quantity,
            "avg_cost": row.avg_cost,
            "last_price": row.last_price,
            "market_value": row.market_value,
            "unrealized_pnl": row.unrealized_pnl,
            "day_change_value": row.day_change_value,
            "weight": row.weight,
            "source": row.source,
            "updated_at": row.updated_at,
            "asset_class_l2": row.asset_class_l2,
            "inr_market_value": float(row.inr_market_value or 0),
            "inr_unrealized_pnl": row.inr_unrealized_pnl,
            "inr_day_change_value": row.inr_day_change_value,
            "fx_usd_inr_used": row.fx_usd_inr_used,
            "fx_as_of": row.fx_as_of,
            "cost_basis_source": "manual",
        }
    )


async def clear_cost_override(session: AsyncSession, holding_id: str) -> bool:
    res = await session.execute(select(HoldingCostOverride).where(HoldingCostOverride.holding_id == holding_id))
    if res.scalar_one_or_none() is None:
        return False
    await session.execute(delete(HoldingCostOverride).where(HoldingCostOverride.holding_id == holding_id))
    await append_audit(session, "cost_override_clear", f"holding={holding_id}")
    await session.commit()
    return True
