from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.assignment import Assignment
from app.models.dataset_request import DatasetRequest
from app.models.episode import Episode
from app.models.user import User, UserRole
from app.schemas.assignment import AssignmentCreate, AssignmentRead
from app.schemas.episode import EpisodeRead
from app.schemas.request import RequestCreate, RequestRead, RequestStatusUpdate
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


@router.patch("/{request_id}/status", response_model=RequestRead)
def update_request_status(
    request_id: int,
    payload: RequestStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DatasetRequest:
    try:
        request = RequestService.get_request(db, request_id, current_user)
        return RequestService.update_status(
            db,
            request=request,
            new_status=payload.status,
            changed_by=current_user,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


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

    episode_ids = db.scalars(select(Assignment.episode_id).where(Assignment.request_id == request.id)).all()
    if not episode_ids:
        return []
    return db.scalars(select(Episode).where(Episode.id.in_(episode_ids))).all()


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
