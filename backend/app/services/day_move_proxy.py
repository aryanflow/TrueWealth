"""Optional day-change enrichment via MCP OHLC (rate-limited)."""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from app.mcp.adapter import IndmoneyAdapter
from app.schemas import AssetType, Currency, NormalizedHolding

log = logging.getLogger(__name__)


async def enrich_day_change_from_ohlc(
    adapter: IndmoneyAdapter,
    holdings: list[NormalizedHolding],
    *,
    max_calls: int,
) -> list[NormalizedHolding]:
    """If day_change is missing, try `get_indian_stocks_ohlc` for a few IN stocks."""
    if max_calls <= 0 or "get_indian_stocks_ohlc" not in adapter.tool_names:
        return holdings

    result: list[NormalizedHolding] = []
    calls = 0
    for h in holdings:
        if calls >= max_calls:
            result.append(h)
            continue
        if h.day_change_value is not None:
            result.append(h)
            continue
        if h.asset_type != AssetType.IN_STOCK or h.currency != Currency.INR:
            result.append(h)
            continue
        sym = (h.symbol or h.isin or "").strip()
        if not sym:
            result.append(h)
            continue

        raw: Any = None
        for args in (
            {"ticker": sym},
            {"symbol": sym},
            {"scrip_code": sym},
            {"ind_key": sym},
        ):
            try:
                raw = await adapter.client.tools_call("get_indian_stocks_ohlc", args)
                calls += 1
                await asyncio.sleep(2.1)
                break
            except Exception as e:  # noqa: BLE001
                log.debug("ohlc skip %s %s: %s", sym, args, e)

        if not isinstance(raw, dict):
            result.append(h)
            continue
        last = _pick_float(raw, "close", "last_price", "ltp", "last")
        prev = _pick_float(raw, "prev_close", "previous_close", "prevClose", "pc")
        if last is None or prev is None:
            result.append(h)
            continue
        day = (last - prev) * float(h.quantity)
        result.append(h.model_copy(update={"day_change_value": round(day, 4)}))
    return result


def _pick_float(d: dict[str, Any], *keys: str) -> float | None:
    for k in keys:
        v = d.get(k)
        if v is None:
            nested = d.get("ohlc") if isinstance(d.get("ohlc"), dict) else None
            if nested and k in nested:
                v = nested.get(k)
        if v is not None:
            try:
                return float(v)
            except (TypeError, ValueError):
                continue
    return None
