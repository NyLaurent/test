from datetime import datetime

from auth_helpers import stable_access_token

from app.models.dataset_request import DatasetRequest, RequestStatus
from app.models.episode import Episode, EpisodeQuality
from app.models.status_history import StatusHistory
from app.models.user import UserRole
from app.services.auth_service import AuthService


def test_analytics_returns_basic_metrics(client, db_session) -> None:
    operator = AuthService.create_user(
        db_session,
        email="operator@example.com",
        password="StrongPass123!",
        role=UserRole.operator,
        full_name="Ops User",
    )
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )

    request = DatasetRequest(
        client_id=client_user.id,
        task_name="pick cups",
        episodes_requested=2,
        deadline=None,
        notes=None,
        status=RequestStatus.submitted.value,
    )
    request.created_at = datetime(2026, 9, 1, 8, 0, 0)
    db_session.add(request)
    db_session.commit()
    db_session.refresh(request)

    db_session.add_all([
        StatusHistory(
            request_id=request.id,
            from_status=None,
            to_status=RequestStatus.submitted.value,
            changed_by=client_user.id,
            changed_at=datetime(2026, 9, 1, 8, 0, 0),
        ),
        StatusHistory(
            request_id=request.id,
            from_status=RequestStatus.in_progress.value,
            to_status=RequestStatus.delivered.value,
            changed_by=operator.id,
            changed_at=datetime(2026, 9, 1, 9, 0, 0),
        ),
    ])

    db_session.add(
        Episode(
            episode_id="EP-200",
            robot_id="arm-01",
            task_name="pick cups",
            recorded_at=datetime(2026, 9, 1, 9, 0, 0),
            duration_seconds=42,
            operator_name="Ada",
            quality=EpisodeQuality.good.value,
        )
    )
    db_session.add(
        Episode(
            episode_id="EP-201",
            robot_id="arm-02",
            task_name="pick cups",
            recorded_at=datetime(2026, 9, 2, 9, 0, 0),
            duration_seconds=24,
            operator_name="Lin",
            quality=EpisodeQuality.good.value,
        )
    )
    db_session.commit()

    token = client.post(
        "/api/auth/login",
        json={"email": "operator@example.com", "password": "StrongPass123!"},
    ).json()["access_token"]
    token = stable_access_token(token)

    response = client.get(
        "/api/analytics?start_date=2026-09-01&end_date=2026-09-03",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200
    assert response.json()["request_fulfilment"][0]["status"] == RequestStatus.submitted.value
    assert response.json()["top_good_tasks"][0]["task_name"] == "pick cups"
