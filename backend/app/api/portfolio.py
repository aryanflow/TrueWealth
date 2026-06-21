from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import PortfolioHistoryPoint, PortfolioResponse
from app.services.portfolio_service import load_portfolio_history
from app.services.portfolio_views import get_active_view_id
from app.state import state

router = APIRouter()


@router.get("/portfolio/history", response_model=list[PortfolioHistoryPoint])
async def portfolio_history(session: AsyncSession = Depends(get_session)) -> list[PortfolioHistoryPoint]:
    aid = await get_active_view_id(session)
    rows, _ = await load_portfolio_history(session, active_view_id=aid)
    return [PortfolioHistoryPoint(snapshot_date=r["snapshot_date"], inr_market_value=r["inr_market_value"]) for r in rows]


@router.get("/portfolio", response_model=PortfolioResponse)
async def get_portfolio(
    session: AsyncSession = Depends(get_session),
    refresh: bool = Query(False, description="Force holdings+prices refresh (e.g. after INDmoney OAuth)"),
) -> PortfolioResponse:
    if refresh or state.cached is None:
        await state.refresh_holdings(session)
        await state.refresh_prices(session)
    else:
        await state.rebuild_portfolio_cache(session)
    assert state.cached is not None
    return state.cached
