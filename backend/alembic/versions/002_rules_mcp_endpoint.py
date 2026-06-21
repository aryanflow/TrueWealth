"""rules: optional INDmoney MCP URL (UI-configurable)

Revision ID: 002
Revises: 001
Create Date: 2026-06-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("rules", sa.Column("mcp_endpoint", sa.String(length=2048), nullable=True))


def downgrade() -> None:
    op.drop_column("rules", "mcp_endpoint")
