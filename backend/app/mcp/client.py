from __future__ import annotations

import json
import logging
from typing import Any

import httpx

log = logging.getLogger(__name__)

# Match initialize payload; streamable HTTP servers may require this header.
MCP_PROTOCOL_VERSION = "2024-11-05"


def _redact_headers(h: dict[str, str]) -> dict[str, str]:
    out: dict[str, str] = {}
    for k, v in h.items():
        lk = k.lower()
        if lk == "authorization":
            out[k] = "Bearer ***redacted***" if str(v).lower().startswith("bearer ") else "***redacted***"
        else:
            out[k] = v
    return out


def _preview(text: str, n: int = 480) -> str:
    t = text.replace("\n", " ").strip()
    if len(t) <= n:
        return t
    return t[:n] + "…"


def _jsonrpc_messages_from_sse(text: str) -> list[dict[str, Any]]:
    """Parse MCP streamable HTTP SSE body: lines `data: {json}`."""
    out: list[dict[str, Any]] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            obj = json.loads(payload)
        except json.JSONDecodeError:
            log.debug("SSE data line not JSON: %s", payload[:160])
            continue
        if isinstance(obj, dict):
            out.append(obj)
    return out


def _pick_jsonrpc_for_id(messages: list[dict[str, Any]], expect_id: str) -> dict[str, Any]:
    eid = str(expect_id)
    for m in reversed(messages):
        if str(m.get("id")) == eid:
            return m
    for m in reversed(messages):
        if "result" in m or "error" in m:
            return m
    return {}


class IndmoneyMcpClient:
    """JSON-RPC client for HTTP MCP endpoints (tools/list, tools/call).

    Supports streamable HTTP (``Accept: application/json, text/event-stream``) where
    the server may return ``text/event-stream`` instead of a single JSON body.
    """

    def __init__(
        self,
        endpoint: str | None,
        timeout_sec: float = 30.0,
        extra_headers: dict[str, str] | None = None,
    ):
        self.timeout_sec = timeout_sec
        self._id = 0
        self._extra_headers: dict[str, str] = dict(extra_headers or {})
        self._mcp_session_id: str | None = None
        self.set_endpoint(endpoint)

    def set_extra_headers(self, extra_headers: dict[str, str] | None) -> None:
        self._extra_headers = dict(extra_headers or {})
        self._mcp_session_id = None

    def set_endpoint(self, endpoint: str | None) -> None:
        self.endpoint = (endpoint or "").strip() or None
        self._mcp_session_id = None

    def configured(self) -> bool:
        return bool(self.endpoint)

    def _next_id(self) -> str:
        self._id += 1
        return str(self._id)

    def _capture_session(self, r: httpx.Response) -> None:
        sid = r.headers.get("mcp-session-id") or r.headers.get("Mcp-Session-Id")
        if sid:
            self._mcp_session_id = sid.strip()

    def _base_mcp_headers(self) -> dict[str, str]:
        h = {
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            **self._extra_headers,
        }
        if self._mcp_session_id:
            h["Mcp-Session-Id"] = self._mcp_session_id
        return h

    def _parse_response(self, r: httpx.Response, expect_id: str) -> dict[str, Any]:
        self._capture_session(r)
        if r.status_code == 202:
            return {}
        raw = (r.content or b"").strip()
        if not raw:
            return {}
        ct = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
        if "text/event-stream" in ct:
            text = r.text
            msgs = _jsonrpc_messages_from_sse(text)
            if not msgs:
                log.warning("SSE response had no parseable JSON-RPC messages (first 200 chars): %r", text[:200])
            picked = _pick_jsonrpc_for_id(msgs, expect_id)
            return picked if isinstance(picked, dict) else {}
        try:
            data = r.json()
        except json.JSONDecodeError:
            log.warning("MCP POST returned non-JSON body (status=%s ct=%r len=%s)", r.status_code, ct, len(raw))
            return {}
        return data if isinstance(data, dict) else {}

    async def rpc(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.configured():
            raise RuntimeError("MCP endpoint not configured")
        req_id = self._next_id()
        body: dict[str, Any] = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}}
        headers = self._base_mcp_headers()
        async with httpx.AsyncClient(timeout=self.timeout_sec) as client:
            r = await client.post(self.endpoint, json=body, headers=headers)
            r.raise_for_status()
            ct = (r.headers.get("content-type") or "").split(";")[0].strip()
            nbytes = len(r.content or b"")
            log.info(
                "MCP RPC endpoint=%s method=%s http_status=%s content_type=%s response_bytes=%s jsonrpc_id=%s session=%s req_headers=%s",
                self.endpoint,
                method,
                r.status_code,
                ct,
                nbytes,
                req_id,
                (self._mcp_session_id[:16] + "…") if self._mcp_session_id else None,
                _redact_headers(dict(headers)),
            )
            data = self._parse_response(r, req_id)
        if isinstance(data, dict) and data.get("error"):
            raise RuntimeError(str(data["error"]))
        return data

    async def rpc_notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        """JSON-RPC notification (no id). Required by some MCP hosts after initialize."""
        if not self.configured():
            raise RuntimeError("MCP endpoint not configured")
        body: dict[str, Any] = {"jsonrpc": "2.0", "method": method, "params": params or {}}
        headers = self._base_mcp_headers()
        async with httpx.AsyncClient(timeout=self.timeout_sec) as client:
            r = await client.post(self.endpoint, json=body, headers=headers)
            r.raise_for_status()
            self._capture_session(r)
            log.info("MCP rpc_notify method=%s http_status=%s bytes=%s", method, r.status_code, len(r.content or b""))

    async def tools_list(self) -> list[dict[str, Any]]:
        for attempt in (False, True):
            if attempt:
                try:
                    await self.rpc(
                        "initialize",
                        {
                            "protocolVersion": MCP_PROTOCOL_VERSION,
                            "capabilities": {},
                            "clientInfo": {"name": "truewealth", "version": "1.0.0"},
                        },
                    )
                    await self.rpc_notify("notifications/initialized", {})
                except Exception as e:  # noqa: BLE001
                    log.debug("initialize path failed: %s", e)
            try:
                res = await self.rpc("tools/list", {})
            except Exception as e:  # noqa: BLE001
                if attempt:
                    raise
                log.debug("tools/list first try failed: %s", e)
                continue
            tools = res.get("result", {})
            if isinstance(tools, dict) and isinstance(tools.get("tools"), list):
                tl = tools["tools"]
                log.info("MCP tools/list resolved count=%s (dict.tools)", len(tl))
                return tl
            if isinstance(tools, list):
                log.info("MCP tools/list resolved count=%s (list result)", len(tools))
                return tools
        log.warning("MCP tools/list returned no tool list after retries")
        return []

    async def tools_call(self, name: str, arguments: dict[str, Any] | None = None) -> Any:
        args = arguments or {}
        log.info("MCP tools/call name=%s argument_keys=%s", name, sorted(args.keys()))
        res = await self.rpc("tools/call", {"name": name, "arguments": args})
        result = res.get("result")
        log.info(
            "MCP tools/call name=%s result_top_type=%s",
            name,
            type(result).__name__,
        )
        # MCP content array
        if isinstance(result, dict) and "content" in result:
            contents = result.get("content") or []
            texts: list[str] = []
            for c in contents:
                if isinstance(c, dict) and c.get("type") == "text" and "text" in c:
                    texts.append(str(c["text"]))
            if texts:
                blob = "\n".join(texts)
                log.info("MCP tools/call name=%s content_text_preview=%s", name, _preview(blob, 500))
                try:
                    return json.loads(blob)
                except json.JSONDecodeError:
                    return blob
        if isinstance(result, str):
            log.warning("MCP tools/call name=%s string result preview=%s", name, _preview(result, 600))
        elif isinstance(result, dict):
            log.info("MCP tools/call name=%s dict result keys=%s", name, list(result.keys())[:30])
        return result
