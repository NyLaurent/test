from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import Date, and_, func, select, text
from sqlalchemy.orm import Session

from app.models.dataset_request import DatasetRequest, RequestStatus
from app.models.episode import Episode
from app.models.status_history import StatusHistory


def _start_end_datetimes(start_date: date | str | None, end_date: date | str | None) -> tuple[datetime | None, datetime | None]:
    if start_date is None:
        start_dt = None
    else:
        start_dt = datetime.combine(date.fromisoformat(str(start_date)), datetime.min.time())
    if end_date is None:
        end_dt = None
    else:
        end_dt = datetime.combine(date.fromisoformat(str(end_date)), datetime.max.time())
    return start_dt, end_dt


class AnalyticsService:
    @staticmethod
    def get_episodes_per_day_per_robot(db: Session, start_date: date | str | None, end_date: date | str | None) -> list[dict]:
        start_dt, end_dt = _start_end_datetimes(start_date, end_date)
        query = select(
            func.date(Episode.recorded_at).label("recorded_date"),
            Episode.robot_id,
            func.count(Episode.id).label("episode_count"),
        ).where(Episode.recorded_at.is_not(None))
        if start_dt is not None:
            query = query.where(Episode.recorded_at >= start_dt)
        if end_dt is not None:
            query = query.where(Episode.recorded_at <= end_dt)
        query = query.group_by(func.date(Episode.recorded_at), Episode.robot_id).order_by(Episode.robot_id, func.date(Episode.recorded_at))
        rows = db.execute(query).all()
        return [
            {"recorded_date": row.recorded_date.isoformat() if hasattr(row.recorded_date, "isoformat") else str(row.recorded_date), "robot_id": row.robot_id, "episode_count": row.episode_count}
            for row in rows
        ]

    @staticmethod
    def get_request_fulfilment(db: Session) -> list[dict]:
        rows = db.execute(
            select(DatasetRequest.status, func.count(DatasetRequest.id).label("request_count"))
            .group_by(DatasetRequest.status)
            .order_by(DatasetRequest.status)
        ).all()
        return [{"status": row.status, "request_count": row.request_count} for row in rows]

    @staticmethod
    def get_delivery_median_seconds(db: Session) -> int | None:
        submitted = (
            select(
                StatusHistory.request_id,
                func.min(StatusHistory.changed_at).label("submitted_at"),
            )
            .where(StatusHistory.to_status == RequestStatus.submitted.value)
            .group_by(StatusHistory.request_id)
            .subquery()
        )
        delivered = (
            select(
                StatusHistory.request_id,
                func.min(StatusHistory.changed_at).label("delivered_at"),
            )
            .where(StatusHistory.to_status == RequestStatus.delivered.value)
            .group_by(StatusHistory.request_id)
            .subquery()
        )

        diff = (
            select(
                (
                    func.extract("epoch", delivered.c.delivered_at) - func.extract("epoch", submitted.c.submitted_at)
                ).label("seconds")
            )
            .select_from(submitted.join(delivered, submitted.c.request_id == delivered.c.request_id))
            .subquery()
        )

        ordered = (
            select(
                diff.c.seconds,
                func.row_number().over(order_by=diff.c.seconds.asc()).label("rn"),
                func.count().over().label("total"),
            )
            .select_from(diff)
            .subquery()
        )

        median_query = (
            select(func.avg(ordered.c.seconds).label("median_seconds"))
            .where(
                (ordered.c.rn == (ordered.c.total + 1) / 2)
                | (ordered.c.rn == (ordered.c.total + 2) / 2)
            )
        )
        median_value = db.execute(median_query).scalar_one_or_none()
        if median_value is None:
            return None
        return int(median_value)

    @staticmethod
    def get_top_good_tasks(db: Session, limit: int = 5) -> list[dict]:
        rows = db.execute(
            select(Episode.task_name, func.count(Episode.id).label("good_episode_count"))
            .where(Episode.quality == "good")
            .group_by(Episode.task_name)
            .order_by(func.count(Episode.id).desc(), Episode.task_name)
            .limit(limit)
        ).all()
        return [{"task_name": row.task_name, "good_episode_count": row.good_episode_count} for row in rows]
