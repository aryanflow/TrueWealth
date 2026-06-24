"""Maps discovered MCP tools to capabilities without hardcoding vendor tool names."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any

from app.mcp.client import IndmoneyMcpClient
from app.schemas import McpToolSummary

log = logging.getLogger(__name__)

# INDmoney `networth_holdings` asset_type literals accepted by the MCP tool (see server errors for the exact set).
# Do not add GOLD/SGB here unless INDmoney extends the enum — otherwise every call fails validation.
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


# Substrings that disqualify a tool from being treated as "transactions" (avoid greeks/ohlc matching "history").
_TX_TOOL_EXCLUDE: tuple[str, ...] = (
    "greeks",
    "ohlc",
    "movers",
    "option",
    "watchlist",
    "lookup",
    "allocation",
    "snapshot",
    "sips",
    "details",
    "by_category",
    "funds_details",
    "stocks_details",
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
    _tools_raw: list[dict[str, Any]] = field(default_factory=list, repr=False)
    _holdings_tool: str | None = None
    _tx_tool: str | None = None

    def mcp_tool_catalog(self) -> list[McpToolSummary]:
        out: list[McpToolSummary] = []
        for t in self._tools_raw:
            n = _tool_name(t)
            if not n:
                continue
            raw_desc = t.get("description") or t.get("summary") or ""
            desc = str(raw_desc).strip() if raw_desc is not None else ""
            out.append(McpToolSummary(name=n, description=desc or None))
        out.sort(key=lambda x: x.name.lower())
        return out

    async def discover(self) -> list[str]:
        tools = await self.client.tools_list()
        self._tools_raw = [t for t in tools if isinstance(t, dict)]
        names = [_tool_name(t) for t in self._tools_raw if _tool_name(t)]
        self.tool_names = sorted(set(names))
        self._holdings_tool = self._pick_tool(
            self.tool_names,
            ("holding", "holdings", "portfolio", "position", "positions", "security", "scrip", "investment"),
        )
        self._tx_tool = self._pick_tool(
            self.tool_names,
            ("transaction", "transactions", "trade", "trades", "order", "ledger"),
            exclude_substrings=_TX_TOOL_EXCLUDE,
        )
        log.info("MCP tool inventory: %s", self.tool_names)
        log.info("Selected holdings tool=%s tx tool=%s", self._holdings_tool, self._tx_tool)
        return self.tool_names

    @staticmethod
    def _pick_tool(
        names: list[str],
        keywords: tuple[str, ...],
        *,
        exclude_substrings: tuple[str, ...] = (),
    ) -> str | None:
        best: tuple[int, str] | None = None
        for n in names:
            nl = n.lower()
            if any(x in nl for x in exclude_substrings):
                continue
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
        """INDmoney exposes per-asset-class holdings; each call requires ``asset_type``.

        Fetches in **pairs** (max 2 concurrent) with a short gap to balance speed vs rate limits.
        Asset types that hit ``rate_limit_exceeded`` are retried once after a short cooldown.
        """

        rate_limited_types: list[str] = []

        async def one(asset_type: str, *, track_rate_limit: bool = True) -> list[dict[str, Any]]:
            chunk: Any = None
            for attempt in range(2):
                try:
                    chunk = await self.client.tools_call("networth_holdings", {"asset_type": asset_type})
                except Exception as e:  # noqa: BLE001
                    log.debug("networth_holdings %s failed: %s", asset_type, e)
                    return []
                if isinstance(chunk, dict) and chunk.get("error") == "rate_limit_exceeded":
                    wait = int(chunk.get("retry_after_seconds") or 5)
                    log.warning(
                        "networth_holdings %s rate limited (attempt %s/%s); retry in %ss",
                        asset_type,
                        attempt + 1,
                        2,
                        wait,
                    )
                    if attempt < 1:
                        await asyncio.sleep(min(max(wait, 1), 5))
                        continue
                    if track_rate_limit:
                        rate_limited_types.append(asset_type)
                    return []
                break
            if isinstance(chunk, str):
                if chunk.startswith("Error executing"):
                    log.warning("networth_holdings %s: %s", asset_type, chunk[:300])
                return []
            if not isinstance(chunk, dict):
                return []
            if chunk.get("error"):
                log.warning(
                    "networth_holdings %s service error: %s",
                    asset_type,
                    str(chunk.get("message") or chunk.get("error"))[:200],
                )
                return []
            rows = chunk.get("holdings")
            if isinstance(rows, list):
                n = len([r for r in rows if isinstance(r, dict)])
                if n:
                    log.info("networth_holdings asset_type=%s rows=%s", asset_type, n)
                return [{**r, "asset_type": asset_type} for r in rows if isinstance(r, dict)]
            return []

        merged: list[dict[str, Any]] = []
        types = list(NETWORTH_HOLDINGS_ASSET_TYPES)
        for i in range(0, len(types), 2):
            batch = types[i : i + 2]
            parts = await asyncio.gather(*(one(t) for t in batch))
            for rows in parts:
                merged.extend(rows)
            if i + 2 < len(types):
                await asyncio.sleep(0.35)

        if rate_limited_types:
            cooldown = 8
            log.info(
                "networth_holdings: second pass for %s rate-limited types after %ss",
                rate_limited_types,
                cooldown,
            )
            await asyncio.sleep(cooldown)
            for asset_type in rate_limited_types:
                merged.extend(await one(asset_type, track_rate_limit=False))

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
