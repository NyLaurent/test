from fastapi import status

from app.models.user import UserRole
from app.services.auth_service import AuthService


def login_headers(client, email: str, password: str = "StrongPass123!") -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == status.HTTP_200_OK
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_admin_can_create_update_and_deactivate_users(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="admin@example.com",
        password="StrongPass123!",
        role=UserRole.admin,
    )
    AuthService.create_user(
        db_session,
        email="operator@example.com",
        password="StrongPass123!",
        role=UserRole.operator,
    )
    admin_headers = login_headers(client, "admin@example.com")
    operator_headers = login_headers(client, "operator@example.com")

    denied = client.get("/api/admin/users", headers=operator_headers)
    created = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "email": "  CLIENT@EXAMPLE.COM ",
            "password": "StrongPass123!",
            "role": "client",
            "full_name": "Example Client",
        },
    )
    duplicate = client.post(
        "/api/admin/users",
        headers=admin_headers,
        json={
            "email": "client@example.com",
            "password": "StrongPass123!",
            "role": "client",
        },
    )

    assert denied.status_code == status.HTTP_403_FORBIDDEN
    assert created.status_code == status.HTTP_201_CREATED
    assert created.json()["email"] == "client@example.com"
    assert created.json()["role"] == "client"
    assert duplicate.status_code == status.HTTP_409_CONFLICT

    user_id = created.json()["id"]
    role_updated = client.patch(
        f"/api/admin/users/{user_id}",
        headers=admin_headers,
        json={"role": "operator"},
    )
    deactivated = client.patch(
        f"/api/admin/users/{user_id}",
        headers=admin_headers,
        json={"is_active": False},
    )
    inactive_login = client.post(
        "/api/auth/login",
        json={"email": "client@example.com", "password": "StrongPass123!"},
    )

    assert role_updated.status_code == status.HTTP_200_OK
    assert role_updated.json()["role"] == "operator"
    assert deactivated.status_code == status.HTTP_200_OK
    assert deactivated.json()["is_active"] is False
    assert inactive_login.status_code == status.HTTP_401_UNAUTHORIZED


def test_admin_cannot_demote_or_deactivate_the_last_admin(client, db_session) -> None:
    admin = AuthService.create_user(
        db_session,
        email="admin@example.com",
        password="StrongPass123!",
        role=UserRole.admin,
    )
    headers = login_headers(client, "admin@example.com")

    deactivated = client.patch(
        f"/api/admin/users/{admin.id}",
        headers=headers,
        json={"is_active": False},
    )
    demoted = client.patch(
        f"/api/admin/users/{admin.id}",
        headers=headers,
        json={"role": "operator"},
    )

    assert deactivated.status_code == status.HTTP_400_BAD_REQUEST
    assert demoted.status_code == status.HTTP_400_BAD_REQUEST


def test_admin_user_create_and_update_require_admin_role(client, db_session) -> None:
    AuthService.create_user(
        db_session,
        email="client@example.com",
        password="StrongPass123!",
        role=UserRole.client,
    )
    headers = login_headers(client, "client@example.com")

    listing = client.get("/api/admin/users", headers=headers)
    create = client.post(
        "/api/admin/users",
        headers=headers,
        json={
            "email": "other@example.com",
            "password": "StrongPass123!",
            "role": "client",
        },
    )
    unauthenticated = client.get("/api/admin/users")

    assert listing.status_code == status.HTTP_403_FORBIDDEN
    assert create.status_code == status.HTTP_403_FORBIDDEN
    assert unauthenticated.status_code == status.HTTP_401_UNAUTHORIZED
