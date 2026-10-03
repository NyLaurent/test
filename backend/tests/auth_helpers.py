"""Helpers for authorization tests that should not depend on the host clock."""

import jwt

from app.core.config import get_settings


def stable_access_token(token_from_login: str) -> str:
    """Re-sign a successful login identity with fixed test-only time claims.

    Token expiry and refresh behavior are exercised in test_auth.py. These
    stable claims keep multi-request role/ownership tests deterministic when
    the test runner's wall clock jumps during a suite.
    """
    payload = jwt.decode(
        token_from_login,
        algorithms=["HS256"],
        options={"verify_signature": False, "verify_exp": False, "verify_iat": False},
    )
    stable_payload = {
        "sub": payload["sub"],
        "iat": 0,
        "exp": 4_102_444_800,
        "token_type": "access",
    }
    return jwt.encode(
        stable_payload,
        get_settings().jwt_secret_key.get_secret_value(),
        algorithm="HS256",
    )


def login_headers(client, email: str, password: str = "StrongPass123!") -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    access_token = stable_access_token(response.json()["access_token"])
    return {"Authorization": f"Bearer {access_token}"}
