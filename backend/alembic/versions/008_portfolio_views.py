"""Portfolio views and active view on rules."""

from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None

_DEFAULT_GROUPS = {
    "mf": True,
    "in_stocks": True,
    "us_stocks": True,
    "etfs": True,
    "cash": True,
    "fd": True,
    "epf": True,
    "crypto": True,
    "gold": True,
    "other": True,
}


def upgrade() -> None:
    conn = op.get_bind()
    insp = inspect(conn)
    tables = insp.get_table_names()

    if "portfolio_views" not in tables:
        op.create_table(
            "portfolio_views",
            sa.Column("id", sa.String(length=36), nullable=False),
            sa.Column("name", sa.String(length=128), nullable=False),
            sa.Column("include_asset_groups", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )

    col_names = {c["name"] for c in insp.get_columns("rules")}
    if "active_portfolio_view_id" not in col_names:
        # SQLite: add column without ALTER FK (FK enforcement optional on SQLite).
        op.add_column("rules", sa.Column("active_portfolio_view_id", sa.String(length=36), nullable=True))

    now = datetime.now(timezone.utc)
    n = conn.execute(text("SELECT COUNT(*) FROM portfolio_views")).scalar()
    if n == 0:
        vid = str(uuid.uuid4())
        conn.execute(
            text(
                """
                INSERT INTO portfolio_views (id, name, include_asset_groups, created_at, updated_at)
                VALUES (:id, :name, :json, :ts, :ts)
                """
            ),
            {"id": vid, "name": "All assets", "json": json.dumps(_DEFAULT_GROUPS), "ts": now},
        )
        conn.execute(
            text(
                "UPDATE rules SET active_portfolio_view_id = :vid "
                "WHERE id = (SELECT id FROM rules ORDER BY id ASC LIMIT 1)"
            ),
            {"vid": vid},
        )


def downgrade() -> None:
    with op.batch_alter_table("rules") as batch_op:
        batch_op.drop_column("active_portfolio_view_id")
    op.drop_table("portfolio_views")
