from __future__ import annotations

import asyncio
import json
from collections.abc import AsyncIterator
from datetime import datetime, timezone
from typing import Any


class BroadcastHub:
    """Fan-out SSE events to subscribers."""

    def __init__(self) -> None:
        self._queues: list[asyncio.Queue[tuple[str, dict[str, Any]]]] = []
        self._lock = asyncio.Lock()

    async def subscribe(self) -> AsyncIterator[tuple[str, dict[str, Any]]]:
        q: asyncio.Queue[tuple[str, dict[str, Any]]] = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._queues.append(q)
        try:
            while True:
                yield await q.get()
        finally:
            async with self._lock:
                if q in self._queues:
                    self._queues.remove(q)

    async def publish(self, channel: str, payload: dict[str, Any]) -> None:
        env = {"channel": channel, "payload": payload, "ts": datetime.now(timezone.utc).isoformat()}
        async with self._lock:
            dead: list[asyncio.Queue[tuple[str, dict[str, Any]]]] = []
            for q in self._queues:
                try:
                    q.put_nowait((channel, env))
                except asyncio.QueueFull:
                    dead.append(q)
            for q in dead:
                if q in self._queues:
                    self._queues.remove(q)

    def sse_format(self, channel: str, env: dict[str, Any]) -> str:
        return f"event: {channel}\ndata: {json.dumps(env)}\n\n"
