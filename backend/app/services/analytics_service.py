from __future__ import annotations

from datetime import date, datetime, timedelta

from sqlalchemy import func, select
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
        end_dt = datetime.combine(
            date.fromisoformat(str(end_date)) + timedelta(days=1),
            datetime.min.time(),
        )
    return start_dt, end_dt


def _apply_datetime_range(query, column, start_date: date | str | None, end_date: date | str | None):
    start_dt, end_dt = _start_end_datetimes(start_date, end_date)
    if start_dt is not None:
        query = query.where(column >= start_dt)
    if end_dt is not None:
        query = query.where(column < end_dt)
    return query


class AnalyticsService:
    @staticmethod
    def get_episodes_per_day_per_robot(db: Session, start_date: date | str | None, end_date: date | str | None) -> list[dict]:
        query = select(
            func.date(Episode.recorded_at).label("recorded_date"),
            Episode.robot_id,
            func.count(Episode.id).label("episode_count"),
        ).where(Episode.recorded_at.is_not(None))
        query = _apply_datetime_range(query, Episode.recorded_at, start_date, end_date)
        query = query.group_by(func.date(Episode.recorded_at), Episode.robot_id).order_by(Episode.robot_id, func.date(Episode.recorded_at))
        rows = db.execute(query).all()
        return [
            {"recorded_date": row.recorded_date.isoformat() if hasattr(row.recorded_date, "isoformat") else str(row.recorded_date), "robot_id": row.robot_id, "episode_count": row.episode_count}
            for row in rows
        ]

    @staticmethod
    def get_request_fulfilment(
        db: Session,
        start_date: date | str | None = None,
        end_date: date | str | None = None,
    ) -> list[dict]:
        query = select(DatasetRequest.status, func.count(DatasetRequest.id).label("request_count"))
        query = _apply_datetime_range(query, DatasetRequest.created_at, start_date, end_date)
        rows = db.execute(
            query.group_by(DatasetRequest.status)
            .order_by(DatasetRequest.status)
        ).all()
        return [{"status": row.status, "request_count": row.request_count} for row in rows]

    @staticmethod
    def get_delivery_median_seconds(
        db: Session,
        start_date: date | str | None = None,
        end_date: date | str | None = None,
    ) -> int | None:
        delivered = (
            select(
                StatusHistory.request_id,
                func.min(StatusHistory.changed_at).label("delivered_at"),
            )
            .where(StatusHistory.to_status == RequestStatus.delivered.value)
            .group_by(StatusHistory.request_id)
            .subquery()
        )
        submitted_deliveries = (
            select(
                DatasetRequest.id.label("request_id"),
                DatasetRequest.created_at.label("submitted_at"),
                delivered.c.delivered_at,
            )
            .select_from(DatasetRequest)
            .join(delivered, DatasetRequest.id == delivered.c.request_id)
            .where(delivered.c.delivered_at >= DatasetRequest.created_at)
            .subquery()
        )
        query = select(
            (
                func.extract("epoch", submitted_deliveries.c.delivered_at)
                - func.extract("epoch", submitted_deliveries.c.submitted_at)
            ).label("seconds")
        )
        query = _apply_datetime_range(
            query,
            submitted_deliveries.c.submitted_at,
            start_date,
            end_date,
        )

        diff = query.subquery()

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
    def get_top_good_tasks(
        db: Session,
        limit: int = 5,
        start_date: date | str | None = None,
        end_date: date | str | None = None,
    ) -> list[dict]:
        query = select(Episode.task_name, func.count(Episode.id).label("good_episode_count"))
        query = query.where(Episode.quality == "good")
        query = _apply_datetime_range(query, Episode.recorded_at, start_date, end_date)
        rows = db.execute(
            query
            .group_by(Episode.task_name)
            .order_by(func.count(Episode.id).desc(), Episode.task_name)
            .limit(limit)
        ).all()
        return [{"task_name": row.task_name, "good_episode_count": row.good_episode_count} for row in rows]
