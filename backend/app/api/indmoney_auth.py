"""INDmoney OAuth browser flow (DCR + PKCE)."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional
from urllib.parse import urlencode, urlparse, urlunparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import INDMONEY_MCP_PUBLIC_URL, settings
from app.database import SessionLocal, get_session
from app.services import indmoney_oauth_service as imo
from app.services.portfolio_service import load_rules, update_stored_mcp_url
from app.state import state

log = logging.getLogger(__name__)

# OAuth codes are one-time; avoid caching callback URLs. 303 = GET follow-up to success/error page.
_REDIRECT_HEADERS = {"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"}

# Keep strong refs so warmup tasks are not garbage-collected mid-flight.
_oauth_warmup_tasks: set[asyncio.Task] = set()


def _oauth_return_url(base: str, *, ok: bool, detail: str = "") -> str:
    """Build absolute URL with query; ensure path so http://host?query is not used (invalid for some clients)."""
    b = (base or "").strip() or "http://localhost:3000/"
    p = urlparse(b)
    path = p.path if p.path else "/"
    if ok:
        q = urlencode({"indmoney_oauth": "ok"})
    else:
        q = urlencode({"indmoney_oauth": "error", "detail": detail[:400]})
    return urlunparse((p.scheme, p.netloc, path, "", q, ""))


async def _post_oauth_mcp_warmup() -> None:
    """Run after browser redirect — MCP can be slow; do not block the OAuth callback response."""
    log.info("Post-OAuth: MCP discover + holdings refresh (background)")
    try:
        async with SessionLocal() as bg:
            await state.startup_discover(bg)
            await state.refresh_holdings(bg)
            await state.refresh_prices(bg)
    except Exception:  # noqa: BLE001
        log.exception("Post-OAuth MCP warmup failed")


def _schedule_post_oauth_warmup() -> None:
    t = asyncio.create_task(_post_oauth_mcp_warmup())
    _oauth_warmup_tasks.add(t)
    t.add_done_callback(_oauth_warmup_tasks.discard)


router = APIRouter()


@router.get("/indmoney/auth/start")
async def indmoney_auth_start(
    scope: Optional[str] = Query(None, description="Space-separated scopes, e.g. portfolio:read market:read"),
    return_base: Optional[str] = Query(
        None,
        description="Optional Next.js origin to redirect after OAuth (must match FRONTEND_OAUTH_SUCCESS_URL or CORS_ORIGINS).",
    ),
    session: AsyncSession = Depends(get_session),
) -> RedirectResponse:
    try:
        scope_norm = imo.parse_scope_param(scope)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    await imo.prune_stale_pending(session)
    redirect_uri = imo.redirect_uri_for_api()

    async with httpx.AsyncClient() as client:
        meta = await imo.fetch_authorization_server_metadata(client)
        reg_ep = str(meta.get("registration_endpoint") or "")
        auth_ep = str(meta.get("authorization_endpoint") or "")
        if not reg_ep or not auth_ep:
            raise HTTPException(status_code=500, detail="Authorization server metadata missing endpoints")

        row = await imo.ensure_oauth_row(session)

        if row.redirect_uri and row.redirect_uri != redirect_uri:
            row.client_id = None
            row.client_secret = None
            row.redirect_uri = None
            await session.commit()

        if not (row.client_id or "").strip():
            reg = await imo.register_client_dcr(client, reg_ep, redirect_uri)
            await imo.save_oauth_client(session, reg, redirect_uri)
            row = await imo.load_oauth_row(session)

        if row is None or not (row.client_id or "").strip():
            raise HTTPException(status_code=500, detail="DCR did not return client_id")

        verifier, challenge = imo.pkce_pair()
        st = imo.new_oauth_state()
        rb = imo.validate_oauth_return_base(return_base)
        await imo.add_pending(session, st, verifier, scope_norm, rb)

        url = imo.build_authorize_url(
            auth_ep,
            client_id=row.client_id.strip(),
            redirect_uri=redirect_uri,
            scope=scope_norm,
            state=st,
            code_challenge=challenge,
        )
    return RedirectResponse(url, status_code=303, headers=_REDIRECT_HEADERS)


@router.get("/indmoney/auth/callback")
async def indmoney_auth_callback(
    session: AsyncSession = Depends(get_session),
    code: Optional[str] = Query(None),
    oauth_state: Optional[str] = Query(
        None,
        alias="state",
        description="Authorization server state (PKCE). Named oauth_state to avoid shadowing app.state.",
    ),
    error: Optional[str] = Query(None),
    error_description: Optional[str] = Query(None),
) -> RedirectResponse:
    base = settings.frontend_oauth_success_url.strip()
    stored_return: str | None = None

    def redir_err(msg: str) -> RedirectResponse:
        b = (imo.validate_oauth_return_base(stored_return) or "").strip() or base
        return RedirectResponse(
            _oauth_return_url(b, ok=False, detail=msg),
            status_code=303,
            headers=_REDIRECT_HEADERS,
        )

    if error:
        msg = error_description or error
        return redir_err(msg or "authorization_denied")
    if not code or not oauth_state:
        return redir_err("missing_code_or_state")

    pair = await imo.take_pending(session, oauth_state)
    if pair is None:
        return redir_err("invalid_or_expired_state")

    verifier, _scope, stored_return = pair
    redirect_uri = imo.redirect_uri_for_api()

    row = await imo.load_oauth_row(session)
    if row is None or not (row.client_id or "").strip():
        return redir_err("oauth_not_configured")

    try:
        async with httpx.AsyncClient() as client:
            meta = await imo.fetch_authorization_server_metadata(client)
            token_ep = str(meta.get("token_endpoint") or "")
            if not token_ep:
                return redir_err("no_token_endpoint")
            tok = await imo.exchange_authorization_code(
                client,
                token_ep,
                row.client_id.strip(),
                (row.client_secret or "").strip() or None,
                code,
                redirect_uri,
                verifier,
            )
    except httpx.HTTPStatusError as e:
        log.warning("Token exchange failed: %s %s", e.response.status_code, e.response.text[:500])
        detail = f"token_exchange_{e.response.status_code}"
        try:
            j = e.response.json()
            if isinstance(j, dict) and j.get("error"):
                desc = str(j.get("error_description") or "")[:160]
                detail = f"token_exchange_{j.get('error')}" + (f"_{desc}" if desc else "")
        except Exception:
            pass
        return redir_err(detail[:220])
    except Exception as e:  # noqa: BLE001
        log.exception("Token exchange error: %s", e)
        return redir_err("token_exchange_failed")

    await imo.save_oauth_tokens(session, tok)
    rule = await load_rules(session)
    if rule.mcp_endpoint is not None and rule.mcp_endpoint.strip() == "":
        await update_stored_mcp_url(session, (settings.mcp_endpoint or "").strip() or INDMONEY_MCP_PUBLIC_URL)
    await state.apply_oauth_token_from_exchange(session, tok)
    _schedule_post_oauth_warmup()

    success_base = (imo.validate_oauth_return_base(stored_return) or "").strip() or base
    return RedirectResponse(_oauth_return_url(success_base, ok=True), status_code=303, headers=_REDIRECT_HEADERS)


@router.post("/indmoney/auth/refresh")
async def indmoney_auth_refresh(session: AsyncSession = Depends(get_session)) -> dict[str, bool]:
    tok = await imo.get_valid_oauth_access_token(session)
    if not tok:
        raise HTTPException(status_code=400, detail="No refreshable INDmoney OAuth session")
    await state.refresh_mcp_auth_from_rule(session)
    await state.startup_discover(session)
    return {"ok": True}


@router.post("/indmoney/auth/disconnect")
async def indmoney_auth_disconnect(session: AsyncSession = Depends(get_session)) -> dict[str, bool]:
    await imo.revoke_and_clear_oauth(session)
    await state.refresh_mcp_auth_from_rule(session)
    await state.startup_discover(session)
    return {"ok": True}
