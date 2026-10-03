"""Create the episodes table.

Revision ID: 0004_create_episodes
Revises: 0003_request_history
Create Date: 2026-09-30 15:50:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004_create_episodes"
down_revision: Union[str, None] = "0003_request_history"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "episodes",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("episode_id", sa.String(length=64), nullable=False),
        sa.Column("robot_id", sa.String(length=64), nullable=False),
        sa.Column("task_name", sa.String(length=255), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=False),
        sa.Column("operator_name", sa.String(length=255), nullable=False),
        sa.Column("quality", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_episodes_id"), "episodes", ["id"], unique=False)
    op.create_index(op.f("ix_episodes_episode_id"), "episodes", ["episode_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_episodes_episode_id"), table_name="episodes")
    op.drop_index(op.f("ix_episodes_id"), table_name="episodes")
    op.drop_table("episodes")
