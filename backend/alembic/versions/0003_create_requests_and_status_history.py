"""Create dataset request, status history, and assignment tables.

Revision ID: 0003_request_history
Revises: 0002_create_users
Create Date: 2026-09-30 15:40:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003_request_history"
down_revision: Union[str, None] = "0002_create_users"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "dataset_requests",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("client_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("task_name", sa.String(length=255), nullable=False),
        sa.Column("episodes_requested", sa.Integer(), nullable=False),
        sa.Column("deadline", sa.Date(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="submitted"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_dataset_requests_id"), "dataset_requests", ["id"], unique=False)
    op.create_index(op.f("ix_dataset_requests_client_id"), "dataset_requests", ["client_id"], unique=False)

    op.create_table(
        "status_history",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("request_id", sa.Integer(), sa.ForeignKey("dataset_requests.id"), nullable=False),
        sa.Column("from_status", sa.String(length=32), nullable=True),
        sa.Column("to_status", sa.String(length=32), nullable=False),
        sa.Column("changed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f("ix_status_history_id"), "status_history", ["id"], unique=False)
    op.create_index(op.f("ix_status_history_request_id"), "status_history", ["request_id"], unique=False)

    op.create_table(
        "assignments",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("request_id", sa.Integer(), sa.ForeignKey("dataset_requests.id"), nullable=False),
        sa.Column("episode_id", sa.Integer(), nullable=False),
        sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("assigned_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.UniqueConstraint("request_id", "episode_id", name="uq_request_episode_assignment"),
    )
    op.create_index(op.f("ix_assignments_id"), "assignments", ["id"], unique=False)
    op.create_index(op.f("ix_assignments_request_id"), "assignments", ["request_id"], unique=False)
    op.create_index(op.f("ix_assignments_episode_id"), "assignments", ["episode_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_assignments_episode_id"), table_name="assignments")
    op.drop_index(op.f("ix_assignments_request_id"), table_name="assignments")
    op.drop_index(op.f("ix_assignments_id"), table_name="assignments")
    op.drop_table("assignments")

    op.drop_index(op.f("ix_status_history_request_id"), table_name="status_history")
    op.drop_index(op.f("ix_status_history_id"), table_name="status_history")
    op.drop_table("status_history")

    op.drop_index(op.f("ix_dataset_requests_client_id"), table_name="dataset_requests")
    op.drop_index(op.f("ix_dataset_requests_id"), table_name="dataset_requests")
    op.drop_table("dataset_requests")
