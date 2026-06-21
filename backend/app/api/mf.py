"""MF metadata refresh (MCP, batched)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.models import MfFundCache
from app.services.mf_lab import build_mf_lab_summaries
from app.services.portfolio_service import read_holdings_from_db
from app.state import state

log = logging.getLogger(__name__)

router = APIRouter()


@router.post("/mf/refresh")
async def mf_refresh(session: AsyncSession = Depends(get_session)) -> dict[str, int]:
    """Invalidate MF cache and refetch details from MCP (24h TTL applies to normal reads)."""
    if not state.mcp_connected:
        return {"refreshed": 0, "skipped": 0}
    await session.execute(delete(MfFundCache))
    await session.commit()
    holdings = await read_holdings_from_db(session)
    mf_holdings = [h for h in holdings if h.asset_type.value == "MF"]
    try:
        await build_mf_lab_summaries(session, state.adapter, mf_holdings)
    except Exception as e:  # noqa: BLE001
        log.warning("mf refresh: %s", e)
    await state.rebuild_portfolio_cache(session)
    return {"refreshed": len(mf_holdings), "skipped": 0}
