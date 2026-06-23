"""MF Fund Lab: MCP fund details with SQLite TTL cache."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.mcp.adapter import IndmoneyAdapter
from app.models import MfFundCache
from app.schemas import AssetType, MfFundSummary, NormalizedHolding

log = logging.getLogger(__name__)
_TTL = timedelta(hours=24)


def _utc(d: datetime) -> datetime:
    if d.tzinfo is None:
        return d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc)


def _cache_key(h: NormalizedHolding) -> str:
    base = (h.isin or h.symbol or h.name or h.id)[:250]
    return base


def _flatten(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        return {}
    if isinstance(payload.get("data"), dict):
        return {**payload, **payload["data"]}
    return payload


def _to_summary(h: NormalizedHolding, d: dict[str, Any]) -> MfFundSummary:
    er_raw = d.get("expense_ratio") or d.get("total_expense_ratio") or d.get("ter")
    try:
        er_f = float(er_raw) if er_raw is not None else None
    except (TypeError, ValueError):
        er_f = None
    bench = d.get("benchmark") or d.get("benchmark_name") or d.get("index_name")
    cat = d.get("category") or d.get("fund_category") or d.get("scheme_category")
    if isinstance(cat, dict):
        cat = cat.get("name") or cat.get("label")
    status = "ok" if d else "empty"
    return MfFundSummary(
        holding_id=h.id,
        name=h.name,
        symbol=h.symbol,
        category=str(cat) if cat else None,
        expense_ratio=er_f,
        benchmark_name=str(bench) if bench else None,
        data_status=status,
    )


async def build_mf_lab_summaries(
    session: AsyncSession,
    adapter: IndmoneyAdapter,
    holdings: list[NormalizedHolding],
    *,
    max_mcp_calls: int | None = None,
) -> list[MfFundSummary]:
    out: list[MfFundSummary] = []
    if not adapter.tool_names:
        return out
    cap = settings.mf_lab_max_mcp_calls if max_mcp_calls is None else max(0, max_mcp_calls)
    mcp_calls_used = 0
    now = datetime.now(timezone.utc)
    for h in holdings:
        if h.asset_type != AssetType.MF:
            continue
        key = _cache_key(h)
        res = await session.execute(select(MfFundCache).where(MfFundCache.cache_key == key))
        row = res.scalar_one_or_none()
        if row and (_utc(row.fetched_at) > now - _TTL):
            try:
                d = _flatten(json.loads(row.payload_json or "{}"))
            except json.JSONDecodeError:
                d = {}
            out.append(_to_summary(h, d))
            continue

        payload: dict[str, Any] = {}
        if "get_mf_funds_details" in adapter.tool_names and mcp_calls_used < cap:
            arg_sets: list[dict[str, Any]] = []
            if h.isin:
                arg_sets.append({"isin": h.isin})
            if h.symbol:
                arg_sets.append({"scheme_code": h.symbol})
            arg_sets.append({"fund_name": h.name[:120]})
            for args in arg_sets:
                if mcp_calls_used >= cap:
                    break
                if not args or all(v in (None, "") for v in args.values()):
                    continue
                try:
                    raw = await adapter.client.tools_call("get_mf_funds_details", args)
                except Exception as e:  # noqa: BLE001
                    mcp_calls_used += 1
                    log.debug("mf details %s: %s", args, e)
                    continue
                mcp_calls_used += 1
                if isinstance(raw, dict):
                    payload = raw
                    break
                if isinstance(raw, str) and "Error" in raw:
                    log.debug("mf details error: %s", raw[:200])
        elif "get_mf_funds_details" in adapter.tool_names and mcp_calls_used >= cap:
            log.debug("mf_lab: MCP cap reached (%s); skipping live details for %s", cap, h.name[:80])

        await session.execute(delete(MfFundCache).where(MfFundCache.cache_key == key))
        session.add(
            MfFundCache(
                cache_key=key,
                payload_json=json.dumps(payload)[:24000],
                fetched_at=now,
            )
        )
        out.append(_to_summary(h, _flatten(payload)))
    await session.commit()
    by_hid: dict[str, MfFundSummary] = {}
    for s in out:
        cur = by_hid.get(s.holding_id)
        if cur is None:
            by_hid[s.holding_id] = s
            continue
        if s.data_status == "ok" and cur.data_status != "ok":
            by_hid[s.holding_id] = s
    return list(by_hid.values())
