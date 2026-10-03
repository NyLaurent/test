from datetime import datetime

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.assignment import Assignment
from app.models.episode import Episode, EpisodeQuality
from app.models.dataset_request import RequestStatus
from app.models.user import UserRole
from app.services.auth_service import AuthService
from app.services.assignment_service import AssignmentService
from app.services.request_service import RequestService


def test_good_episode_can_be_assigned(client, db_session) -> None:
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )
    operator = AuthService.create_user(
        db_session,
        email="operator@example.com",
        password="StrongPass123!",
        role=UserRole.operator,
        full_name="Ops User",
    )
    request = RequestService.create_request(
        db_session,
        client_id=client_user.id,
        task_name="pick cups",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    request.status = RequestStatus.in_progress.value
    db_session.commit()
    episode = Episode(
        episode_id="EP-100",
        robot_id="arm-01",
        task_name="pick cups",
        recorded_at=datetime(2026, 9, 1, 0, 0, 0),
        duration_seconds=60,
        operator_name="Ada",
        quality=EpisodeQuality.good.value,
    )
    db_session.add(episode)
    db_session.commit()

    assignment = AssignmentService.assign_episode(db_session, request, episode, operator.id)

    assert assignment.request_id == request.id
    assert assignment.episode_id == episode.id


def test_bad_episode_cannot_be_assigned(client, db_session) -> None:
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )
    operator = AuthService.create_user(
        db_session,
        email="operator@example.com",
        password="StrongPass123!",
        role=UserRole.operator,
        full_name="Ops User",
    )
    request = RequestService.create_request(
        db_session,
        client_id=client_user.id,
        task_name="pick cups",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    request.status = RequestStatus.in_progress.value
    db_session.commit()
    episode = Episode(
        episode_id="EP-101",
        robot_id="arm-01",
        task_name="pick cups",
        recorded_at=datetime(2026, 9, 1, 0, 0, 0),
        duration_seconds=60,
        operator_name="Ada",
        quality=EpisodeQuality.bad.value,
    )
    db_session.add(episode)
    db_session.commit()

    try:
        AssignmentService.assign_episode(db_session, request, episode, operator.id)
        assert False
    except ValueError:
        assert True


def test_episode_cannot_be_assigned_to_a_second_request(client, db_session) -> None:
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    operator = AuthService.create_user(
        db_session,
        email="operator@example.com",
        password="StrongPass123!",
        role=UserRole.operator,
    )
    request_one = RequestService.create_request(
        db_session,
        client_id=client_user.id,
        task_name="pick cups",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    request_two = RequestService.create_request(
        db_session,
        client_id=client_user.id,
        task_name="stack blocks",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    request_one.status = RequestStatus.in_progress.value
    request_two.status = RequestStatus.in_progress.value
    episode = Episode(
        episode_id="EP-102",
        robot_id="arm-01",
        task_name="pick cups",
        recorded_at=datetime(2026, 9, 1, 0, 0, 0),
        duration_seconds=60,
        operator_name="Ada",
        quality=EpisodeQuality.usable.value,
    )
    db_session.add(episode)
    db_session.commit()

    AssignmentService.assign_episode(db_session, request_one, episode, operator.id)
    with pytest.raises(ValueError, match="already assigned"):
        AssignmentService.assign_episode(db_session, request_two, episode, operator.id)


def test_database_prevents_concurrent_duplicate_episode_assignment(client, db_session) -> None:
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    operator = AuthService.create_user(
        db_session,
        email="operator@example.com",
        password="StrongPass123!",
        role=UserRole.operator,
    )
    request_one = RequestService.create_request(
        db_session,
        client_id=client_user.id,
        task_name="pick cups",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    request_two = RequestService.create_request(
        db_session,
        client_id=client_user.id,
        task_name="stack blocks",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    episode = Episode(
        episode_id="EP-103",
        robot_id="arm-01",
        task_name="pick cups",
        recorded_at=datetime(2026, 9, 1, 0, 0, 0),
        duration_seconds=60,
        operator_name="Ada",
        quality=EpisodeQuality.good.value,
    )
    db_session.add(episode)
    db_session.commit()
    db_session.add_all(
        [
            Assignment(request_id=request_one.id, episode_id=episode.id, assigned_by=operator.id),
            Assignment(request_id=request_two.id, episode_id=episode.id, assigned_by=operator.id),
        ]
    )

    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
