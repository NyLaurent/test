from fastapi import status

from app.core.security import create_access_token, hash_password
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


def test_login_normalizes_email_address(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )

    response = client.post(
        "/api/auth/login",
        json={"email": "  CLIENT@EXAMPLE.COM ", "password": "StrongPass123!"},
    )

    assert response.status_code == status.HTTP_200_OK


def test_login_rejects_invalid_email_and_oversized_bcrypt_password(client) -> None:
    invalid_email = client.post(
        "/api/auth/login",
        json={"email": "not-an-email", "password": "StrongPass123!"},
    )
    oversized_password = client.post(
        "/api/auth/login",
        json={"email": "client@example.com", "password": "x" * 73},
    )

    assert invalid_email.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT
    assert oversized_password.status_code == status.HTTP_422_UNPROCESSABLE_CONTENT


def test_me_rejects_a_signed_token_with_invalid_subject(client) -> None:
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {create_access_token('not-a-user-id')}"},
    )

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
