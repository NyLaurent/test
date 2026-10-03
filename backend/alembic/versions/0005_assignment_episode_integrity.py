"""Enforce one-request-per-episode assignments and episode references.

Revision ID: 0005_assignment_integrity
Revises: 0004_create_episodes
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005_assignment_integrity"
down_revision: Union[str, None] = "0004_create_episodes"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    duplicate_episode = connection.execute(
        sa.text(
            "SELECT episode_id FROM assignments "
            "GROUP BY episode_id HAVING COUNT(*) > 1 LIMIT 1"
        )
    ).first()
    if duplicate_episode is not None:
        raise RuntimeError(
            "Cannot enforce unique episode assignments while duplicate assignments exist. "
            "Resolve duplicate episode_id assignments and rerun the migration."
        )
    orphaned_assignment = connection.execute(
        sa.text(
            "SELECT assignments.episode_id FROM assignments "
            "LEFT JOIN episodes ON assignments.episode_id = episodes.id "
            "WHERE episodes.id IS NULL LIMIT 1"
        )
    ).first()
    if orphaned_assignment is not None:
        raise RuntimeError(
            "Cannot enforce episode references while assignments point to missing episodes. "
            "Resolve orphaned episode assignments and rerun the migration."
        )

    with op.batch_alter_table("assignments") as batch_op:
        batch_op.create_unique_constraint(
            "uq_assignment_episode_id",
            ["episode_id"],
        )
        batch_op.create_foreign_key(
            "fk_assignments_episode_id_episodes",
            "episodes",
            ["episode_id"],
            ["id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("assignments") as batch_op:
        batch_op.drop_constraint("fk_assignments_episode_id_episodes", type_="foreignkey")
        batch_op.drop_constraint("uq_assignment_episode_id", type_="unique")
