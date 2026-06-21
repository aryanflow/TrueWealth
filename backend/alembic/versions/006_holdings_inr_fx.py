"""holdings: INR book columns + asset_class_l2; fx_rates table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("holdings_current", sa.Column("inr_market_value", sa.Float(), nullable=False, server_default="0"))
    op.add_column("holdings_current", sa.Column("inr_unrealized_pnl", sa.Float(), nullable=True))
    op.add_column("holdings_current", sa.Column("inr_day_change_value", sa.Float(), nullable=True))
    op.add_column("holdings_current", sa.Column("fx_usd_inr_used", sa.Float(), nullable=True))
    op.add_column("holdings_current", sa.Column("fx_as_of", sa.DateTime(timezone=True), nullable=True))
    op.add_column("holdings_current", sa.Column("asset_class_l2", sa.String(length=128), nullable=True))
    op.create_table(
        "fx_rates",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("pair", sa.String(length=16), nullable=False),
        sa.Column("rate", sa.Float(), nullable=False),
        sa.Column("as_of", sa.DateTime(timezone=True), nullable=False),
        sa.Column("source", sa.String(length=64), nullable=False, server_default="static"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fx_rates_pair_as_of", "fx_rates", ["pair", "as_of"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_fx_rates_pair_as_of", table_name="fx_rates")
    op.drop_table("fx_rates")
    op.drop_column("holdings_current", "asset_class_l2")
    op.drop_column("holdings_current", "fx_as_of")
    op.drop_column("holdings_current", "fx_usd_inr_used")
    op.drop_column("holdings_current", "inr_day_change_value")
    op.drop_column("holdings_current", "inr_unrealized_pnl")
    op.drop_column("holdings_current", "inr_market_value")

