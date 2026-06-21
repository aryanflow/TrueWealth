from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import INDMONEY_MCP_PUBLIC_URL, settings
from app.mcp.adapter import IndmoneyAdapter
from app.mcp.client import IndmoneyMcpClient
from app.schemas import NormalizedHolding, PortfolioMeta, PortfolioResponse
from app.services.broadcast import BroadcastHub
from app.services.normalizer import extract_transactions, normalize_payload
from app.services import indmoney_oauth_service as imo
from app.services.portfolio_service import (
    compute_portfolio,
    load_rules,
    log_refresh,
    persist_holdings,
    persist_transactions_stub,
    read_holdings_from_db,
)
from app.services.price_engine import apply_prices_to_holdings

log = logging.getLogger(__name__)


class AppState:
    """Process-wide portfolio cache, MCP handles, and SSE hub."""

    def __init__(self) -> None:
        self.hub = BroadcastHub()
        env_url = (settings.mcp_endpoint or "").strip() or INDMONEY_MCP_PUBLIC_URL
        self.client = IndmoneyMcpClient(env_url, settings.mcp_timeout_sec, {})
        self.adapter = IndmoneyAdapter(self.client)
        self.effective_mcp_url: str | None = env_url
        self.tool_inventory: list[str] = []
        self.mode: str = "empty"
        self.mcp_connected: bool = False
        self.mcp_degraded: bool = False
        self.mcp_bearer_configured: bool = False
        self.indmoney_oauth_connected: bool = False
        self.last_holdings_sync: datetime | None = None
        self.last_price_sync: datetime | None = None
        self.cached: PortfolioResponse | None = None
        self._lock = asyncio.Lock()

    async def apply_mcp_endpoint_from_db(self, session: AsyncSession) -> None:
        """DB URL overrides env. Empty string in DB = user chose mock only. NULL = use env (defaults to official INDmoney URL)."""
        rule = await load_rules(session)
        env_url = (settings.mcp_endpoint or "").strip() or INDMONEY_MCP_PUBLIC_URL
        raw = rule.mcp_endpoint
        if raw is not None:
            s = raw.strip()
            combined = None if s == "" else s
        else:
            combined = env_url
        self.client.set_endpoint(combined)
        self.effective_mcp_url = combined
        self.adapter = IndmoneyAdapter(self.client)
        await self.refresh_mcp_auth_from_rule(session)

    async def refresh_mcp_auth_from_rule(self, session: AsyncSession) -> None:
        rule = await load_rules(session)
        oauth_access = await imo.get_valid_oauth_access_token(session)
        db_t = (rule.mcp_bearer_token or "").strip()
        env_t = (settings.mcp_bearer_token or "").strip()
        token = (oauth_access or "").strip() or db_t or env_t
        extra: dict[str, str] = {}
        if token:
            extra["Authorization"] = f"Bearer {token}"
        self.client.set_extra_headers(extra)
        self.mcp_bearer_configured = bool(token)
        self.indmoney_oauth_connected = await imo.oauth_is_linked(session)

    async def apply_oauth_token_from_exchange(self, session: AsyncSession, tok: dict[str, Any]) -> None:
        """Right after code exchange: set Bearer from token JSON (fast). Avoids get_valid/refresh network in OAuth redirect path."""
        at = str(tok.get("access_token") or "").strip()
        extra: dict[str, str] = {}
        if at:
            extra["Authorization"] = f"Bearer {at}"
        self.client.set_extra_headers(extra)
        self.mcp_bearer_configured = bool(at)
        self.indmoney_oauth_connected = await imo.oauth_is_linked(session)

    def meta(self) -> PortfolioMeta:
        return PortfolioMeta(
            last_holdings_sync=self.last_holdings_sync,
            last_price_sync=self.last_price_sync,
            mode=self.mode,
            mcp_endpoint=self.effective_mcp_url,
            mcp_connected=self.mcp_connected,
            mcp_degraded=self.mcp_degraded,
            tool_inventory=list(self.tool_inventory),
            mcp_bearer_configured=self.mcp_bearer_configured,
            indmoney_oauth_connected=self.indmoney_oauth_connected,
        )

    async def startup_discover(self, session: AsyncSession) -> None:
        await self.apply_mcp_endpoint_from_db(session)
        if not self.client.configured():
            log.warning("Mock-only mode (dashboard cleared INDmoney URL). Official default is %s", INDMONEY_MCP_PUBLIC_URL)
            self.mcp_connected = False
            self.mcp_degraded = True
            self.tool_inventory = []
            return
        try:
            names = await self.adapter.discover()
            self.tool_inventory = names
            self.mcp_connected = True
            self.mcp_degraded = not bool(self.adapter._holdings_tool)
            log.info(
                "startup_discover: mcp_connected=%s degraded=%s tools=%s holdings_tool=%s",
                self.mcp_connected,
                self.mcp_degraded,
                len(names),
                self.adapter._holdings_tool,
            )
            if self.mcp_degraded:
                log.warning("MCP connected but no holdings-like tool matched heuristics.")
        except Exception as e:  # noqa: BLE001
            log.exception("MCP discovery failed: %s", e)
            self.mcp_connected = False
            self.mcp_degraded = True
            self.tool_inventory = []

    async def refresh_holdings(self, session: AsyncSession) -> PortfolioResponse:
        async with self._lock:
            raw: Any = []
            txs_raw: Any = []

            if self.mcp_connected and self.adapter._holdings_tool:
                try:
                    log.info(
                        "refresh_holdings: fetching via MCP tool=%s endpoint=%s bearer=%s",
                        self.adapter._holdings_tool,
                        self.effective_mcp_url,
                        "yes" if self.mcp_bearer_configured else "no",
                    )
                    raw = await self.adapter.fetch_holdings()
                    self.mode = "live"
                    self.mcp_degraded = False
                    await log_refresh(session, "holdings", "ok", "mcp_holdings")
                    log.info(
                        "refresh_holdings: raw type=%s list_len=%s",
                        type(raw).__name__,
                        len(raw) if isinstance(raw, list) else "n/a",
                    )
                except Exception as e:  # noqa: BLE001
                    log.exception("refresh_holdings: MCP fetch failed — using empty book (no sample fallback): %s", e)
                    self.mcp_degraded = True
                    raw = []
                    self.mode = "degraded"
                    await log_refresh(session, "holdings", "error", str(e)[:800])
            else:
                log.warning(
                    "refresh_holdings: MCP not usable (mcp_connected=%s holdings_tool=%s endpoint_configured=%s) — empty book",
                    self.mcp_connected,
                    self.adapter._holdings_tool,
                    self.client.configured(),
                )
                raw = []
                self.mcp_degraded = True
                self.mode = "empty" if not self.client.configured() else "degraded"

            now = datetime.now(timezone.utc)
            normalized = normalize_payload(raw, now=now)
            log.info("refresh_holdings: normalized holdings count=%s mode=%s", len(normalized), self.mode)
            rows = [h.model_dump(mode="json") for h in normalized]
            priced = apply_prices_to_holdings(rows)
            holdings = [NormalizedHolding.model_validate(x) for x in priced]

            if self.adapter._tx_tool and self.mcp_connected:
                try:
                    txs_raw = await self.adapter.fetch_transactions()
                    if txs_raw is None:
                        txs_raw = []
                    if isinstance(txs_raw, str):
                        log.warning(
                            "refresh_holdings: tx tool returned error string (preview): %s",
                            txs_raw[:400],
                        )
                        txs_raw = []
                except Exception as e:  # noqa: BLE001
                    log.warning("refresh_holdings: transactions MCP failed (empty tx list): %s", e)
                    txs_raw = []
            else:
                log.info("refresh_holdings: skipping transactions (no tool or MCP disconnected)")
                txs_raw = []

            txs = extract_transactions(txs_raw)
            log.info("refresh_holdings: transaction rows count=%s", len(txs))
            await persist_holdings(session, holdings)
            await persist_transactions_stub(session, txs)

            self.last_holdings_sync = now
            rule = await load_rules(session)
            meta = self.meta()
            self.cached = compute_portfolio(holdings, rule=rule, meta=meta)
            return self.cached

    async def refresh_prices(self, session: AsyncSession) -> PortfolioResponse:
        async with self._lock:
            holdings_db = await read_holdings_from_db(session)
            plain: list[dict[str, Any]] = []
            for h in holdings_db:
                d = h.model_dump(mode="json")
                d["asset_type"] = h.asset_type.value
                d["country"] = h.country.value
                d["currency"] = h.currency.value
                plain.append(d)
            priced = apply_prices_to_holdings(plain)
            holdings = [NormalizedHolding.model_validate(x) for x in priced]
            now = datetime.now(timezone.utc)
            log.info("refresh_prices: rows=%s", len(holdings))
            for h in holdings:
                h.updated_at = now
            await persist_holdings(session, holdings)
            self.last_price_sync = now
            rule = await load_rules(session)
            meta = self.meta()
            self.cached = compute_portfolio(holdings, rule=rule, meta=meta)
            return self.cached


state = AppState()
