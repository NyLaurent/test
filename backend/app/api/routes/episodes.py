from __future__ import annotations

import csv
import os
import subprocess
import sys
from io import StringIO
from pathlib import Path

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func, not_, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.episode import Episode, EpisodeQuality
from app.models.assignment import Assignment
from app.models.user import User, UserRole
from app.schemas.episode import (
    EpisodeGenerateRequest,
    EpisodeImportIssue,
    EpisodeImportRow,
    EpisodeImportSummary,
    EpisodePage,
    EpisodeRead,
    EpisodeSeedPreview,
    EpisodeSeedRow,
)
from app.services.episode_import_service import EpisodeImportService

router = APIRouter(prefix="/episodes", tags=["episodes"])


def _seed_csv_path() -> Path:
    configured_path = os.environ.get("SEED_EPISODES_FILE")
    if configured_path:
        return Path(configured_path)
    return Path(__file__).resolve().parents[4] / "seed" / "episodes.csv"


def _read_seed_csv() -> str:
    seed_path = _seed_csv_path()
    try:
        return seed_path.read_text(encoding="utf-8-sig")
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The bundled episode seed CSV is not available on this server.",
        ) from exc


def _import_summary_response(summary) -> EpisodeImportSummary:
    return EpisodeImportSummary(
        total_rows=summary.total_rows,
        imported_count=summary.imported_count,
        imported_rows=[EpisodeImportRow.model_validate(row) for row in summary.imported_rows],
        skipped_count=summary.skipped_count,
        reasons=summary.reasons,
        skipped_rows=[EpisodeImportIssue.model_validate(issue) for issue in summary.skipped_rows],
    )


def _filtered_episode_query(
    task_name: str | None,
    quality: EpisodeQuality | None,
    available_only: bool,
):
    query = select(Episode)
    if task_name:
        query = query.where(Episode.task_name.ilike(f"%{task_name.strip()}%"))
    if quality:
        query = query.where(Episode.quality == quality.value)
    if available_only:
        assigned_episode = select(Assignment.id).where(Assignment.episode_id == Episode.id)
        query = query.where(
            Episode.quality.in_([EpisodeQuality.good.value, EpisodeQuality.usable.value]),
            not_(assigned_episode.exists()),
        )
    return query


@router.get("", response_model=list[EpisodeRead])
def list_episodes(
    task_name: str | None = Query(default=None, min_length=1, max_length=255),
    quality: EpisodeQuality | None = Query(default=None),
    available_only: bool = Query(default=False),
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> list[Episode]:
    query = _filtered_episode_query(task_name, quality, available_only)
    return db.scalars(query.order_by(Episode.recorded_at.desc(), Episode.id.desc())).all()


@router.get("/page", response_model=EpisodePage)
def list_episodes_page(
    task_name: str | None = Query(default=None, min_length=1, max_length=255),
    quality: EpisodeQuality | None = Query(default=None),
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> EpisodePage:
    query = _filtered_episode_query(task_name, quality, available_only=False)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    episodes = db.scalars(
        query.order_by(Episode.recorded_at.desc(), Episode.id.desc())
        .limit(limit)
        .offset(offset)
    ).all()
    return EpisodePage(items=episodes, total=total, limit=limit, offset=offset)


@router.get("/seed-preview", response_model=EpisodeSeedPreview)
def preview_seed_episodes(
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
) -> EpisodeSeedPreview:
    reader = csv.DictReader(StringIO(_read_seed_csv()))
    if reader.fieldnames is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Seed CSV has no header row.")
    reader.fieldnames = [(name or "").strip().lstrip("\ufeff").lower() for name in reader.fieldnames]
    rows = list(reader)
    items = []
    for line_number, raw_row in enumerate(rows[offset : offset + limit], start=offset + 2):
        preview_fields = EpisodeSeedRow.model_fields.keys() - {"line_number"}
        item = {
            key: raw_row.get(key).strip() if isinstance(raw_row.get(key), str) else None
            for key in preview_fields
        }
        items.append(EpisodeSeedRow(line_number=line_number, **item))
    return EpisodeSeedPreview(items=items, total=len(rows), limit=limit, offset=offset)


@router.post("/import", response_model=EpisodeImportSummary)
def import_episodes(
    csv_text: str = Body(media_type="text/csv"),
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> EpisodeImportSummary:
    try:
        return _import_summary_response(EpisodeImportService.import_csv(db, csv_text))
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/import-seed", response_model=EpisodeImportSummary)
def import_seed_episodes(
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> EpisodeImportSummary:
    try:
        summary = EpisodeImportService.import_csv(db, _read_seed_csv())
        return _import_summary_response(summary)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/generate", response_model=EpisodeImportSummary)
def generate_episodes(
    payload: EpisodeGenerateRequest,
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> EpisodeImportSummary:
    script_path = Path(__file__).resolve().parents[4] / "seed" / "generate_episodes.py"
    try:
        generated_csv = subprocess.run(
            [sys.executable, str(script_path), str(payload.count)],
            check=True,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=120,
        ).stdout
        summary = EpisodeImportService.import_csv(db, generated_csv)
        return _import_summary_response(summary)
    except (OSError, subprocess.SubprocessError) as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not generate the requested episode batch.",
        ) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
