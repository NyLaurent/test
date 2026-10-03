from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.episode import Episode
from app.models.user import User, UserRole
from app.schemas.episode import EpisodeImportSummary, EpisodeRead
from app.services.episode_import_service import EpisodeImportService

router = APIRouter(prefix="/episodes", tags=["episodes"])


@router.get("", response_model=list[EpisodeRead])
def list_episodes(
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> list[Episode]:
    return db.query(Episode).order_by(Episode.recorded_at.desc()).all()


@router.post("/import", response_model=EpisodeImportSummary)
def import_episodes(
    csv_text: str,
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
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
