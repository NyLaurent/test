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
        return AssignmentService.assign_episodes(db, request, [episode], assigned_by_id)[0]

    @staticmethod
    def assign_episodes(
        db: Session,
        request: DatasetRequest,
        episodes: list[Episode],
        assigned_by_id: int,
    ) -> list[Assignment]:
        if request.status not in {"in_progress", "rejected"}:
            raise ValueError("Episodes can only be assigned to requests in progress or in rework")
        if not episodes:
            raise ValueError("Select at least one episode")

        episode_ids = [episode.id for episode in episodes]
        if len(episode_ids) != len(set(episode_ids)):
            raise ValueError("Episode ids must be unique")
        if any(episode.quality not in {EpisodeQuality.good.value, EpisodeQuality.usable.value} for episode in episodes):
            raise ValueError("Only good or usable episodes can be assigned")

        existing_ids = set(db.scalars(
            select(Assignment.episode_id).where(Assignment.episode_id.in_(episode_ids))
        ).all())
        if existing_ids:
            raise ValueError("Episode is already assigned to a request")

        assignments = [
            Assignment(request_id=request.id, episode_id=episode.id, assigned_by=assigned_by_id)
            for episode in episodes
        ]
        db.add_all(assignments)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ValueError("Episode is already assigned to a request") from exc
        for assignment in assignments:
            db.refresh(assignment)
        return assignments
