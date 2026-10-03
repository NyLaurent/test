from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class RequestCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_name: str = Field(min_length=1, max_length=255)
    episodes_requested: int = Field(gt=0)
    deadline: date | None = None
    notes: str | None = Field(default=None, max_length=10_000)


class RequestUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    task_name: str | None = Field(default=None, min_length=1, max_length=255)
    episodes_requested: int | None = Field(default=None, gt=0)
    deadline: date | None = None
    notes: str | None = Field(default=None, max_length=10_000)

    @field_validator("task_name", "episodes_requested", mode="before")
    @classmethod
    def required_update_values_cannot_be_null(cls, value: object) -> object:
        if value is None:
            raise ValueError("This field cannot be null")
        return value

    @model_validator(mode="after")
    def require_at_least_one_change(self) -> "RequestUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided")
        return self


class RequestStatusUpdate(BaseModel):
    status: str
    note: str | None = Field(default=None, max_length=10_000)

    @field_validator("note")
    @classmethod
    def normalize_note(cls, value: str | None) -> str | None:
        normalized = value.strip() if value else None
        return normalized or None


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
    note: str | None
    changed_by: int
    changed_at: datetime
