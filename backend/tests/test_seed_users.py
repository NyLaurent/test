import json
from pathlib import Path

from app.services.auth_service import AuthService
from app.services.seed_user_service import seed_users


def test_seed_accounts_can_login_and_are_safe_to_repeat(client, db_session) -> None:
    seed_file = Path(__file__).resolve().parents[2] / "seed" / "users.json"
    users = json.loads(seed_file.read_text(encoding="utf-8"))

    first_created = seed_users(db_session, users)
    second_created = seed_users(db_session, users)

    assert first_created == len(users)
    assert second_created == 0

    for user_data in users:
        user = AuthService.authenticate_user(
            db_session,
            user_data["email"],
            user_data["password"],
        )
        assert user is not None
        assert user.role.value == user_data["role"]

    response = client.post(
        "/api/auth/login",
        json={"email": "admin@example.com", "password": "admin123"},
    )
    assert response.status_code == 200
    assert response.json()["token_type"] == "bearer"
