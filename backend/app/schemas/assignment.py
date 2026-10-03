from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class AssignmentCreate(BaseModel):
    episode_id: int


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    episode_id: int
    assigned_by: int
