from datetime import datetime

from app.models.episode import Episode, EpisodeQuality
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
