from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict


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


class EpisodeImportSummary(BaseModel):
    total_rows: int
    imported_count: int
    skipped_count: int
    reasons: list[str]
