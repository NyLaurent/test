from __future__ import annotations

import csv
from io import StringIO

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.episode import Episode, EpisodeQuality

REQUIRED_FIELDS = {"episode_id", "robot_id", "task_name", "recorded_at", "duration_seconds", "operator_name", "quality"}
VALID_QUALITIES = {quality.value for quality in EpisodeQuality}


class ImportSummary:
    def __init__(self) -> None:
        self.total_rows = 0
        self.imported_count = 0
        self.skipped_count = 0
        self.reasons: list[str] = []


class EpisodeImportService:
    @staticmethod
    def normalize_row(row: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for key, value in row.items():
            normalized[key] = (value or "").strip()
        normalized["robot_id"] = normalized.get("robot_id", "").strip().lower()
        normalized["task_name"] = normalized.get("task_name", "").strip()
        normalized["quality"] = normalized.get("quality", "").strip().lower()
        normalized["operator_name"] = normalized.get("operator_name", "").strip()
        return normalized

    @staticmethod
    def parse_duration(value: str) -> int:
        if not value:
            raise ValueError("missing duration_seconds")
        return int(float(value))

    @staticmethod
    def import_csv(db: Session, csv_text: str) -> ImportSummary:
        summary = ImportSummary()
        reader = csv.DictReader(StringIO(csv_text))
        if reader.fieldnames is None:
            raise ValueError("CSV file is missing a header row")

        missing_fields = REQUIRED_FIELDS - set(field.strip() for field in reader.fieldnames)
        if missing_fields:
            raise ValueError(f"CSV headers missing required columns: {sorted(missing_fields)}")

        seen_ids: set[str] = set()
        for line_number, raw_row in enumerate(reader, start=2):
            summary.total_rows += 1
            row = EpisodeImportService.normalize_row(raw_row)
            try:
                if not row.get("episode_id"):
                    raise ValueError("missing episode_id")
                if row["episode_id"] in seen_ids:
                    raise ValueError("duplicate episode_id in file")
                seen_ids.add(row["episode_id"])

                if not row.get("robot_id"):
                    raise ValueError("missing robot_id")
                if not row.get("task_name"):
                    raise ValueError("missing task_name")
                if not row.get("operator_name"):
                    raise ValueError("missing operator_name")
                if row["quality"] not in VALID_QUALITIES:
                    raise ValueError(f"invalid quality: {row['quality']}")

                existing = db.scalar(select(Episode).where(Episode.episode_id == row["episode_id"]))
                if existing is not None:
                    raise ValueError("already exists")

                duration_minutes = EpisodeImportService.parse_duration(row["duration_seconds"])
                episode = Episode(
                    episode_id=row["episode_id"],
                    robot_id=row["robot_id"],
                    task_name=row["task_name"],
                    recorded_at=row["recorded_at"],
                    duration_seconds=duration_minutes,
                    operator_name=row["operator_name"],
                    quality=row["quality"],
                )
                db.add(episode)
                db.flush()
                summary.imported_count += 1
            except Exception as exc:
                summary.skipped_count += 1
                summary.reasons.append(f"line {line_number}: {exc}")
                continue

        db.commit()
        return summary
