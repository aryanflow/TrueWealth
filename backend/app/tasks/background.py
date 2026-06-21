from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.database import SessionLocal
from app.services.portfolio_service import load_rules
from app.state import state

log = logging.getLogger(__name__)


async def loop_prices() -> None:
    while True:
        try:
            async with SessionLocal() as session:
                pf = await state.refresh_prices(session)
                await state.hub.publish(
                    "prices",
                    {
                        "totals": pf.totals.model_dump(mode="json"),
                        "last_price_sync": pf.meta.last_price_sync.isoformat() if pf.meta.last_price_sync else None,
                    },
                )
        except Exception as e:  # noqa: BLE001
            log.exception("price loop: %s", e)
        await asyncio.sleep(max(await _rules_interval("price"), 5))


async def loop_holdings() -> None:
    while True:
        try:
            async with SessionLocal() as session:
                pf = await state.refresh_holdings(session)
                await state.hub.publish(
                    "holdings",
                    {
                        "holdings_count": len(pf.holdings),
                        "last_holdings_sync": pf.meta.last_holdings_sync.isoformat()
                        if pf.meta.last_holdings_sync
                        else None,
                        "mode": pf.meta.mode,
                    },
                )
        except Exception as e:  # noqa: BLE001
            log.exception("holdings loop: %s", e)
        await asyncio.sleep(max(await _rules_interval("holdings"), 30))


async def loop_alerts() -> None:
    while True:
        try:
            async with SessionLocal() as session:
                if state.cached is None:
                    await state.refresh_prices(session)
            pf = state.cached
            if pf:
                await state.hub.publish(
                    "alerts",
                    {
                        "alerts": pf.alerts.model_dump(mode="json"),
                        "ts": datetime.now(timezone.utc).isoformat(),
                    },
                )
        except Exception as e:  # noqa: BLE001
            log.exception("alerts loop: %s", e)
        await asyncio.sleep(60)


async def loop_heartbeat() -> None:
    while True:
        try:
            pf = state.cached
            await state.hub.publish(
                "status",
                {
                    "heartbeat": True,
                    "mode": state.mode,
                    "mcp_connected": state.mcp_connected,
                    "mcp_degraded": state.mcp_degraded,
                    "last_holdings_sync": state.last_holdings_sync.isoformat() if state.last_holdings_sync else None,
                    "last_price_sync": state.last_price_sync.isoformat() if state.last_price_sync else None,
                    "totals": pf.totals.model_dump(mode="json") if pf else None,
                },
            )
        except Exception as e:  # noqa: BLE001
            log.exception("heartbeat: %s", e)
        await asyncio.sleep(15)


async def _rules_interval(kind: str) -> int:
    async with SessionLocal() as session:
        r = await load_rules(session)
        if kind == "price":
            return int(r.price_refresh_sec)
        if kind == "holdings":
            return int(r.holdings_refresh_sec)
    return 60


def start_background_tasks() -> list[asyncio.Task]:
    return [
        asyncio.create_task(loop_prices(), name="prices"),
        asyncio.create_task(loop_holdings(), name="holdings"),
        asyncio.create_task(loop_alerts(), name="alerts"),
        asyncio.create_task(loop_heartbeat(), name="heartbeat"),
    ]
