from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.assignment import Assignment
from app.models.dataset_request import DatasetRequest, RequestStatus
from app.models.status_history import StatusHistory
from app.models.user import User, UserRole

ALLOWED_TRANSITIONS = {
    RequestStatus.submitted: {RequestStatus.in_progress},
    RequestStatus.in_progress: {RequestStatus.delivered},
    RequestStatus.delivered: {RequestStatus.accepted, RequestStatus.rejected},
    RequestStatus.rejected: {RequestStatus.in_progress},
}

ROLE_TRANSITIONS = {
    UserRole.client: {RequestStatus.accepted, RequestStatus.rejected},
    UserRole.operator: {RequestStatus.submitted, RequestStatus.in_progress, RequestStatus.delivered},
    UserRole.admin: {RequestStatus.submitted, RequestStatus.in_progress, RequestStatus.delivered},
}


def _status_value(value: str | RequestStatus) -> RequestStatus:
    if isinstance(value, RequestStatus):
        return value
    return RequestStatus(value)


class RequestService:
    @staticmethod
    def create_request(
        db: Session,
        *,
        client_id: int,
        task_name: str,
        episodes_requested: int,
        deadline: date | None,
        notes: str | None,
    ) -> DatasetRequest:
        if not task_name.strip():
            raise ValueError("Task name is required")
        if episodes_requested <= 0:
            raise ValueError("Episodes requested must be greater than zero")

        request = DatasetRequest(
            client_id=client_id,
            task_name=task_name.strip(),
            episodes_requested=episodes_requested,
            deadline=deadline,
            notes=notes.strip() if notes else None,
            status=RequestStatus.submitted,
        )
        db.add(request)
        db.flush()
        db.add(
            StatusHistory(
                request_id=request.id,
                from_status=None,
                to_status=RequestStatus.submitted.value,
                changed_by=client_id,
            )
        )
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def get_requests_for_user(db: Session, user: User) -> list[DatasetRequest]:
        if user.role in {UserRole.operator, UserRole.admin}:
            return db.scalars(select(DatasetRequest).order_by(DatasetRequest.created_at.desc())).all()
        return db.scalars(
            select(DatasetRequest)
            .where(DatasetRequest.client_id == user.id)
            .order_by(DatasetRequest.created_at.desc())
        ).all()

    @staticmethod
    def get_request(db: Session, request_id: int, user: User) -> DatasetRequest:
        request = db.get(DatasetRequest, request_id)
        if request is None:
            raise LookupError("Request not found")
        if user.role not in {UserRole.operator, UserRole.admin} and request.client_id != user.id:
            raise PermissionError("You do not have access to this request")
        return request

    @staticmethod
    def get_assigned_episode_count(db: Session, request_id: int) -> int:
        count = db.scalar(
            select(func.count(Assignment.id)).where(Assignment.request_id == request_id)
        )
        return int(count or 0)

    @staticmethod
    def update_client_request(
        db: Session,
        *,
        request: DatasetRequest,
        changes: dict,
    ) -> DatasetRequest:
        if _status_value(request.status) != RequestStatus.submitted:
            raise ValueError("Only submitted requests can be edited")

        if "task_name" in changes:
            task_name = changes["task_name"].strip()
            if not task_name:
                raise ValueError("Task name is required")
            request.task_name = task_name
        if "episodes_requested" in changes:
            episodes_requested = changes["episodes_requested"]
            if episodes_requested <= 0:
                raise ValueError("Episodes requested must be greater than zero")
            request.episodes_requested = episodes_requested
        if "deadline" in changes:
            request.deadline = changes["deadline"]
        if "notes" in changes:
            request.notes = changes["notes"].strip() if changes["notes"] else None

        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def delete_client_request(db: Session, *, request: DatasetRequest) -> None:
        if _status_value(request.status) != RequestStatus.submitted:
            raise ValueError("Only submitted requests can be deleted")
        if RequestService.get_assigned_episode_count(db, request.id):
            raise ValueError("Requests with assigned episodes cannot be deleted")
        db.delete(request)
        db.commit()

    @staticmethod
    def update_status(
        db: Session,
        *,
        request: DatasetRequest,
        new_status: str | RequestStatus,
        changed_by: User,
        note: str | None = None,
    ) -> DatasetRequest:
        target = _status_value(new_status)
        current = _status_value(request.status)

        if not RequestService.is_valid_transition(current, target):
            raise ValueError(f"Invalid status transition: {current.value} -> {target.value}")

        if changed_by.role not in ROLE_TRANSITIONS or target not in ROLE_TRANSITIONS[changed_by.role]:
            raise PermissionError("You do not have permission to perform this status change")

        normalized_note = note.strip() if note else None
        if target == RequestStatus.rejected and not normalized_note:
            raise ValueError("A note is required when requesting changes to a delivery")

        if target == RequestStatus.delivered:
            assigned_count = RequestService.get_assigned_episode_count(db, request.id)
            if assigned_count < request.episodes_requested:
                raise ValueError("Request cannot be delivered until enough episodes are assigned")

        request.status = target.value
        history = StatusHistory(
            request_id=request.id,
            from_status=current.value,
            to_status=target.value,
            note=normalized_note,
            changed_by=changed_by.id,
        )
        db.add(history)
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def is_valid_transition(current_status: str | RequestStatus, new_status: str | RequestStatus) -> bool:
        current = _status_value(current_status)
        target = _status_value(new_status)
        return target in ALLOWED_TRANSITIONS.get(current, set())
