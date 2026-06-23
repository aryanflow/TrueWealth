#!/usr/bin/env python3
"""Probe INDmoney MCP from the backend: tools/list, True Wealth bindings, optional holdings shape.

Run from the backend directory so ``.env`` loads (see ``app.config.Settings``).

  cd backend && python3 scripts/mcp_probe.py
  cd backend && python3 scripts/mcp_probe.py --holdings

Auth (same *order* as the running API: ``state.refresh_mcp_auth_from_rule``):

1. ``INDMONEY_MCP_BEARER_TOKEN`` in ``backend/.env`` when you pass ``--env-only``.
2. Otherwise: read ``backend/data/truewealth.db`` (or ``DATABASE_URL``) with stdlib
   ``sqlite``: OAuth access token if still within ``expires_at``, then
   ``rules.mcp_bearer_token``, then env token.

   OAuth **refresh** is not run from this script (use the app or full venv +
   ``get_valid_oauth_access_token``). If the row is only expired, use .env or
   reconnect in Settings.

MCP URL: ``rules.mcp_endpoint`` overrides ``INDMONEY_MCP_URL`` when that column is
non-null (empty string = mock-only / no URL).

Use ``--env-only`` to force .env only (no SQLite).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sqlite3
import sys
from collections import Counter
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Run as ``python3 scripts/mcp_probe.py`` from backend/
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))
os.chdir(_BACKEND)


def _sqlite_db_file() -> Path | None:
    from sqlalchemy.engine.url import make_url

    from app.config import settings

    try:
        u = make_url(settings.database_url)
    except Exception:
        return None
    if "sqlite" not in (u.drivername or ""):
        return None
    if not u.database:
        return None
    p = Path(str(u.database))
    if not p.is_absolute():
        p = (_BACKEND / p).resolve()
    return p


def _parse_expires(raw: object) -> datetime | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _resolve_credentials(*, env_only: bool) -> tuple[str | None, str | None, str, bool]:
    """URL, bearer (or None), source label, oauth_expired_but_present."""
    from app.config import INDMONEY_MCP_PUBLIC_URL, settings

    env_url = (settings.mcp_endpoint or "").strip() or INDMONEY_MCP_PUBLIC_URL
    env_tok = (settings.mcp_bearer_token or "").strip()

    if env_only:
        if env_tok:
            return env_url, env_tok, "Environment INDMONEY_MCP_BEARER_TOKEN (--env-only)", False
        return env_url, None, "", False

    url: str | None = env_url
    db_tok = ""
    oauth_at = ""
    oauth_expired = False

    dbp = _sqlite_db_file()
    if dbp is not None and dbp.is_file():
        try:
            conn = sqlite3.connect(str(dbp))
            conn.row_factory = sqlite3.Row
            try:
                row = conn.execute(
                    "SELECT mcp_endpoint, mcp_bearer_token FROM rules ORDER BY id ASC LIMIT 1"
                ).fetchone()
                if row is not None and row["mcp_endpoint"] is not None:
                    s = (row["mcp_endpoint"] or "").strip()
                    url = None if s == "" else s
                if row is not None:
                    db_tok = (row["mcp_bearer_token"] or "").strip()

                try:
                    orow = conn.execute(
                        "SELECT access_token, expires_at FROM indmoney_oauth WHERE id = 1"
                    ).fetchone()
                except sqlite3.OperationalError:
                    orow = None
                if orow and (orow["access_token"] or "").strip():
                    exp = _parse_expires(orow["expires_at"])
                    now = datetime.now(timezone.utc)
                    skew = timedelta(seconds=90)
                    if exp is None or exp > now + skew:
                        oauth_at = str(orow["access_token"]).strip()
                    else:
                        oauth_expired = True
            finally:
                conn.close()
        except sqlite3.Error as e:
            print(f"Note: could not read SQLite ({dbp}): {e}\n")
    elif dbp is not None:
        print(f"Note: database file not found ({dbp}); using .env only for URL/token.\n")

    tok = (oauth_at or db_tok or env_tok).strip() or None
    if oauth_at:
        src = "SQLite (INDmoney OAuth access token)"
    elif db_tok:
        src = "SQLite (rules.mcp_bearer_token from dashboard)"
    elif env_tok:
        src = "Environment INDMONEY_MCP_BEARER_TOKEN"
    else:
        src = ""

    return url, tok, src, oauth_expired


def _print_auth_help() -> None:
    print(
        "No usable Bearer. INDmoney returns 401 without auth. Do one of:\n"
        "  • Connect INDmoney in the app (Settings), or paste a bearer under Advanced — same SQLite DB.\n"
        "  • Set INDMONEY_MCP_BEARER_TOKEN in backend/.env\n"
        "  • Run from `backend/` so this script finds `data/truewealth.db` (or your DATABASE_URL path).\n"
        "  • Use --env-only if you only want .env (no SQLite).\n"
    )


async def _main(*, holdings: bool, env_only: bool) -> int:
    from app.config import settings
    from app.mcp.adapter import IndmoneyAdapter
    from app.mcp.client import IndmoneyMcpClient
    from app.services.normalizer import normalize_payload

    url, tok, tok_src, oauth_expired = _resolve_credentials(env_only=env_only)
    if not url:
        print("MCP URL is unset (database has empty mcp_endpoint = mock-only). Nothing to probe.")
        return 1

    extra: dict[str, str] = {}
    if tok:
        extra["Authorization"] = f"Bearer {tok}"

    client = IndmoneyMcpClient(url, settings.mcp_timeout_sec, extra)
    adapter = IndmoneyAdapter(client)

    print("Endpoint:", url)
    if tok_src:
        print("Auth:", tok_src)
    else:
        print("Auth: none")
    if oauth_expired and not tok:
        print(
            "Note: INDmoney OAuth row exists but access token is past expires_at. "
            "Open the app (refresh) or set INDMONEY_MCP_BEARER_TOKEN / paste bearer in Settings.\n"
        )
    print()

    if not tok:
        if not env_only:
            print("No token from SQLite or .env — trying unauthenticated (expect 401).\n")
        else:
            print("Warning: --env-only and INDMONEY_MCP_BEARER_TOKEN unset — expect 401.\n")

    try:
        names = await adapter.discover()
    except Exception as e:  # noqa: BLE001
        print("Discovery failed:", e)
        err_s = str(e).lower()
        if "401" in err_s or "unauthorized" in err_s:
            if not tok:
                _print_auth_help()
        return 1

    print("Tools (", len(names), "):", ", ".join(names) if names else "(none)")
    print()
    catalog = adapter.mcp_tool_catalog()
    for t in catalog:
        line = f"  • {t.name}"
        if t.description:
            line += f"\n    {t.description[:240]}{'…' if len(t.description) > 240 else ''}"
        print(line)
    print()
    print("Selected holdings tool:", adapter._holdings_tool or "(none)")
    print("Selected transactions tool:", adapter._tx_tool or "(none)")
    print()

    if not holdings:
        print("Skip holdings fetch (pass --holdings to run a sample import).")
        return 0

    if not adapter._holdings_tool:
        print("No holdings-like tool; cannot fetch.")
        return 0

    try:
        raw = await adapter.fetch_holdings()
    except Exception as e:  # noqa: BLE001
        print("fetch_holdings failed:", e)
        return 1

    if isinstance(raw, list):
        print("Raw rows:", len(raw))
        sample = raw[0] if raw else None
        if isinstance(sample, dict):
            print("First row keys:", sorted(sample.keys())[:40], "…" if len(sample) > 40 else "")
    else:
        print("Raw type:", type(raw).__name__)

    now = datetime.now(timezone.utc)
    normalized = normalize_payload(raw, now=now)
    print("Normalized holdings:", len(normalized))
    if normalized:
        by_type = Counter(h.asset_type.value for h in normalized)
        print("By asset_type:", dict(by_type.most_common(20)))
        h0 = normalized[0]
        print("Example:", json.dumps(h0.model_dump(mode="json"), indent=2)[:1200])
    return 0


def main() -> None:
    p = argparse.ArgumentParser(description="Probe INDmoney MCP tools and optional holdings.")
    p.add_argument("--holdings", action="store_true", help="Fetch holdings via the selected tool and summarize.")
    p.add_argument(
        "--env-only",
        action="store_true",
        help="Use only INDMONEY_MCP_* from .env (do not read OAuth / bearer from SQLite).",
    )
    args = p.parse_args()
    code = asyncio.run(_main(holdings=args.holdings, env_only=args.env_only))
    raise SystemExit(code)


if __name__ == "__main__":
    main()
