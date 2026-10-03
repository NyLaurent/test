from __future__ import annotations

import csv
from datetime import datetime, timezone
from io import StringIO

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
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
        self.skipped_rows: list[dict[str, int | str]] = []

    def skip_row(self, line_number: int, reason: str) -> None:
        self.skipped_count += 1
        self.reasons.append(f"line {line_number}: {reason}")
        self.skipped_rows.append({"line_number": line_number, "reason": reason})


class EpisodeImportService:
    @staticmethod
    def normalize_row(row: dict[str, str]) -> dict[str, str]:
        normalized: dict[str, str] = {}
        for key, value in row.items():
            if isinstance(key, str):
                normalized[key] = value.strip() if isinstance(value, str) else ""
        normalized["robot_id"] = normalized.get("robot_id", "").strip().lower()
        normalized["task_name"] = normalized.get("task_name", "").strip()
        normalized["quality"] = normalized.get("quality", "").strip().lower()
        normalized["operator_name"] = normalized.get("operator_name", "").strip()
        return normalized

    @staticmethod
    def parse_duration(value: str) -> int:
        if not value:
            raise ValueError("missing duration_seconds")
        try:
            duration = float(value)
        except ValueError as exc:
            raise ValueError("duration_seconds must be numeric") from exc
        if not duration.is_integer() or duration < 0:
            raise ValueError("duration_seconds must be a non-negative whole number")
        return int(duration)

    @staticmethod
    def parse_recorded_at(value: str) -> datetime:
        if not value:
            raise ValueError("missing recorded_at")
        normalized = value.strip()
        if normalized.endswith(("Z", "z")):
            normalized = f"{normalized[:-1]}+00:00"
        try:
            recorded_at = datetime.fromisoformat(normalized)
        except ValueError as exc:
            raise ValueError(f"invalid recorded_at: {value}") from exc
        if recorded_at.tzinfo is None:
            recorded_at = recorded_at.replace(tzinfo=timezone.utc)
        return recorded_at

    @staticmethod
    def import_csv(db: Session, csv_text: str) -> ImportSummary:
        summary = ImportSummary()
        reader = csv.DictReader(StringIO(csv_text))
        if reader.fieldnames is None:
            raise ValueError("CSV file is missing a header row")

        reader.fieldnames = [
            (field or "").strip().lstrip("\ufeff").lower()
            for field in reader.fieldnames
        ]
        missing_fields = REQUIRED_FIELDS - set(reader.fieldnames)
        if missing_fields:
            raise ValueError(f"CSV headers missing required columns: {sorted(missing_fields)}")

        seen_ids: set[str] = set()
        for line_number, raw_row in enumerate(reader, start=2):
            summary.total_rows += 1
            if None in raw_row:
                summary.skip_row(line_number, "too many columns")
                continue
            row = EpisodeImportService.normalize_row(raw_row)
            try:
                if not row.get("episode_id"):
                    raise ValueError("missing episode_id")
                if row["episode_id"] in seen_ids:
                    raise ValueError("duplicate episode_id in file")

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

                duration_seconds = EpisodeImportService.parse_duration(row["duration_seconds"])
                recorded_at = EpisodeImportService.parse_recorded_at(row["recorded_at"])
                episode = Episode(
                    episode_id=row["episode_id"],
                    robot_id=row["robot_id"],
                    task_name=row["task_name"],
                    recorded_at=recorded_at,
                    duration_seconds=duration_seconds,
                    operator_name=row["operator_name"],
                    quality=row["quality"],
                )
                with db.begin_nested():
                    db.add(episode)
                    db.flush()
                summary.imported_count += 1
                seen_ids.add(row["episode_id"])
            except (ValueError, TypeError, OverflowError, IntegrityError) as exc:
                message = "already exists" if isinstance(exc, IntegrityError) else str(exc)
                summary.skip_row(line_number, message)
                continue

        try:
            db.commit()
        except Exception:
            db.rollback()
            raise
        return summary
