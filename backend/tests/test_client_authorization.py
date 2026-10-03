from datetime import datetime

from fastapi import status

from auth_helpers import login_headers
from app.models.episode import Episode, EpisodeQuality
from app.models.dataset_request import RequestStatus
from app.models.status_history import StatusHistory
from app.models.user import UserRole
from app.services.auth_service import AuthService
from app.services.request_service import RequestService


def create_client(db_session, email: str):
    return AuthService.create_user(
        db_session,
        email=email,
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )


def client_headers(client, email: str) -> dict[str, str]:
    return login_headers(client, email)


def test_client_request_endpoints_require_a_token(client, db_session) -> None:
    owner = create_client(db_session, "owner@example.com")
    request = RequestService.create_request(
        db_session,
        client_id=owner.id,
        task_name="pick cups",
        episodes_requested=2,
        deadline=None,
        notes=None,
    )

    protected_calls = [
        ("get", "/api/requests"),
        ("post", "/api/requests", {"task_name": "pick cups", "episodes_requested": 1}),
        ("get", f"/api/requests/{request.id}"),
        ("patch", f"/api/requests/{request.id}", {"task_name": "pick red cups"}),
        ("delete", f"/api/requests/{request.id}"),
        ("patch", f"/api/requests/{request.id}/status", {"status": "accepted"}),
        ("get", f"/api/requests/{request.id}/episodes"),
        ("post", f"/api/requests/{request.id}/episodes", {"episode_id": 1}),
        ("get", "/api/auth/me"),
        ("get", "/api/episodes"),
        ("get", "/api/analytics"),
    ]
    for method, path, *body in protected_calls:
        response = getattr(client, method)(path, json=body[0]) if body else getattr(client, method)(path)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED, (method, path, response.text)
    import_response = client.post(
        "/api/episodes/import",
        content="episode_id,robot_id,task_name,recorded_at,duration_seconds,operator_name,quality\n",
        headers={"Content-Type": "text/csv"},
    )
    assert import_response.status_code == status.HTTP_401_UNAUTHORIZED


def test_client_can_only_read_and_mutate_their_own_requests(client, db_session) -> None:
    owner = create_client(db_session, "owner@example.com")
    other = create_client(db_session, "other@example.com")
    own_request = RequestService.create_request(
        db_session,
        client_id=owner.id,
        task_name="pick cups",
        episodes_requested=2,
        deadline=None,
        notes=None,
    )
    other_request = RequestService.create_request(
        db_session,
        client_id=other.id,
        task_name="stack blocks",
        episodes_requested=3,
        deadline=None,
        notes=None,
    )

    headers = client_headers(client, "owner@example.com")
    list_response = client.get("/api/requests", headers=headers)
    assert list_response.status_code == status.HTTP_200_OK
    assert [item["id"] for item in list_response.json()] == [own_request.id]
    assert client.get(f"/api/requests/{own_request.id}", headers=headers).status_code == status.HTTP_200_OK
    assert client.get(f"/api/requests/{own_request.id}/episodes", headers=headers).status_code == status.HTTP_403_FORBIDDEN

    own_request.status = RequestStatus.delivered.value
    db_session.commit()
    assert client.get(f"/api/requests/{own_request.id}/episodes", headers=headers).status_code == status.HTTP_200_OK

    for response in (
        client.get(f"/api/requests/{other_request.id}", headers=headers),
        client.patch(
            f"/api/requests/{other_request.id}",
            json={"task_name": "tampered"},
            headers=headers,
        ),
        client.delete(f"/api/requests/{other_request.id}", headers=headers),
    ):
        assert response.status_code == status.HTTP_403_FORBIDDEN


def test_client_can_edit_and_delete_only_submitted_requests(client, db_session) -> None:
    owner = create_client(db_session, "owner@example.com")
    submitted = RequestService.create_request(
        db_session,
        client_id=owner.id,
        task_name="pick cups",
        episodes_requested=2,
        deadline=None,
        notes=None,
    )
    active = RequestService.create_request(
        db_session,
        client_id=owner.id,
        task_name="stack blocks",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    active.status = RequestStatus.in_progress.value
    db_session.commit()

    headers = client_headers(client, "owner@example.com")
    edited = client.patch(
        f"/api/requests/{submitted.id}",
        json={"task_name": "  pick red cups  ", "episodes_requested": 4},
        headers=headers,
    )
    assert edited.status_code == status.HTTP_200_OK
    assert edited.json()["task_name"] == "pick red cups"
    assert edited.json()["episodes_requested"] == 4

    assert client.patch(
        f"/api/requests/{active.id}",
        json={"task_name": "cannot change"},
        headers=headers,
    ).status_code == status.HTTP_400_BAD_REQUEST
    assert client.patch(
        f"/api/requests/{submitted.id}",
        json={"task_name": None},
        headers=headers,
    ).status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert client.patch(
        f"/api/requests/{submitted.id}",
        json={"status": "accepted"},
        headers=headers,
    ).status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert client.delete(f"/api/requests/{active.id}", headers=headers).status_code == status.HTTP_400_BAD_REQUEST
    assert client.delete(f"/api/requests/{submitted.id}", headers=headers).status_code == status.HTTP_204_NO_CONTENT


def test_request_creation_records_submitted_history(client, db_session) -> None:
    owner = create_client(db_session, "owner@example.com")
    headers = client_headers(client, "owner@example.com")
    response = client.post(
        "/api/requests",
        json={"task_name": "pick cups", "episodes_requested": 2},
        headers=headers,
    )

    assert response.status_code == status.HTTP_201_CREATED
    history = db_session.query(StatusHistory).filter_by(request_id=response.json()["id"]).one()
    assert history.from_status is None
    assert history.to_status == RequestStatus.submitted.value
    assert history.changed_by == owner.id


def test_client_cannot_access_operations_only_endpoints(client, db_session) -> None:
    create_client(db_session, "client@example.com")
    headers = client_headers(client, "client@example.com")

    assert client.get("/api/episodes", headers=headers).status_code == status.HTTP_403_FORBIDDEN
    assert client.get("/api/analytics", headers=headers).status_code == status.HTTP_403_FORBIDDEN
    assert client.post(
        "/api/episodes/import",
        content="episode_id,robot_id,task_name,recorded_at,duration_seconds,operator_name,quality\n",
        headers={"Content-Type": "text/csv", **headers},
    ).status_code == status.HTTP_403_FORBIDDEN


def test_client_cannot_assign_episodes_or_change_operator_owned_status(client, db_session) -> None:
    owner = create_client(db_session, "client@example.com")
    request = RequestService.create_request(
        db_session,
        client_id=owner.id,
        task_name="pick cups",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    episode = Episode(
        episode_id="EP-CLIENT-AUTH",
        robot_id="arm-01",
        task_name="pick cups",
        recorded_at=datetime(2026, 10, 2, 9, 0, 0),
        duration_seconds=45,
        operator_name="Operator",
        quality=EpisodeQuality.good.value,
    )
    db_session.add(episode)
    db_session.commit()
    headers = client_headers(client, "client@example.com")

    status_update = client.patch(
        f"/api/requests/{request.id}/status",
        json={"status": RequestStatus.in_progress.value},
        headers=headers,
    )
    assignment = client.post(
        f"/api/requests/{request.id}/episodes",
        json={"episode_id": episode.id},
        headers=headers,
    )

    assert status_update.status_code == status.HTTP_403_FORBIDDEN
    assert assignment.status_code == status.HTTP_403_FORBIDDEN


def test_client_can_accept_or_reject_only_a_delivered_owned_request(client, db_session) -> None:
    owner = create_client(db_session, "owner@example.com")
    other = create_client(db_session, "other@example.com")
    delivered = RequestService.create_request(
        db_session,
        client_id=owner.id,
        task_name="pick cups",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    delivered.status = RequestStatus.delivered.value
    foreign_delivered = RequestService.create_request(
        db_session,
        client_id=other.id,
        task_name="stack blocks",
        episodes_requested=1,
        deadline=None,
        notes=None,
    )
    foreign_delivered.status = RequestStatus.delivered.value
    db_session.commit()
    headers = client_headers(client, "owner@example.com")

    accepted = client.patch(
        f"/api/requests/{delivered.id}/status",
        json={"status": RequestStatus.accepted.value},
        headers=headers,
    )
    foreign = client.patch(
        f"/api/requests/{foreign_delivered.id}/status",
        json={"status": RequestStatus.accepted.value},
        headers=headers,
    )

    assert accepted.status_code == status.HTTP_200_OK
    assert accepted.json()["status"] == RequestStatus.accepted.value
    assert foreign.status_code == status.HTTP_403_FORBIDDEN
