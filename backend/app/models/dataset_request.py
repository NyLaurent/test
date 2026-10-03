from __future__ import annotations

from datetime import date, datetime
from enum import Enum as PyEnum

from sqlalchemy import Date, DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RequestStatus(str, PyEnum):
    submitted = "submitted"
    in_progress = "in_progress"
    delivered = "delivered"
    accepted = "accepted"
    rejected = "rejected"


class DatasetRequest(Base):
    __tablename__ = "dataset_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    task_name: Mapped[str] = mapped_column(String(255), nullable=False)
    episodes_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    deadline: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        SAEnum(RequestStatus, native_enum=False, validate_strings=True),
        nullable=False,
        default=RequestStatus.submitted,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    client = relationship("User", foreign_keys=[client_id])
    status_history = relationship("StatusHistory", back_populates="request", cascade="all, delete-orphan")
