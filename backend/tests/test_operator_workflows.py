from datetime import datetime

from fastapi import status

from app.models.episode import Episode, EpisodeQuality
from app.models.assignment import Assignment
from app.models.status_history import StatusHistory
from app.models.user import UserRole
from app.services.auth_service import AuthService
from app.services.request_service import RequestService


def login_headers(client, email: str, password: str = "StrongPass123!") -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == status.HTTP_200_OK
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_operator_can_view_all_requests_and_filter_episode_inventory(client, db_session) -> None:
    client_a = AuthService.create_user(
        db_session,
        email="client-a@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    client_b = AuthService.create_user(
        db_session,
        email="client-b@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    operator = AuthService.create_user(
        db_session,
        email="operator@example.com",
        password="StrongPass123!",
        role=UserRole.operator,
    )
    request_a = RequestService.create_request(
        db_session,
        client_id=client_a.id,
        task_name="pick red cup",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    request_b = RequestService.create_request(
        db_session,
        client_id=client_b.id,
        task_name="stack blocks",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    assigned_episode = Episode(
        episode_id="EP-OP-1",
        robot_id="arm-01",
        task_name="pick red cup",
        recorded_at=datetime(2026, 9, 1, 9, 0),
        duration_seconds=20,
        operator_name="Ada",
        quality=EpisodeQuality.good.value,
    )
    db_session.add_all(
        [
            assigned_episode,
            Episode(
                episode_id="EP-OP-2",
                robot_id="arm-02",
                task_name="stack blocks",
                recorded_at=datetime(2026, 9, 2, 9, 0),
                duration_seconds=30,
                operator_name="Lin",
                quality=EpisodeQuality.bad.value,
            ),
        ]
    )
    db_session.flush()
    db_session.add(
        Assignment(
            request_id=request_a.id,
            episode_id=assigned_episode.id,
            assigned_by=operator.id,
        )
    )
    db_session.commit()
    headers = login_headers(client, "operator@example.com")

    requests_response = client.get("/api/requests", headers=headers)
    filtered_response = client.get(
        "/api/episodes?task_name=RED%20cup&quality=good",
        headers=headers,
    )
    available_response = client.get("/api/episodes?available_only=true", headers=headers)
    assert requests_response.status_code == status.HTTP_200_OK
    assert {item["id"] for item in requests_response.json()} == {request_a.id, request_b.id}
    assert filtered_response.status_code == status.HTTP_200_OK
    assert [item["episode_id"] for item in filtered_response.json()] == ["EP-OP-1"]
    assert available_response.status_code == status.HTTP_200_OK
    assert available_response.json() == []


def test_operator_endpoint_authorization_for_import_inventory_and_analytics(client, db_session) -> None:
    AuthService.create_user(
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
    client_headers = login_headers(client, "client@example.com")
    operator_headers = login_headers(client, "operator@example.com")
    csv_text = "episode_id,robot_id,task_name,recorded_at,duration_seconds,operator_name,quality\n"

    for path in ("/api/episodes", "/api/analytics"):
        assert client.get(path, headers=client_headers).status_code == status.HTTP_403_FORBIDDEN
        assert client.get(path, headers=operator_headers).status_code == status.HTTP_200_OK
    assert client.post(
        "/api/episodes/import",
        content=csv_text,
        headers={"Content-Type": "text/csv", **client_headers},
    ).status_code == status.HTTP_403_FORBIDDEN
    assert client.post(
        "/api/episodes/import",
        content=csv_text,
        headers={"Content-Type": "text/csv", **operator_headers},
    ).status_code == status.HTTP_200_OK


def test_operator_owns_workflow_steps_and_status_history(client, db_session) -> None:
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    AuthService.create_user(
        db_session,
        email="operator@example.com",
        password="StrongPass123!",
        role=UserRole.operator,
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
        episode_id="EP-OP-3",
        robot_id="arm-01",
        task_name="pick cups",
        recorded_at=datetime(2026, 9, 1, 9, 0),
        duration_seconds=25,
        operator_name="Ada",
        quality=EpisodeQuality.good.value,
    )
    db_session.add(episode)
    db_session.commit()
    headers = login_headers(client, "operator@example.com")

    started = client.patch(
        f"/api/requests/{request.id}/status",
        json={"status": "in_progress"},
        headers=headers,
    )
    assigned = client.post(
        f"/api/requests/{request.id}/episodes",
        json={"episode_id": episode.id},
        headers=headers,
    )
    delivered = client.patch(
        f"/api/requests/{request.id}/status",
        json={"status": "delivered"},
        headers=headers,
    )
    history = (
        db_session.query(StatusHistory)
        .filter_by(request_id=request.id)
        .order_by(StatusHistory.id)
        .all()
    )

    assert started.status_code == status.HTTP_200_OK
    assert assigned.status_code == status.HTTP_201_CREATED
    assert delivered.status_code == status.HTTP_200_OK
    assert [item.to_status for item in history] == ["submitted", "in_progress", "delivered"]
    assert history[1].changed_by == history[2].changed_by


def test_analytics_date_range_applies_to_all_metrics(client, db_session) -> None:
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
    included = RequestService.create_request(
        db_session,
        client_id=client_user.id,
        task_name="in-range request",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    included.created_at = datetime(2026, 9, 10, 8, 0)
    outside = RequestService.create_request(
        db_session,
        client_id=client_user.id,
        task_name="out-of-range request",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    outside.created_at = datetime(2026, 9, 20, 8, 0)
    outside.status = "accepted"
    db_session.add_all(
        [
            StatusHistory(
                request_id=included.id,
                from_status="in_progress",
                to_status="delivered",
                changed_by=operator.id,
                changed_at=datetime(2026, 9, 10, 10, 0),
            ),
            Episode(
                episode_id="EP-IN-RANGE",
                robot_id="arm-01",
                task_name="in-range task",
                recorded_at=datetime(2026, 9, 10, 9, 0),
                duration_seconds=20,
                operator_name="Ada",
                quality=EpisodeQuality.good.value,
            ),
            Episode(
                episode_id="EP-OUT-RANGE",
                robot_id="arm-01",
                task_name="out-of-range task",
                recorded_at=datetime(2026, 9, 20, 9, 0),
                duration_seconds=20,
                operator_name="Ada",
                quality=EpisodeQuality.good.value,
            ),
        ]
    )
    db_session.commit()
    headers = login_headers(client, "operator@example.com")

    response = client.get(
        "/api/analytics?start_date=2026-09-10&end_date=2026-09-10",
        headers=headers,
    )
    reversed_range = client.get(
        "/api/analytics?start_date=2026-09-11&end_date=2026-09-10",
        headers=headers,
    )

    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    assert body["request_fulfilment"] == [{"status": "submitted", "request_count": 1}]
    assert body["top_good_tasks"] == [{"task_name": "in-range task", "good_episode_count": 1}]
    assert body["median_delivery_seconds"] == 7200
    assert reversed_range.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
