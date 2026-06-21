"""rules: optional MCP bearer token (dashboard paste, local dev)

Revision ID: 003
Revises: 002
Create Date: 2026-06-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("rules", sa.Column("mcp_bearer_token", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("rules", "mcp_bearer_token")
