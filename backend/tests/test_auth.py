from fastapi import status

from app.core.security import hash_password
from app.models.user import UserRole
from app.services.auth_service import AuthService


def test_login_success(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        full_name="Client User",
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "client@example.com", "password": "StrongPass123!"},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["token_type"] == "bearer"
    assert isinstance(response.json()["access_token"], str)
    assert len(response.json()["access_token"]) > 20


def test_login_fails_for_inactive_user(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="inactive@example.com",
        password="StrongPass123!",
        role=UserRole.client,
        is_active=False,
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "inactive@example.com", "password": "StrongPass123!"},
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["detail"] == "Invalid email or password"


def test_me_requires_authentication(client) -> None:
    response = client.get("/api/auth/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
