"""Append-only audit trail for local overrides and rule changes."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditLog


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def append_audit(session: AsyncSession, kind: str, detail: str) -> None:
    session.add(AuditLog(kind=kind[:64], detail=detail[:4000], created_at=_now()))
    await session.flush()
