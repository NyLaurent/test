from __future__ import annotations

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from sqlalchemy import func, not_, select
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.episode import Episode, EpisodeQuality
from app.models.assignment import Assignment
from app.models.user import User, UserRole
from app.schemas.episode import EpisodeImportIssue, EpisodeImportSummary, EpisodePage, EpisodeRead
from app.services.episode_import_service import EpisodeImportService

router = APIRouter(prefix="/episodes", tags=["episodes"])


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


@router.post("/import", response_model=EpisodeImportSummary)
def import_episodes(
    csv_text: str = Body(media_type="text/csv"),
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> EpisodeImportSummary:
    try:
        summary = EpisodeImportService.import_csv(db, csv_text)
        return EpisodeImportSummary(
            total_rows=summary.total_rows,
            imported_count=summary.imported_count,
            skipped_count=summary.skipped_count,
            reasons=summary.reasons,
            skipped_rows=[
                EpisodeImportIssue.model_validate(issue)
                for issue in summary.skipped_rows
            ],
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
