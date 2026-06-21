from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import PortfolioResponse
from app.state import state

router = APIRouter()


@router.get("/portfolio", response_model=PortfolioResponse)
async def get_portfolio(
    session: AsyncSession = Depends(get_session),
    refresh: bool = Query(False, description="Force holdings+prices refresh (e.g. after INDmoney OAuth)"),
) -> PortfolioResponse:
    if refresh or state.cached is None:
        await state.refresh_holdings(session)
        await state.refresh_prices(session)
    assert state.cached is not None
    return state.cached
