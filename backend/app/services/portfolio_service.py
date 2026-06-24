from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import HoldingCurrent, PortfolioSnapshot, RefreshLog, Rule, Transaction
from app.schemas import (
    ActiveViewSummary,
    AssetType,
    ConcentrationAlert,
    Currency,
    DataCompleteness,
    MissingCostBasisItem,
    NormalizedHolding,
    PortfolioAlerts,
    PortfolioAllocation,
    PortfolioMeta,
    PortfolioPerformance,
    PortfolioResponse,
    PortfolioStatus,
    PortfolioTotals,
)
from app.services.action_plan import build_action_plan
from app.services.allocations import build_allocations
from app.services.fx_book import book_value_inr, dedupe_holdings_by_instrument, sum_inr_market
from app.services.performance_metrics import compute_performance_from_history
from app.services.portfolio_views import build_coverage, filter_holdings_for_view
from app.services.shield_metrics import compute_shield_snapshot
from app.services.cost_overrides import apply_cost_overrides, load_cost_overrides

log = logging.getLogger(__name__)

SAMPLE_DIR = Path(__file__).resolve().parent.parent.parent / "sample_data"


def derive_data_confidence(
    *,
    mode: str,
    mcp_degraded: bool,
    stale_data: bool,
    invalid_price_count: int,
    missing_cost_basis_count: int,
) -> str:
    """
    Maps backend signals to the Today tab badge (good, partial, or degraded).

    Degraded: MCP flagged unhealthy, holdings sync is stale versus the rule window, or at least
    one line was excluded from the INR book for invalid native price mapping.

    Partial: the book is not on the live MCP path, or one or more positions are missing average
    cost (non-cash names still need basis for PnL quality).

    Good: live path, MCP healthy, sync fresh enough, no invalid-price exclusions, no missing cost
    on applicable rows.
    """
    if mcp_degraded or stale_data or invalid_price_count > 0:
        return "degraded"
    if mode != "live" or missing_cost_basis_count > 0:
        return "partial"
    return "good"


async def fetch_latest_refresh_error(session: AsyncSession) -> str | None:
    res = await session.execute(
        select(RefreshLog.message)
        .where(RefreshLog.status == "error")
        .order_by(RefreshLog.id.desc())
        .limit(1)
    )
    row = res.scalar_one_or_none()
    if not row:
        return None
    s = (row or "").strip()
    return s[:800] if s else None


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
        if h.fx_as_of:
            d["fx_as_of"] = h.fx_as_of.isoformat()
        out.append(d)
    return out


def _mf_smallcap_proxy_pct(holdings: list[NormalizedHolding]) -> float:
    tot = sum_inr_market(holdings) or 1.0
    s = 0.0
    for h in holdings:
        if h.asset_type != AssetType.MF:
            continue
        b = f"{h.name} {h.asset_class_l2 or ''}".lower()
        if "small" in b:
            s += book_value_inr(h)
    return round(100.0 * s / tot, 4)


def _usd_weight_pct(holdings: list[NormalizedHolding]) -> float:
    tot = sum_inr_market(holdings) or 1.0
    s = sum(book_value_inr(h) for h in holdings if h.currency == Currency.USD)
    return round(100.0 * s / tot, 4)


def _global_equity_offshore_pct(holdings: list[NormalizedHolding]) -> float:
    """US_STOCK sleeve as % of INR book (not the same as USD *currency* leg)."""
    tot = sum_inr_market(holdings) or 1.0
    s = sum(book_value_inr(h) for h in holdings if h.asset_type == AssetType.US_STOCK)
    return round(100.0 * s / tot, 4)


def compute_portfolio(
    holdings: list[NormalizedHolding],
    *,
    rule: Rule,
    meta: PortfolioMeta,
    txs_count: int = 0,
    history: list[dict[str, Any]] | None = None,
    mf_lab: list[Any] | None = None,
    usd_inr: float = 94.61,
    fx_mode: str = "static",
    fx_as_of: datetime | None = None,
) -> PortfolioResponse:
    holdings = dedupe_holdings_by_instrument(list(holdings))
    total_inr = sum_inr_market(holdings)
    day_vals = [float(h.inr_day_change_value) for h in holdings if h.inr_day_change_value is not None]
    day_sum = sum(day_vals) if day_vals else 0.0
    has_any_day = bool(day_vals)
    day_pct = None
    if has_any_day and total_inr - day_sum != 0:
        denom = total_inr - day_sum
        if denom > 0:
            day_pct = round(100.0 * day_sum / denom, 4)

    unreal_vals = [float(h.inr_unrealized_pnl) for h in holdings if h.inr_unrealized_pnl is not None]
    unreal = round(sum(unreal_vals), 4) if unreal_vals else None

    weights: list[NormalizedHolding] = []
    for h in holdings:
        w = (book_value_inr(h) / total_inr) if total_inr > 0 else 0.0
        nh = h.model_copy(update={"weight": round(w * 100.0, 4)})
        weights.append(nh)
    weights.sort(key=lambda x: -x.weight)

    by_type, by_ccy, by_country = build_allocations(weights)
    allocation = PortfolioAllocation(by_asset_type=by_type, by_currency=by_ccy, by_country=by_country)

    thr = float(rule.concentration_threshold_pct)
    conc: list[ConcentrationAlert] = []
    for h in weights:
        if h.weight >= thr:
            mv = book_value_inr(h)
            tgt_mv = thr / 100.0 * total_inr if total_inr > 0 else 0.0
            trim = max(0.0, mv - tgt_mv)
            dilute = max(0.0, (h.weight / 100.0 * total_inr) * ((h.weight / max(thr, 1e-6)) - 1.0))
            conc.append(
                ConcentrationAlert(
                    holding_id=h.id,
                    name=h.name,
                    weight=h.weight,
                    threshold=thr,
                    target_weight_pct=thr,
                    inr_market_value=round(mv, 4),
                    suggested_trim_inr=round(trim, 4),
                    suggested_dilute_inr=round(dilute, 4),
                )
            )

    last_sync = meta.last_holdings_sync
    stale = False
    ls = _aware(last_sync)
    if ls is not None:
        limit = timedelta(seconds=max(rule.holdings_refresh_sec * 2, 60))
        stale = _dt_now() - ls > limit
    elif meta.mode == "live":
        stale = True

    missing_items = [
        MissingCostBasisItem(holding_id=h.id, name=h.name)
        for h in weights
        if h.avg_cost is None and h.asset_type.value != "CASH"
    ]
    missing_n = len(missing_items)
    excluded_n = sum(1 for h in holdings if not h.book_include)
    excluded_names = [h.name[:48] or (h.symbol or "") or h.id for h in holdings if not h.book_include][:6]
    excluded_hint = ""
    if excluded_n:
        excluded_hint = f"{excluded_n} holding(s) excluded due to suspicious price mapping"
        if excluded_names:
            excluded_hint += f": {', '.join(excluded_names)}"
        if excluded_n > len(excluded_names):
            excluded_hint += ", …"
    score = max(0.0, 100.0 - 4.0 * missing_n - (10.0 if any(h.currency == Currency.USD for h in weights) else 0.0))
    dc = DataCompleteness(
        score=round(score, 2),
        fx_mode=fx_mode,
        missing_cost_basis_count=missing_n,
        transactions_available=txs_count > 0,
        ohlc_coverage_pct=0.0,
        excluded_suspicious_price_count=excluded_n,
        invalid_price_count=excluded_n,
        excluded_suspicious_price_hint=excluded_hint,
    )
    confidence = derive_data_confidence(
        mode=meta.mode,
        mcp_degraded=meta.mcp_degraded,
        stale_data=stale,
        invalid_price_count=excluded_n,
        missing_cost_basis_count=missing_n,
    )
    confidence_notes: list[str] = []
    if meta.mode != "live":
        confidence_notes.append("Book is not on the live MCP refresh path.")
    if meta.mcp_degraded:
        confidence_notes.append("MCP is degraded or missing a holdings tool.")
    if stale:
        confidence_notes.append("Holdings sync looks stale versus your refresh window.")
    if missing_n:
        confidence_notes.append(f"{missing_n} holding(s) missing cost basis (PnL quality).")
    if excluded_n:
        confidence_notes.append(f"{excluded_n} line(s) excluded from INR totals (suspicious native price mapping).")
    if str(meta.mode) == "live" and not stale and not missing_n and not excluded_n and not meta.mcp_degraded:
        confidence_notes.append("Live path, fresh sync, no excluded lines in this pass.")

    meta_out = meta.model_copy(
        update={
            "base_currency": "INR",
            "fx_usd_inr": float(usd_inr),
            "fx_as_of": fx_as_of or _dt_now(),
            "data_completeness": dc,
            "confidence": confidence,
            "confidence_notes": confidence_notes,
        }
    )

    hist = history or []
    perf = compute_performance_from_history(hist, txs_count)
    usd_w = _usd_weight_pct(weights)
    offshore_w = _global_equity_offshore_pct(weights)
    mf_sc = _mf_smallcap_proxy_pct(weights)
    actions = build_action_plan(
        weights,
        concentration=conc,
        total_inr=total_inr,
        usd_weight_pct=usd_w,
        mf_smallcap_proxy_pct=mf_sc,
        global_equity_offshore_pct=float(offshore_w),
    )

    alerts = PortfolioAlerts(
        concentration=conc,
        stale_data=stale,
        last_sync=last_sync,
        missing_cost_basis=missing_items,
    )

    totals = PortfolioTotals(
        market_value=round(total_inr, 4),
        day_change_value=round(day_sum, 4) if has_any_day else 0.0,
        day_change_pct=day_pct,
        unrealized_pnl=unreal,
        base_currency="INR",
    )

    top10 = weights[:10]
    base = PortfolioResponse(
        totals=totals,
        allocation=allocation,
        top_holdings=top10,
        alerts=alerts,
        holdings=weights,
        meta=meta_out,
        action_plan=actions,
        performance=perf,
        mf_lab=list(mf_lab or []),
        history=hist[-400:],
        usd_exposure_pct=float(usd_w),
        global_equity_offshore_pct=float(offshore_w),
        allocation_full_book=None,
    )
    return base.model_copy(update={"shield": compute_shield_snapshot(base)})


async def persist_holdings(session: AsyncSession, holdings: list[NormalizedHolding]) -> None:
    holdings = dedupe_holdings_by_instrument(list(holdings))
    await session.execute(delete(HoldingCurrent))
    await session.flush()
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
                inr_market_value=float(h.inr_market_value or 0.0),
                inr_unrealized_pnl=h.inr_unrealized_pnl,
                inr_day_change_value=h.inr_day_change_value,
                fx_usd_inr_used=h.fx_usd_inr_used,
                fx_as_of=h.fx_as_of,
                asset_class_l2=h.asset_class_l2,
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
    overrides = await load_cost_overrides(session)
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
                    "asset_class_l2": getattr(r, "asset_class_l2", None),
                    "inr_market_value": float(getattr(r, "inr_market_value", 0) or 0),
                    "inr_unrealized_pnl": getattr(r, "inr_unrealized_pnl", None),
                    "inr_day_change_value": getattr(r, "inr_day_change_value", None),
                    "fx_usd_inr_used": getattr(r, "fx_usd_inr_used", None),
                    "fx_as_of": getattr(r, "fx_as_of", None),
                    "cost_basis_source": "manual" if r.id in overrides else "mcp",
                }
            )
        )
    return apply_cost_overrides(dedupe_holdings_by_instrument(out), overrides)


async def append_portfolio_snapshot_inr(
    session: AsyncSession,
    *,
    full_inr: float,
    active_inr: float,
    active_view_id: str | None,
    now: datetime | None = None,
) -> None:
    ts = now or _dt_now()
    d = ts.strftime("%Y-%m-%d")
    await session.execute(delete(PortfolioSnapshot).where(PortfolioSnapshot.snapshot_date == d))
    payload = {
        "base_currency": "INR",
        "captured_at": ts.isoformat(),
        "full_inr": float(full_inr),
        "active_inr": float(active_inr),
        "active_view_id": active_view_id,
    }
    session.add(
        PortfolioSnapshot(
            snapshot_date=d,
            market_value=float(full_inr),
            payload_json=json.dumps(payload),
            created_at=ts,
        )
    )
    await session.commit()


def _history_from_snapshots(
    rows: list[Any],
    *,
    active_view_id: str | None,
) -> tuple[list[dict[str, Any]], bool]:
    """Build active-view INR series for charts. Returns (history_points, history_matches_view)."""
    points: list[dict[str, Any]] = []
    any_skipped = False
    for r in rows:
        payload: dict[str, Any] = {}
        if r.payload_json:
            try:
                payload = json.loads(r.payload_json)
            except json.JSONDecodeError:
                payload = {}
        full_v = float(payload.get("full_inr", r.market_value))
        active_v = float(payload.get("active_inr", r.market_value))
        vid = payload.get("active_view_id")
        legacy = "full_inr" not in payload and "active_inr" not in payload
        if legacy or not active_view_id or vid is None or str(vid) == str(active_view_id):
            points.append(
                {
                    "snapshot_date": r.snapshot_date,
                    "inr_market_value": active_v,
                    "inr_full_book": full_v,
                }
            )
        else:
            any_skipped = True
    n_raw = len(rows)
    matches = True
    if any_skipped and len(points) < 2 and n_raw >= 2:
        matches = False
    return points, matches


async def load_portfolio_history(
    session: AsyncSession, limit: int = 500, *, active_view_id: str | None = None
) -> tuple[list[dict[str, Any]], bool]:
    res = await session.execute(select(PortfolioSnapshot).order_by(PortfolioSnapshot.created_at.asc()).limit(limit))
    rows = list(res.scalars().all())
    pts, flag = _history_from_snapshots(rows, active_view_id=active_view_id)
    return pts[-400:], flag


async def latest_snapshot_at(session: AsyncSession) -> datetime | None:
    res = await session.execute(select(func.max(PortfolioSnapshot.created_at)))
    return res.scalar_one_or_none()


async def assemble_portfolio_response(
    session: AsyncSession,
    *,
    all_holdings: list[NormalizedHolding],
    meta_in: PortfolioMeta,
    rule: Rule,
    txs_count: int,
    mf_lab_full: list[Any],
    usd_inr: float,
    fx_mode: str = "static",
    fx_as_of: datetime | None = None,
) -> PortfolioResponse:
    """Full book plus active view filter, merged meta for API and SSE."""
    from app.services.portfolio_views import load_active_view_row, parse_include_json

    view_row, include_map = await load_active_view_row(session)
    active_vid = view_row.id if view_row else None
    hist, hist_match = await load_portfolio_history(session, active_view_id=active_vid)
    last_snap = await latest_snapshot_at(session)

    full = compute_portfolio(
        all_holdings,
        rule=rule,
        meta=meta_in,
        txs_count=txs_count,
        history=hist,
        mf_lab=mf_lab_full,
        usd_inr=usd_inr,
        fx_mode=fx_mode,
        fx_as_of=fx_as_of,
    )
    filtered = filter_holdings_for_view(all_holdings, include_map)
    filt_ids = {h.id for h in filtered}

    def _dedupe_mf_lab(xs: list[Any]) -> list[Any]:
        by: dict[str, Any] = {}
        for x in xs or []:
            hid = getattr(x, "holding_id", None)
            if not hid:
                continue
            cur = by.get(str(hid))
            if cur is None:
                by[str(hid)] = x
                continue
            st = getattr(x, "data_status", "")
            if st == "ok" and getattr(cur, "data_status", "") != "ok":
                by[str(hid)] = x
        return list(by.values())

    mf_filtered = _dedupe_mf_lab([x for x in (mf_lab_full or []) if getattr(x, "holding_id", None) in filt_ids])

    active = compute_portfolio(
        filtered,
        rule=rule,
        meta=meta_in,
        txs_count=txs_count,
        history=hist,
        mf_lab=mf_filtered,
        usd_inr=usd_inr,
        fx_mode=fx_mode,
        fx_as_of=fx_as_of,
    )

    excluded = round(max(0.0, full.totals.market_value - active.totals.market_value), 4)
    cov = build_coverage(all_holdings, mcp_live=meta_in.mode == "live")

    av: ActiveViewSummary | None = None
    if view_row:
        av = ActiveViewSummary(
            id=view_row.id,
            name=view_row.name,
            include_asset_groups=parse_include_json(view_row.include_asset_groups),
        )

    last_err = await fetch_latest_refresh_error(session)
    meta_out = active.meta.model_copy(
        update={
            "full_book_totals": full.totals,
            "excluded_value": excluded,
            "active_view": av,
            "coverage": cov,
            "history_matches_view": hist_match,
            "last_snapshot_at": last_snap,
            "last_error": last_err,
        }
    )
    full_alloc = full.allocation if excluded > 0.01 else None
    return active.model_copy(
        update={"meta": meta_out, "mf_lab": mf_filtered, "allocation_full_book": full_alloc},
    )


def portfolio_response_to_status(pr: PortfolioResponse, *, mcp_endpoint: str | None) -> PortfolioStatus:
    dc = pr.meta.data_completeness
    inv = int(dc.invalid_price_count if dc else 0)
    return PortfolioStatus(
        confidence=pr.meta.confidence,
        mcp_connected=pr.meta.mcp_connected,
        mcp_degraded=pr.meta.mcp_degraded,
        indmoney_oauth_connected=bool(pr.meta.indmoney_oauth_connected),
        mode=pr.meta.mode,
        last_holdings_sync=pr.meta.last_holdings_sync,
        last_price_sync=pr.meta.last_price_sync,
        stale_data=pr.alerts.stale_data,
        missing_cost_basis_count=int(dc.missing_cost_basis_count if dc else 0),
        invalid_price_count=inv,
        fx_mode=str(dc.fx_mode if dc else "static"),
        last_error=pr.meta.last_error,
        mcp_endpoint=mcp_endpoint,
    )
