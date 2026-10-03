from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AssignmentCreate(BaseModel):
    episode_id: int


class AssignmentBulkCreate(BaseModel):
    episode_ids: list[int] = Field(min_length=1)

    @field_validator("episode_ids")
    @classmethod
    def episode_ids_must_be_unique(cls, value: list[int]) -> list[int]:
        if len(value) != len(set(value)):
            raise ValueError("Episode ids must be unique")
        return value


class AssignmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    request_id: int
    episode_id: int
    assigned_by: int
