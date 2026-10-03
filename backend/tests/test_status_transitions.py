from fastapi import status

from app.models.dataset_request import RequestStatus
from app.models.user import UserRole
from app.services.auth_service import AuthService
from app.services.request_service import RequestService


def login_token(client, email: str, password: str) -> str:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    return response.json()["access_token"]


def test_client_can_create_request_and_it_starts_submitted(client, db_session) -> None:
    user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )
    token = login_token(client, "client@example.com", "StrongPass123!")

    response = client.post(
        "/api/requests",
        json={
            "task_name": "pick cups",
            "episodes_requested": 5,
            "deadline": "2026-10-02",
            "notes": "Need 5 examples",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert response.json()["status"] == RequestStatus.submitted.value
    assert response.json()["client_id"] == user.id


def test_valid_transition_succeeds(client, db_session) -> None:
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )
    AuthService.create_user(
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
        episodes_requested=2,
        deadline=None,
        notes=None,
    )
    token = login_token(client, "operator@example.com", "StrongPass123!")

    response = client.patch(
        f"/api/requests/{request.id}/status",
        json={"status": RequestStatus.in_progress.value},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["status"] == RequestStatus.in_progress.value


def test_invalid_transition_fails(client, db_session) -> None:
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )
    AuthService.create_user(
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
        episodes_requested=2,
        deadline=None,
        notes=None,
    )
    request.status = RequestStatus.submitted.value
    db_session.add(request)
    db_session.commit()
    token = login_token(client, "operator@example.com", "StrongPass123!")

    response = client.patch(
        f"/api/requests/{request.id}/status",
        json={"status": RequestStatus.accepted.value},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_delivery_requires_enough_assigned_episodes(client, db_session) -> None:
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )
    AuthService.create_user(
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
        episodes_requested=3,
        deadline=None,
        notes=None,
    )
    request.status = RequestStatus.in_progress.value
    db_session.add(request)
    db_session.commit()
    token = login_token(client, "operator@example.com", "StrongPass123!")

    response = client.patch(
        f"/api/requests/{request.id}/status",
        json={"status": RequestStatus.delivered.value},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


def test_operator_cannot_reject_a_delivered_request(client, db_session) -> None:
    client_user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )
    AuthService.create_user(
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
    request.status = RequestStatus.delivered.value
    db_session.commit()
    token = login_token(client, "operator@example.com", "StrongPass123!")

    response = client.patch(
        f"/api/requests/{request.id}/status",
        json={"status": RequestStatus.rejected.value},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
