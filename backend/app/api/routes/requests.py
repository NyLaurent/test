from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.dataset_request import DatasetRequest, RequestStatus
from app.models.episode import Episode
from app.models.status_history import StatusHistory
from app.models.user import User, UserRole
from app.schemas.assignment import AssignmentBulkCreate, AssignmentCreate, AssignmentRead
from app.schemas.episode import EpisodeRead
from app.schemas.request import (
    RequestCreate,
    RequestRead,
    RequestStatusUpdate,
    RequestUpdate,
    StatusHistoryRead,
)
from app.services.assignment_service import AssignmentService
from app.services.request_service import RequestService

router = APIRouter(prefix="/requests", tags=["requests"])


@router.get("", response_model=list[RequestRead])
def list_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DatasetRequest]:
    return RequestService.get_requests_for_user(db, current_user)


@router.post("", response_model=RequestRead, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: RequestCreate,
    current_user: User = Depends(require_roles(UserRole.client.value)),
    db: Session = Depends(get_db),
) -> DatasetRequest:
    try:
        return RequestService.create_request(
            db,
            client_id=current_user.id,
            task_name=payload.task_name,
            episodes_requested=payload.episodes_requested,
            deadline=payload.deadline,
            notes=payload.notes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{request_id}", response_model=RequestRead)
def get_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DatasetRequest:
    try:
        return RequestService.get_request(db, request_id, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc


@router.patch("/{request_id}", response_model=RequestRead)
def edit_client_request(
    request_id: int,
    payload: RequestUpdate,
    current_user: User = Depends(require_roles(UserRole.client.value)),
    db: Session = Depends(get_db),
) -> DatasetRequest:
    try:
        request = RequestService.get_request(db, request_id, current_user)
        return RequestService.update_client_request(
            db,
            request=request,
            changes=payload.model_dump(exclude_unset=True),
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_request(
    request_id: int,
    current_user: User = Depends(require_roles(UserRole.client.value)),
    db: Session = Depends(get_db),
) -> Response:
    try:
        request = RequestService.get_request(db, request_id, current_user)
        RequestService.delete_client_request(db, request=request)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{request_id}/status", response_model=RequestRead)
def update_request_status(
    request_id: int,
    payload: RequestStatusUpdate,
    current_user: User = Depends(
        require_roles(
            UserRole.client.value,
            UserRole.operator.value,
            UserRole.admin.value,
        )
    ),
    db: Session = Depends(get_db),
) -> DatasetRequest:
    try:
        request = RequestService.get_request(db, request_id, current_user)
        return RequestService.update_status(
            db,
            request=request,
            new_status=payload.status,
            changed_by=current_user,
            note=payload.note,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.get("/{request_id}/history", response_model=list[StatusHistoryRead])
def get_request_history(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[StatusHistory]:
    try:
        request = RequestService.get_request(db, request_id, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    return db.scalars(
        select(StatusHistory)
        .where(StatusHistory.request_id == request.id)
        .order_by(StatusHistory.changed_at, StatusHistory.id)
    ).all()


@router.get("/{request_id}/episodes", response_model=list[EpisodeRead])
def get_request_episodes(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[Episode]:
    try:
        request = RequestService.get_request(db, request_id, current_user)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc

    if current_user.role == UserRole.client and request.status not in {
        RequestStatus.delivered.value,
        RequestStatus.accepted.value,
        RequestStatus.rejected.value,
    }:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assigned episodes are available after delivery",
        )

    episode_ids = db.scalars(select(Assignment.episode_id).where(Assignment.request_id == request.id)).all()
    if not episode_ids:
        return []
    return db.scalars(select(Episode).where(Episode.id.in_(episode_ids))).all()


@router.post(
    "/{request_id}/episodes/bulk",
    response_model=list[AssignmentRead],
    status_code=status.HTTP_201_CREATED,
)
def assign_episodes_to_request(
    request_id: int,
    payload: AssignmentBulkCreate,
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> list[Assignment]:
    try:
        request = RequestService.get_request(db, request_id, current_user)
        episodes = db.scalars(select(Episode).where(Episode.id.in_(payload.episode_ids))).all()
        if len(episodes) != len(payload.episode_ids):
            raise ValueError("One or more selected episodes were not found")
        episodes_by_id = {episode.id: episode for episode in episodes}
        ordered_episodes = [episodes_by_id[episode_id] for episode_id in payload.episode_ids]
        return AssignmentService.assign_episodes(db, request, ordered_episodes, current_user.id)
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{request_id}/episodes", response_model=AssignmentRead, status_code=status.HTTP_201_CREATED)
def assign_episode_to_request(
    request_id: int,
    payload: AssignmentCreate,
    current_user: User = Depends(require_roles(UserRole.operator.value, UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> Assignment:
    try:
        request = RequestService.get_request(db, request_id, current_user)
        episode = db.get(Episode, payload.episode_id)
        if episode is None:
            raise ValueError("Episode not found")
        assignment = AssignmentService.assign_episode(db, request, episode, current_user.id)
        return assignment
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
