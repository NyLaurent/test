from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EpisodeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    episode_id: str
    robot_id: str
    task_name: str
    recorded_at: datetime
    duration_seconds: int
    operator_name: str
    quality: str


class EpisodeImportIssue(BaseModel):
    line_number: int
    reason: str


class EpisodeImportRow(BaseModel):
    line_number: int
    episode_id: str


class EpisodeImportSummary(BaseModel):
    total_rows: int
    imported_count: int
    imported_rows: list[EpisodeImportRow]
    skipped_count: int
    reasons: list[str]
    skipped_rows: list[EpisodeImportIssue]


class EpisodePage(BaseModel):
    items: list[EpisodeRead]
    total: int
    limit: int
    offset: int


class EpisodeSeedRow(BaseModel):
    line_number: int
    episode_id: str | None = None
    robot_id: str | None = None
    task_name: str | None = None
    recorded_at: str | None = None
    duration_seconds: str | None = None
    operator_name: str | None = None
    quality: str | None = None


class EpisodeSeedPreview(BaseModel):
    items: list[EpisodeSeedRow]
    total: int
    limit: int
    offset: int


class EpisodeGenerateRequest(BaseModel):
    count: int = Field(ge=1, le=20_000)
