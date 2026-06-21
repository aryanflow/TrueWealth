"""Stub pipelines for news and fundamentals (V1 returns empty)."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any


@dataclass
class PipelineResult:
    items: list[dict[str, Any]]
    ran_at: datetime
    status: str = "stub"


class NewsPipeline(ABC):
    @abstractmethod
    async def run(self, symbols: list[str]) -> PipelineResult:
        raise NotImplementedError


class FundamentalsPipeline(ABC):
    @abstractmethod
    async def run(self, symbols: list[str]) -> PipelineResult:
        raise NotImplementedError


class StubNewsPipeline(NewsPipeline):
    async def run(self, symbols: list[str]) -> PipelineResult:
        return PipelineResult(items=[], ran_at=datetime.now(timezone.utc), status="stub_empty")


class StubFundamentalsPipeline(FundamentalsPipeline):
    async def run(self, symbols: list[str]) -> PipelineResult:
        return PipelineResult(items=[], ran_at=datetime.now(timezone.utc), status="stub_empty")
