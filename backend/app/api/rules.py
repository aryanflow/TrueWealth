from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.services import indmoney_oauth_service as imo
from app.schemas import RulesResponse, RulesUpdate
from app.services.portfolio_service import load_rules, update_rules
from app.state import state

router = APIRouter()


@router.post("/rules", response_model=RulesResponse)
async def post_rules(body: RulesUpdate, session: AsyncSession = Depends(get_session)) -> RulesResponse:
    r = await update_rules(
        session,
        concentration_threshold_pct=body.concentration_threshold_pct,
        price_refresh_sec=body.price_refresh_sec,
        holdings_refresh_sec=body.holdings_refresh_sec,
    )
    if state.cached is not None:
        await state.refresh_prices(session)
    linked = await imo.oauth_is_linked(session)
    return RulesResponse(
        concentration_threshold_pct=r.concentration_threshold_pct,
        price_refresh_sec=r.price_refresh_sec,
        holdings_refresh_sec=r.holdings_refresh_sec,
        mcp_endpoint=r.mcp_endpoint,
        mcp_bearer_saved=bool((r.mcp_bearer_token or "").strip()),
        indmoney_oauth_connected=linked,
    )


@router.get("/rules", response_model=RulesResponse)
async def get_rules(session: AsyncSession = Depends(get_session)) -> RulesResponse:
    r = await load_rules(session)
    linked = await imo.oauth_is_linked(session)
    return RulesResponse(
        concentration_threshold_pct=r.concentration_threshold_pct,
        price_refresh_sec=r.price_refresh_sec,
        holdings_refresh_sec=r.holdings_refresh_sec,
        mcp_endpoint=r.mcp_endpoint,
        mcp_bearer_saved=bool((r.mcp_bearer_token or "").strip()),
        indmoney_oauth_connected=linked,
    )
