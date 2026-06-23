from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import PortfolioHistoryPoint, PortfolioResponse, PortfolioStatus
from app.services.portfolio_service import load_portfolio_history, portfolio_response_to_status
from app.services.portfolio_views import get_active_view_id
from app.state import state

router = APIRouter()


@router.get("/status", response_model=PortfolioStatus)
async def portfolio_status(session: AsyncSession = Depends(get_session)) -> PortfolioStatus:
    if state.cached is not None:
        return portfolio_response_to_status(state.cached, mcp_endpoint=state.effective_mcp_url)
    await state.rebuild_portfolio_cache(session)
    assert state.cached is not None
    return portfolio_response_to_status(state.cached, mcp_endpoint=state.effective_mcp_url)


@router.post("/refresh", response_model=PortfolioResponse)
async def portfolio_refresh(session: AsyncSession = Depends(get_session)) -> PortfolioResponse:
    await state.refresh_holdings(session)
    await state.refresh_prices(session)
    assert state.cached is not None
    return state.cached


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
    # Fast path: serve in-memory cache without waiting on background MCP refresh locks.
    if not refresh and state.cached is not None:
        return state.cached
    # Cold cache but DB may already have holdings — rebuild from SQLite (no MCP, no lock wait).
    if not refresh:
        await state.rebuild_portfolio_cache(session)
        assert state.cached is not None
        return state.cached
    if state.refresh_lock_busy():
        # Another MCP sync is running — serve DB snapshot now; in-flight job updates cache via SSE.
        await state.rebuild_portfolio_cache(session)
        assert state.cached is not None
        return state.cached
    await state.refresh_holdings(session)
    await state.refresh_prices(session)
    assert state.cached is not None
    return state.cached
