"""Add indexes for analytics date-range aggregations.

Revision ID: 0006_analytics_query_indexes
Revises: 0005_assignment_integrity
"""

from typing import Sequence, Union

from alembic import op

revision: str = "0006_analytics_query_indexes"
down_revision: Union[str, None] = "0005_assignment_integrity"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_episodes_recorded_at_robot_id",
        "episodes",
        ["recorded_at", "robot_id"],
    )
    op.create_index(
        "ix_episodes_quality_recorded_at",
        "episodes",
        ["quality", "recorded_at"],
    )
    op.create_index(
        "ix_dataset_requests_created_at_status",
        "dataset_requests",
        ["created_at", "status"],
    )
    op.create_index(
        "ix_status_history_to_status_request_changed",
        "status_history",
        ["to_status", "request_id", "changed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_status_history_to_status_request_changed", table_name="status_history")
    op.drop_index("ix_dataset_requests_created_at_status", table_name="dataset_requests")
    op.drop_index("ix_episodes_quality_recorded_at", table_name="episodes")
    op.drop_index("ix_episodes_recorded_at_robot_id", table_name="episodes")
