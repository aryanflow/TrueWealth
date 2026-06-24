"""Resolve USD/INR for the INR book — live fetch with SQLite cache and static fallback."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import FxRate

log = logging.getLogger(__name__)

_CACHE_TTL = timedelta(hours=4)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _fetch_live_usdinr() -> float | None:
    url = (settings.fx_live_url or "").strip()
    if not url:
        return None
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
        # Frankfurter: { rates: { INR: 83.12 } }
        rates = data.get("rates") if isinstance(data, dict) else None
        if isinstance(rates, dict) and rates.get("INR") is not None:
            return float(rates["INR"])
        # Generic { rate: n } or { USDINR: n }
        for key in ("rate", "USDINR", "usd_inr"):
            if isinstance(data, dict) and data.get(key) is not None:
                return float(data[key])
    except Exception as e:  # noqa: BLE001
        log.warning("fx live fetch failed: %s", e)
    return None


async def resolve_usd_inr(session: AsyncSession) -> tuple[float, str, datetime]:
    """Return (rate, fx_mode, as_of)."""
    static = float(settings.usdinr_rate)
    as_of = _now()

    res = await session.execute(
        select(FxRate).where(FxRate.pair == "USDINR").order_by(FxRate.as_of.desc()).limit(1)
    )
    cached = res.scalar_one_or_none()
    if cached and cached.as_of and _now() - cached.as_of.replace(tzinfo=timezone.utc) < _CACHE_TTL:
        return float(cached.rate), cached.source or "cached", cached.as_of

    live = await _fetch_live_usdinr()
    if live is not None and live > 0:
        session.add(FxRate(pair="USDINR", rate=live, as_of=as_of, source="live"))
        await session.flush()
        return live, "live", as_of

    if cached and cached.rate > 0:
        return float(cached.rate), "cached", cached.as_of

    return static, "static", as_of
