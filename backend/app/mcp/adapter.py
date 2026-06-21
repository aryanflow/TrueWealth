"""Maps discovered MCP tools to capabilities without hardcoding vendor tool names."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from app.mcp.client import IndmoneyMcpClient

log = logging.getLogger(__name__)

# INDmoney `networth_holdings` requires one of these per call; we merge slices into one book.
NETWORTH_HOLDINGS_ASSET_TYPES: tuple[str, ...] = (
    "IND_STOCK",
    "MF",
    "US_STOCK",
    "BOND",
    "EPF",
    "NPS",
    "SA",
    "FD",
    "CRYPTO",
    "INSURANCE",
    "VEHICLE",
    "RE",
    "RD",
    "AIF",
    "PMS",
    "PPF",
)


def _tool_name(tool: dict[str, Any]) -> str:
    return str(tool.get("name") or tool.get("id") or "")


def _score(name: str, keywords: tuple[str, ...]) -> int:
    n = name.lower()
    return sum(1 for k in keywords if k in n)


@dataclass
class IndmoneyAdapter:
    client: IndmoneyMcpClient
    tool_names: list[str] = field(default_factory=list)
    _holdings_tool: str | None = None
    _tx_tool: str | None = None

    async def discover(self) -> list[str]:
        tools = await self.client.tools_list()
        names = [_tool_name(t) for t in tools if _tool_name(t)]
        self.tool_names = sorted(set(names))
        self._holdings_tool = self._pick_tool(
            self.tool_names,
            ("holding", "holdings", "portfolio", "position", "positions", "security", "scrip", "investment"),
        )
        self._tx_tool = self._pick_tool(
            self.tool_names,
            ("transaction", "transactions", "trade", "trades", "order", "history", "ledger"),
        )
        log.info("MCP tool inventory: %s", self.tool_names)
        log.info("Selected holdings tool=%s tx tool=%s", self._holdings_tool, self._tx_tool)
        return self.tool_names

    @staticmethod
    def _pick_tool(names: list[str], keywords: tuple[str, ...]) -> str | None:
        best: tuple[int, str] | None = None
        for n in names:
            s = _score(n, keywords)
            if s == 0:
                continue
            if best is None or s > best[0] or (s == best[0] and n < best[1]):
                best = (s, n)
        return best[1] if best else None

    async def fetch_holdings(self) -> Any:
        if not self._holdings_tool:
            raise RuntimeError("No holdings-like tool discovered")
        if self._holdings_tool == "networth_holdings":
            return await self._fetch_networth_holdings_merged()
        raw = await self.client.tools_call(self._holdings_tool, {})
        if isinstance(raw, str):
            log.error("holdings tool=%s returned error string (preview): %s", self._holdings_tool, raw[:900])
            raise RuntimeError(raw[:500])
        log.info("holdings tool=%s raw_type=%s", self._holdings_tool, type(raw).__name__)
        return raw

    async def _fetch_networth_holdings_merged(self) -> list[dict[str, Any]]:
        """INDmoney exposes per-asset-class holdings; each call requires ``asset_type``."""

        async def one(asset_type: str) -> list[dict[str, Any]]:
            try:
                chunk = await self.client.tools_call("networth_holdings", {"asset_type": asset_type})
            except Exception as e:  # noqa: BLE001
                log.debug("networth_holdings %s failed: %s", asset_type, e)
                return []
            if isinstance(chunk, str):
                if chunk.startswith("Error executing"):
                    log.warning("networth_holdings %s: %s", asset_type, chunk[:300])
                return []
            if not isinstance(chunk, dict):
                return []
            rows = chunk.get("holdings")
            if isinstance(rows, list):
                n = len([r for r in rows if isinstance(r, dict)])
                if n:
                    log.info("networth_holdings asset_type=%s rows=%s", asset_type, n)
                return [r for r in rows if isinstance(r, dict)]
            return []

        parts = await asyncio.gather(*(one(at) for at in NETWORTH_HOLDINGS_ASSET_TYPES))
        merged: list[dict[str, Any]] = [row for part in parts for row in part]
        log.info("networth_holdings merged %s positions across asset types", len(merged))
        return merged

    async def fetch_transactions(self) -> Any | None:
        if not self._tx_tool:
            log.info("fetch_transactions: no tx tool selected; skipping")
            return None
        log.info("fetch_transactions: calling tool=%s", self._tx_tool)
        raw = await self.client.tools_call(self._tx_tool, {})
        if isinstance(raw, str):
            log.warning("transactions tool=%s returned string (preview): %s", self._tx_tool, raw[:600])
            return []
        return raw

    @staticmethod
    def describe_bindings() -> dict[str, str | None]:
        return {"holdings": "heuristic keyword match on discovered tool names", "transactions": "same"}
