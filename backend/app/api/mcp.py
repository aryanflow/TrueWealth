from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_session
from app.schemas import McpConnectResponse
from app.services.indmoney_oauth_service import revoke_and_clear_oauth
from app.services.portfolio_service import clear_stored_mcp_url, update_mcp_bearer_token, update_stored_mcp_url
from app.state import state

router = APIRouter()


def _mcp_ok_response() -> McpConnectResponse:
    return McpConnectResponse(
        ok=True,
        mcp_endpoint=state.effective_mcp_url,
        mcp_connected=state.mcp_connected,
        mcp_degraded=state.mcp_degraded,
        tool_inventory=list(state.tool_inventory),
        mcp_tools=list(state.mcp_tools),
        mcp_holdings_tool=state.adapter._holdings_tool,
        mcp_transactions_tool=state.adapter._tx_tool,
        mode=state.mode,
    )


class McpConnectBody(BaseModel):
    mcp_endpoint: str = Field(..., min_length=1, max_length=2048)


class McpBearerBody(BaseModel):
    """Empty string clears the saved token."""

    bearer_token: str = Field("", max_length=8192)


def _validate_mcp_url(raw: str) -> str:
    url = raw.strip()
    p = urlparse(url)
    if p.scheme not in ("http", "https") or not p.netloc:
        raise HTTPException(
            status_code=400,
            detail="INDmoney MCP URL must start with http:// or https:// and include a host.",
        )
    return url


@router.post("/mcp/connect", response_model=McpConnectResponse)
async def mcp_connect(body: McpConnectBody, session: AsyncSession = Depends(get_session)) -> McpConnectResponse:
    url = _validate_mcp_url(body.mcp_endpoint)
    await update_stored_mcp_url(session, url)
    await state.apply_mcp_endpoint_from_db(session)
    await state.startup_discover(session)
    await state.refresh_holdings(session)
    await state.refresh_prices(session)
    return _mcp_ok_response()


@router.post("/mcp/bearer", response_model=McpConnectResponse)
async def mcp_save_bearer(body: McpBearerBody, session: AsyncSession = Depends(get_session)) -> McpConnectResponse:
    tok = body.bearer_token.strip()
    await update_mcp_bearer_token(session, tok if tok else None)
    await state.refresh_mcp_auth_from_rule(session)
    await state.startup_discover(session)
    await state.refresh_holdings(session)
    await state.refresh_prices(session)
    return _mcp_ok_response()


@router.post("/mcp/disconnect", response_model=McpConnectResponse)
async def mcp_disconnect(session: AsyncSession = Depends(get_session)) -> McpConnectResponse:
    await revoke_and_clear_oauth(session)
    await clear_stored_mcp_url(session)
    await state.apply_mcp_endpoint_from_db(session)
    await state.startup_discover(session)
    await state.clear_portfolio_book(session)
    return _mcp_ok_response()
