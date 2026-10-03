from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.episode import Episode, EpisodeQuality
from app.models.dataset_request import DatasetRequest


class AssignmentService:
    @staticmethod
    def assign_episode(db: Session, request: DatasetRequest, episode: Episode, assigned_by_id: int) -> Assignment:
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
        db.commit()
        db.refresh(assignment)
        return assignment
