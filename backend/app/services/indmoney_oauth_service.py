"""INDmoney MCP OAuth 2.1: metadata, DCR, PKCE, token exchange, refresh, revoke."""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode, urlparse, urlunparse

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import IndmoneyOAuth, IndmoneyOAuthPending

log = logging.getLogger(__name__)

MAX_RETURN_BASE_LEN = 512


def _oauth_return_allow_origins() -> set[str]:
    """Origins allowed for OAuth success redirect (start ?return_base=…); avoids open redirects."""
    out: set[str] = set()
    fe = urlparse((settings.frontend_oauth_success_url or "").strip() or "http://localhost:3000/")
    if fe.scheme in ("http", "https") and fe.netloc:
        out.add(f"{fe.scheme}://{fe.netloc}".lower())
    for co in settings.cors_origins_list:
        c = urlparse(co.strip())
        if c.scheme in ("http", "https") and c.netloc:
            out.add(f"{c.scheme}://{c.netloc}".lower())
    return out


def validate_oauth_return_base(raw: str | None) -> str | None:
    """If raw matches an allowed app origin, return a normalized base URL for post-OAuth redirects."""
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    if len(s) > MAX_RETURN_BASE_LEN:
        return None
    p = urlparse(s)
    if p.scheme not in ("http", "https") or not p.netloc or "@" in p.netloc:
        return None
    origin = f"{p.scheme}://{p.netloc}".lower()
    if origin not in _oauth_return_allow_origins():
        log.warning("Rejected return_base (origin not allowlisted): %s", origin)
        return None
    path = p.path if p.path else "/"
    return urlunparse((p.scheme, p.netloc, path, "", "", ""))


ALLOWED_SCOPES = frozenset({"portfolio:read", "market:read"})
DEFAULT_SCOPE = "portfolio:read"
PENDING_TTL = timedelta(minutes=15)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime | None) -> datetime | None:
    """SQLite may return naive datetimes; normalize for comparison with UTC now."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def pkce_pair() -> tuple[str, str]:
    verifier = b64url(secrets.token_bytes(32))
    challenge = b64url(hashlib.sha256(verifier.encode("ascii")).digest())
    return verifier, challenge


def parse_scope_param(raw: str | None) -> str:
    if not raw or not raw.strip():
        return DEFAULT_SCOPE
    parts = [p for p in raw.strip().split() if p]
    bad = [p for p in parts if p not in ALLOWED_SCOPES]
    if bad:
        raise ValueError(f"Unsupported scope(s): {bad}. Allowed: {sorted(ALLOWED_SCOPES)}")
    return " ".join(parts)


def redirect_uri_for_api() -> str:
    base = (settings.api_public_base_url or "").rstrip("/")
    return f"{base}/api/indmoney/auth/callback"


async def fetch_authorization_server_metadata(client: httpx.AsyncClient) -> dict[str, Any]:
    url = f"{settings.indmoney_oauth_issuer.rstrip('/')}/.well-known/oauth-authorization-server"
    r = await client.get(url, timeout=30.0)
    r.raise_for_status()
    data = r.json()
    if not isinstance(data, dict):
        raise RuntimeError("Invalid authorization server metadata")
    return data


async def register_client_dcr(
    client: httpx.AsyncClient,
    registration_endpoint: str,
    redirect_uri: str,
) -> dict[str, Any]:
    """Dynamic client registration; try confidential client first, then public (none)."""
    bodies: list[dict[str, Any]] = [
        {
            "client_name": settings.indmoney_oauth_client_name,
            "redirect_uris": [redirect_uri],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "client_secret_basic",
        },
        {
            "client_name": settings.indmoney_oauth_client_name,
            "redirect_uris": [redirect_uri],
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "token_endpoint_auth_method": "none",
        },
    ]
    last_err: Exception | None = None
    for body in bodies:
        try:
            r = await client.post(registration_endpoint, json=body, timeout=30.0)
            r.raise_for_status()
            out = r.json()
            if isinstance(out, dict) and out.get("client_id"):
                return out
        except Exception as e:  # noqa: BLE001
            last_err = e
            log.debug("DCR attempt failed (%s): %s", body.get("token_endpoint_auth_method"), e)
            continue
    raise RuntimeError(f"DCR failed after retries: {last_err}")


def _token_basic_auth(client_id: str, client_secret: str | None) -> tuple[str, str]:
    """INDmoney token/revoke endpoints expect RFC 6749 client authentication via Basic header (even when secret is empty)."""
    return (client_id.strip(), (client_secret or "").strip())


async def exchange_authorization_code(
    client: httpx.AsyncClient,
    token_endpoint: str,
    client_id: str,
    client_secret: str | None,
    code: str,
    redirect_uri: str,
    code_verifier: str,
) -> dict[str, Any]:
    data: dict[str, str] = {
        "grant_type": "authorization_code",
        "client_id": client_id.strip(),
        "code": code,
        "redirect_uri": redirect_uri,
        "code_verifier": code_verifier,
    }
    r = await client.post(
        token_endpoint,
        data=data,
        auth=_token_basic_auth(client_id, client_secret),
        timeout=30.0,
    )
    r.raise_for_status()
    tok = r.json()
    if not isinstance(tok, dict):
        raise RuntimeError("Invalid token response")
    if "expires_in" in tok:
        tok["expires_at"] = int(time.time()) + int(tok["expires_in"])
    return tok


async def refresh_access_token(
    client: httpx.AsyncClient,
    token_endpoint: str,
    client_id: str,
    client_secret: str | None,
    refresh_token_value: str,
) -> dict[str, Any]:
    data: dict[str, str] = {
        "grant_type": "refresh_token",
        "client_id": client_id.strip(),
        "refresh_token": refresh_token_value,
    }
    r = await client.post(
        token_endpoint,
        data=data,
        auth=_token_basic_auth(client_id, client_secret),
        timeout=30.0,
    )
    r.raise_for_status()
    tok = r.json()
    if not isinstance(tok, dict):
        raise RuntimeError("Invalid refresh response")
    if "expires_in" in tok:
        tok["expires_at"] = int(time.time()) + int(tok["expires_in"])
    return tok


async def revoke_token(
    client: httpx.AsyncClient,
    revocation_endpoint: str,
    client_id: str,
    client_secret: str | None,
    token: str,
    *,
    hint: str | None = "refresh_token",
) -> None:
    data: dict[str, str] = {"token": token, "client_id": client_id.strip()}
    if hint:
        data["token_type_hint"] = hint
    try:
        r = await client.post(
            revocation_endpoint,
            data=data,
            auth=_token_basic_auth(client_id, client_secret),
            timeout=30.0,
        )
        if r.status_code >= 400:
            log.warning("Token revoke returned %s: %s", r.status_code, r.text[:200])
    except Exception as e:  # noqa: BLE001
        log.warning("Token revoke failed: %s", e)


# --- DB ---


async def load_oauth_row(session: AsyncSession) -> IndmoneyOAuth | None:
    res = await session.execute(select(IndmoneyOAuth).where(IndmoneyOAuth.id == 1))
    return res.scalar_one_or_none()


async def ensure_oauth_row(session: AsyncSession) -> IndmoneyOAuth:
    row = await load_oauth_row(session)
    if row is not None:
        return row
    row = IndmoneyOAuth(id=1, updated_at=_now())
    session.add(row)
    await session.commit()
    await session.refresh(row)
    return row


async def oauth_is_linked(session: AsyncSession) -> bool:
    row = await load_oauth_row(session)
    if row is None:
        return False
    if (row.refresh_token or "").strip():
        return True
    now = _now()
    exp = _as_utc(row.expires_at)
    if (row.access_token or "").strip() and exp and exp > now:
        return True
    if (row.access_token or "").strip() and row.expires_at is None:
        return True
    return False


def _expires_at_from_token_payload(tok: dict[str, Any]) -> datetime | None:
    if "expires_at" in tok and tok["expires_at"] is not None:
        return datetime.fromtimestamp(int(tok["expires_at"]), tz=timezone.utc)
    return None


async def save_oauth_tokens(session: AsyncSession, tok: dict[str, Any]) -> None:
    row = await ensure_oauth_row(session)
    row.access_token = str(tok.get("access_token") or "") or None
    if tok.get("refresh_token"):
        row.refresh_token = str(tok["refresh_token"])
    exp = _expires_at_from_token_payload(tok)
    row.expires_at = exp
    row.updated_at = _now()
    await session.commit()
    await session.refresh(row)


async def save_oauth_client(session: AsyncSession, reg: dict[str, Any], redirect_uri: str) -> None:
    row = await ensure_oauth_row(session)
    row.client_id = str(reg.get("client_id") or "")
    sec = reg.get("client_secret")
    row.client_secret = str(sec) if sec else None
    row.redirect_uri = redirect_uri
    row.updated_at = _now()
    await session.commit()
    await session.refresh(row)


async def clear_oauth_tokens_only(session: AsyncSession) -> None:
    row = await load_oauth_row(session)
    if row is None:
        return
    row.access_token = None
    row.refresh_token = None
    row.expires_at = None
    row.updated_at = _now()
    await session.commit()


async def clear_oauth_full(session: AsyncSession) -> None:
    row = await load_oauth_row(session)
    if row is None:
        return
    row.client_id = None
    row.client_secret = None
    row.redirect_uri = None
    row.access_token = None
    row.refresh_token = None
    row.expires_at = None
    row.updated_at = _now()
    await session.commit()


async def prune_stale_pending(session: AsyncSession) -> None:
    cutoff = _now() - PENDING_TTL
    await session.execute(delete(IndmoneyOAuthPending).where(IndmoneyOAuthPending.created_at < cutoff))
    await session.commit()


async def add_pending(
    session: AsyncSession,
    state_val: str,
    verifier: str,
    scope: str,
    return_base: str | None = None,
) -> None:
    session.add(
        IndmoneyOAuthPending(
            state=state_val,
            code_verifier=verifier,
            scope=scope,
            return_base=return_base,
            created_at=_now(),
        )
    )
    await session.commit()


async def take_pending(session: AsyncSession, state_val: str) -> tuple[str, str, str | None] | None:
    res = await session.execute(select(IndmoneyOAuthPending).where(IndmoneyOAuthPending.state == state_val))
    row = res.scalar_one_or_none()
    if row is None:
        return None
    verifier = row.code_verifier
    scope = row.scope
    rb = (row.return_base or "").strip() or None
    await session.delete(row)
    await session.commit()
    return verifier, scope, rb


async def get_valid_oauth_access_token(session: AsyncSession) -> str | None:
    """Return a usable access token from DB, refreshing with refresh_token if needed."""
    row = await load_oauth_row(session)
    if row is None or not (row.client_id or "").strip():
        return None
    cid = row.client_id.strip()
    csec = (row.client_secret or "").strip() or None
    now = _now()
    skew = timedelta(seconds=90)

    if (row.access_token or "").strip():
        exp = _as_utc(row.expires_at)
        if exp is None or exp > now + skew:
            return row.access_token.strip()
    rt = (row.refresh_token or "").strip()
    if not rt:
        return None

    try:
        async with httpx.AsyncClient() as client:
            meta = await fetch_authorization_server_metadata(client)
            token_ep = str(meta.get("token_endpoint") or "")
            if not token_ep:
                return None
            tok = await refresh_access_token(client, token_ep, cid, csec, rt)
    except Exception as e:  # noqa: BLE001
        log.warning("OAuth refresh failed: %s", e)
        return None

    await save_oauth_tokens(session, tok)
    row2 = await load_oauth_row(session)
    if row2 and (row2.access_token or "").strip():
        return row2.access_token.strip()
    return None


async def revoke_and_clear_oauth(session: AsyncSession) -> None:
    row = await load_oauth_row(session)
    if row is None:
        return
    meta: dict[str, Any] = {}
    try:
        async with httpx.AsyncClient() as client:
            meta = await fetch_authorization_server_metadata(client)
            rev = str(meta.get("revocation_endpoint") or "")
            cid = (row.client_id or "").strip()
            csec = (row.client_secret or "").strip() or None
            if rev and cid:
                rt = (row.refresh_token or "").strip()
                if rt:
                    await revoke_token(client, rev, cid, csec, rt, hint="refresh_token")
                elif (row.access_token or "").strip():
                    await revoke_token(client, rev, cid, csec, row.access_token.strip(), hint="access_token")
    except Exception as e:  # noqa: BLE001
        log.warning("OAuth revoke/metadata during disconnect: %s", e)
    await clear_oauth_tokens_only(session)


def build_authorize_url(
    authorization_endpoint: str,
    *,
    client_id: str,
    redirect_uri: str,
    scope: str,
    state: str,
    code_challenge: str,
) -> str:
    q = {
        "response_type": "code",
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    return f"{authorization_endpoint}?{urlencode(q)}"


def new_oauth_state() -> str:
    return b64url(secrets.token_bytes(16))
