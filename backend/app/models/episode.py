from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum as SAEnum, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class EpisodeQuality(str, PyEnum):
    good = "good"
    usable = "usable"
    bad = "bad"


class Episode(Base):
    __tablename__ = "episodes"
    __table_args__ = (
        Index("ix_episodes_recorded_at_robot_id", "recorded_at", "robot_id"),
        Index("ix_episodes_quality_recorded_at", "quality", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    episode_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    robot_id: Mapped[str] = mapped_column(String(64), nullable=False)
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    operator_name: Mapped[str] = mapped_column(String(255), nullable=False)
    quality: Mapped[str] = mapped_column(
        SAEnum(EpisodeQuality, native_enum=False, validate_strings=True),
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
