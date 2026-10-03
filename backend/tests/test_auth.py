from datetime import datetime, timedelta, timezone

from fastapi import status
import jwt

from app.core.config import get_settings
from app.core.security import create_access_token
from app.models.auth_session import AuthSession
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
    assert isinstance(response.json()["refresh_token"], str)
    assert response.json()["expires_in"] == 15 * 60


def test_refresh_rotates_token_and_rejects_reuse(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    login_response = client.post(
        "/api/auth/login",
        json={"email": "client@example.com", "password": "StrongPass123!"},
    )
    original_refresh_token = login_response.json()["refresh_token"]

    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )

    assert refresh_response.status_code == status.HTTP_200_OK
    refreshed_tokens = refresh_response.json()
    assert refreshed_tokens["refresh_token"] != original_refresh_token
    assert client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {refreshed_tokens['access_token']}"},
    ).status_code == status.HTTP_200_OK

    reused_token_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": original_refresh_token},
    )
    assert reused_token_response.status_code == status.HTTP_401_UNAUTHORIZED


def test_logout_revokes_refresh_token(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    login_response = client.post(
        "/api/auth/login",
        json={"email": "client@example.com", "password": "StrongPass123!"},
    )
    refresh_token = login_response.json()["refresh_token"]

    logout_response = client.post(
        "/api/auth/logout",
        json={"refresh_token": refresh_token},
    )

    assert logout_response.status_code == status.HTTP_204_NO_CONTENT
    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_response.status_code == status.HTTP_401_UNAUTHORIZED


def test_refresh_rejects_inactive_user(client, db_session) -> None:
    user = AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    login_response = client.post(
        "/api/auth/login",
        json={"email": "client@example.com", "password": "StrongPass123!"},
    )
    user.is_active = False
    db_session.commit()

    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": login_response.json()["refresh_token"]},
    )

    assert refresh_response.status_code == status.HTTP_401_UNAUTHORIZED


def test_access_endpoint_rejects_refresh_type_jwt(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    refresh_type_token = jwt.encode(
        {"sub": "1", "iat": 1_700_000_000, "exp": 4_102_444_800, "token_type": "refresh"},
        get_settings().jwt_secret_key.get_secret_value(),
        algorithm="HS256",
    )

    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {refresh_type_token}"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_refresh_rejects_expired_session(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    login_response = client.post(
        "/api/auth/login",
        json={"email": "client@example.com", "password": "StrongPass123!"},
    )
    refresh_token = login_response.json()["refresh_token"]
    session = db_session.query(AuthSession).one()
    session.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
    db_session.commit()

    refresh_response = client.post(
        "/api/auth/refresh",
        json={"refresh_token": refresh_token},
    )

    assert refresh_response.status_code == status.HTTP_401_UNAUTHORIZED


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


def test_me_distinguishes_expired_and_malformed_tokens(client) -> None:
    expired = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {create_access_token('1', expires_minutes=-1)}"},
    )
    malformed = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer not-a-jwt"},
    )

    assert expired.status_code == status.HTTP_401_UNAUTHORIZED
    assert expired.json()["detail"] == "Session expired. Please sign in again."
    assert malformed.status_code == status.HTTP_401_UNAUTHORIZED
    assert malformed.json()["detail"] == "Invalid access token. Please sign in again."
