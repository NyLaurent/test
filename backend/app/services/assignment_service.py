from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.episode import Episode, EpisodeQuality
from app.models.dataset_request import DatasetRequest


class AssignmentService:
    @staticmethod
    def get_assigned_episodes_for_request(db: Session, request_id: int) -> list[Episode]:
        assignment_rows = db.execute(
            select(Assignment.episode_id).where(Assignment.request_id == request_id)
        ).scalars().all()
        if not assignment_rows:
            return []
        return db.execute(select(Episode).where(Episode.id.in_(assignment_rows))).scalars().all()

    @staticmethod
    def assign_episode(db: Session, request: DatasetRequest, episode: Episode, assigned_by_id: int) -> Assignment:
        if request.status not in {"in_progress", "rejected"}:
            raise ValueError("Episodes can only be assigned to requests in progress or in rework")
        if episode.quality not in {EpisodeQuality.good.value, EpisodeQuality.usable.value}:
            raise ValueError("Only good or usable episodes can be assigned")

        existing = db.scalar(
            select(Assignment).where(Assignment.episode_id == episode.id)
        )
        if existing is not None:
            raise ValueError("Episode is already assigned to a request")

        assignment = Assignment(
            request_id=request.id,
            episode_id=episode.id,
            assigned_by=assigned_by_id,
        )
        db.add(assignment)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ValueError("Episode is already assigned to a request") from exc
        db.refresh(assignment)
        return assignment
