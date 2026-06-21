"""INDmoney OAuth pending: optional return_base for post-callback redirect

Revision ID: 005
Revises: 004
Create Date: 2026-06-22
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("indmoney_oauth_pending", sa.Column("return_base", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("indmoney_oauth_pending", "return_base")
