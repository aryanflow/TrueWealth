"""INDmoney OAuth: DCR client + tokens + PKCE pending rows

Revision ID: 004
Revises: 003
Create Date: 2026-06-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "indmoney_oauth",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("client_id", sa.Text(), nullable=True),
        sa.Column("client_secret", sa.Text(), nullable=True),
        sa.Column("redirect_uri", sa.String(length=1024), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=True),
        sa.Column("refresh_token", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "indmoney_oauth_pending",
        sa.Column("state", sa.String(length=128), primary_key=True, nullable=False),
        sa.Column("code_verifier", sa.Text(), nullable=False),
        sa.Column("scope", sa.String(length=512), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.execute(
        sa.text(
            "INSERT INTO indmoney_oauth (id, client_id, client_secret, redirect_uri, access_token, refresh_token, expires_at, updated_at) "
            "VALUES (1, NULL, NULL, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP)"
        )
    )


def downgrade() -> None:
    op.drop_table("indmoney_oauth_pending")
    op.drop_table("indmoney_oauth")
