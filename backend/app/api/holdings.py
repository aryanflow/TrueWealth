from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import HoldingCostUpdate, NormalizedHolding, PortfolioResponse
from app.services.cost_overrides import clear_cost_override, set_cost_override
from app.state import state

router = APIRouter()


class HoldingCostResponse(BaseModel):
    ok: bool
    holding: Optional[NormalizedHolding] = None
    portfolio: Optional[PortfolioResponse] = None


@router.put("/holdings/{holding_id}/cost", response_model=HoldingCostResponse)
async def update_holding_cost(
    holding_id: str,
    body: HoldingCostUpdate,
    session: AsyncSession = Depends(get_session),
) -> HoldingCostResponse:
    h = await set_cost_override(session, holding_id, body.avg_cost, body.note)
    if h is None:
        raise HTTPException(status_code=404, detail="Holding not found")
    portfolio = await state.recompute_from_db(session)
    return HoldingCostResponse(ok=True, holding=h, portfolio=portfolio)


@router.delete("/holdings/{holding_id}/cost", response_model=HoldingCostResponse)
async def delete_holding_cost(
    holding_id: str,
    session: AsyncSession = Depends(get_session),
) -> HoldingCostResponse:
    ok = await clear_cost_override(session, holding_id)
    if not ok:
        raise HTTPException(status_code=404, detail="No manual override for this holding")
    portfolio = await state.recompute_from_db(session)
    return HoldingCostResponse(ok=True, portfolio=portfolio)
