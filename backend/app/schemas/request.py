from __future__ import annotations

from datetime import date

from pydantic import BaseModel, ConfigDict


class RequestCreate(BaseModel):
    task_name: str
    episodes_requested: int
    deadline: date | None = None
    notes: str | None = None


class RequestStatusUpdate(BaseModel):
    status: str


class RequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    task_name: str
    episodes_requested: int
    deadline: date | None = None
    notes: str | None = None
    status: str


class StatusHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    from_status: str | None
    to_status: str
    changed_by: int
