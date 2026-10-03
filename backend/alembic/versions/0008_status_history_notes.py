"""Store client feedback on request status history entries.

Revision ID: 0008_status_history_notes
Revises: 0007_managed_auth_sessions
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008_status_history_notes"
down_revision: Union[str, None] = "0007_managed_auth_sessions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("status_history", sa.Column("note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("status_history", "note")
