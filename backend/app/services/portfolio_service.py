from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import HoldingCurrent, RefreshLog, Rule, Transaction
from app.schemas import (
    ConcentrationAlert,
    NormalizedHolding,
    PortfolioAlerts,
    PortfolioAllocation,
    PortfolioMeta,
    PortfolioResponse,
    PortfolioTotals,
)
from app.services.allocations import build_allocations
from app.services.normalizer import extract_transactions
from app.services.price_engine import apply_prices_to_holdings

log = logging.getLogger(__name__)

SAMPLE_DIR = Path(__file__).resolve().parent.parent.parent / "sample_data"


def _dt_now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def load_rules(session: AsyncSession) -> Rule:
    res = await session.execute(select(Rule).order_by(Rule.id.asc()).limit(1))
    row = res.scalar_one_or_none()
    if row is None:
        row = Rule(
            concentration_threshold_pct=settings.concentration_threshold_pct,
            price_refresh_sec=settings.price_refresh_sec,
            holdings_refresh_sec=settings.holdings_refresh_sec,
            updated_at=_dt_now(),
        )
        session.add(row)
        await session.commit()
        await session.refresh(row)
    return row


async def update_rules(
    session: AsyncSession,
    *,
    concentration_threshold_pct: float | None,
    price_refresh_sec: int | None,
    holdings_refresh_sec: int | None,
) -> Rule:
    rule = await load_rules(session)
    if concentration_threshold_pct is not None:
        rule.concentration_threshold_pct = float(concentration_threshold_pct)
    if price_refresh_sec is not None:
        rule.price_refresh_sec = int(price_refresh_sec)
    if holdings_refresh_sec is not None:
        rule.holdings_refresh_sec = int(holdings_refresh_sec)
    rule.updated_at = _dt_now()
    await session.commit()
    await session.refresh(rule)
    return rule


async def update_stored_mcp_url(session: AsyncSession, url: str) -> Rule:
    rule = await load_rules(session)
    rule.mcp_endpoint = url.strip()
    rule.updated_at = _dt_now()
    await session.commit()
    await session.refresh(rule)
    return rule


async def clear_stored_mcp_url(session: AsyncSession) -> Rule:
    rule = await load_rules(session)
    rule.mcp_endpoint = ""
    rule.mcp_bearer_token = None
    rule.updated_at = _dt_now()
    await session.commit()
    await session.refresh(rule)
    return rule


async def update_mcp_bearer_token(session: AsyncSession, bearer_token: Optional[str]) -> Rule:
    """Set or clear MCP bearer token on rules row (None or empty clears)."""
    rule = await load_rules(session)
    if bearer_token is None or bearer_token.strip() == "":
        rule.mcp_bearer_token = None
    else:
        rule.mcp_bearer_token = bearer_token.strip()
    rule.updated_at = _dt_now()
    await session.commit()
    await session.refresh(rule)
    return rule


async def log_refresh(session: AsyncSession, kind: str, status: str, message: str | None = None) -> None:
    session.add(RefreshLog(kind=kind, status=status, message=message, created_at=_dt_now()))
    await session.commit()


def _load_sample_holdings() -> Any:
    path = SAMPLE_DIR / "holdings.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def _load_sample_tx() -> Any:
    path = SAMPLE_DIR / "transactions.json"
    if not path.exists():
        return []
    return json.loads(path.read_text(encoding="utf-8"))


def holdings_to_dicts(holdings: list[NormalizedHolding]) -> list[dict[str, Any]]:
    out = []
    for h in holdings:
        d = h.model_dump(mode="json")
        d["asset_type"] = h.asset_type.value
        d["country"] = h.country.value
        d["currency"] = h.currency.value
        d["updated_at"] = h.updated_at.isoformat()
        out.append(d)
    return out


def compute_portfolio(
    holdings: list[NormalizedHolding],
    *,
    rule: Rule,
    meta: PortfolioMeta,
) -> PortfolioResponse:
    total_mv = sum(float(h.market_value or 0) for h in holdings)
    day_sum = sum(float(h.day_change_value or 0) for h in holdings if h.day_change_value is not None)
    has_any_day = any(h.day_change_value is not None for h in holdings)
    day_pct = None
    if has_any_day and total_mv - day_sum != 0:
        denom = total_mv - day_sum
        if denom > 0:
            day_pct = round(100.0 * day_sum / denom, 4)

    unreal = None
    unreal_vals = [float(h.unrealized_pnl) for h in holdings if h.unrealized_pnl is not None]
    if unreal_vals:
        unreal = round(sum(unreal_vals), 4)

    weights: list[NormalizedHolding] = []
    for h in holdings:
        w = (float(h.market_value) / total_mv) if total_mv > 0 else 0.0
        nh = h.model_copy(update={"weight": round(w * 100.0, 4)})
        weights.append(nh)
    weights.sort(key=lambda x: -x.weight)

    by_type, by_ccy, by_country = build_allocations(weights)
    allocation = PortfolioAllocation(by_asset_type=by_type, by_currency=by_ccy, by_country=by_country)

    thr = float(rule.concentration_threshold_pct)
    conc: list[ConcentrationAlert] = []
    for h in weights:
        if h.weight >= thr:
            conc.append(
                ConcentrationAlert(holding_id=h.id, name=h.name, weight=h.weight, threshold=thr)
            )

    last_sync = meta.last_holdings_sync
    stale = False
    ls = _aware(last_sync)
    if ls is not None:
        limit = timedelta(seconds=max(rule.holdings_refresh_sec * 2, 60))
        stale = _dt_now() - ls > limit
    elif meta.mode == "live":
        stale = True

    missing = [h.name for h in weights if h.avg_cost is None and h.asset_type.value != "CASH"]

    alerts = PortfolioAlerts(
        concentration=conc,
        stale_data=stale,
        last_sync=last_sync,
        missing_cost_basis=missing,
    )

    totals = PortfolioTotals(
        market_value=round(total_mv, 4),
        day_change_value=round(day_sum, 4) if has_any_day else 0.0,
        day_change_pct=day_pct,
        unrealized_pnl=unreal,
    )

    top10 = weights[:10]
    return PortfolioResponse(
        totals=totals,
        allocation=allocation,
        top_holdings=top10,
        alerts=alerts,
        holdings=weights,
        meta=meta,
    )


async def persist_holdings(session: AsyncSession, holdings: list[NormalizedHolding]) -> None:
    await session.execute(delete(HoldingCurrent))
    await session.flush()
    # Last row wins if upstream ever emits duplicate ids for distinct positions.
    by_id: dict[str, NormalizedHolding] = {}
    for h in holdings:
        by_id[h.id] = h
    for h in by_id.values():
        session.add(
            HoldingCurrent(
                id=h.id,
                name=h.name,
                symbol=h.symbol,
                isin=h.isin,
                asset_type=h.asset_type.value,
                country=h.country.value,
                currency=h.currency.value,
                quantity=h.quantity,
                avg_cost=h.avg_cost,
                last_price=h.last_price,
                market_value=h.market_value,
                unrealized_pnl=h.unrealized_pnl,
                day_change_value=h.day_change_value,
                weight=h.weight,
                source=h.source,
                updated_at=h.updated_at,
            )
        )
    await session.commit()


async def persist_transactions_stub(session: AsyncSession, txs: list[dict[str, Any]]) -> None:
    await session.execute(delete(Transaction))
    for i, t in enumerate(txs):
        tid = str(t.get("id") or f"tx-{i}")
        session.add(
            Transaction(
                id=tid[:128],
                holding_id=str(t.get("holding_id"))[:128] if t.get("holding_id") else None,
                txn_type=str(t.get("type") or t.get("txn_type") or "")[:32] or None,
                quantity=float(t["quantity"]) if t.get("quantity") is not None else None,
                price=float(t["price"]) if t.get("price") is not None else None,
                amount=float(t["amount"]) if t.get("amount") is not None else None,
                currency=str(t.get("currency") or "")[:8] or None,
                traded_at=None,
                raw_json=json.dumps(t)[:8000],
                created_at=_dt_now(),
            )
        )
    await session.commit()


async def read_holdings_from_db(session: AsyncSession) -> list[NormalizedHolding]:
    res = await session.execute(select(HoldingCurrent))
    rows = res.scalars().all()
    out: list[NormalizedHolding] = []
    for r in rows:
        out.append(
            NormalizedHolding.model_validate(
                {
                    "id": r.id,
                    "name": r.name,
                    "symbol": r.symbol,
                    "isin": r.isin,
                    "asset_type": r.asset_type,
                    "country": r.country,
                    "currency": r.currency,
                    "quantity": r.quantity,
                    "avg_cost": r.avg_cost,
                    "last_price": r.last_price,
                    "market_value": r.market_value,
                    "unrealized_pnl": r.unrealized_pnl,
                    "day_change_value": r.day_change_value,
                    "weight": r.weight,
                    "source": r.source,
                    "updated_at": r.updated_at,
                }
            )
        )
    return out
