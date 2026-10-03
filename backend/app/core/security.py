from datetime import datetime, timedelta, timezone
import hashlib
import secrets

import jwt
from passlib.context import CryptContext

from app.core.config import get_settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 14


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(
    subject: str,
    expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES,
    *,
    now: datetime | None = None,
) -> str:
    issued_at = now or datetime.now(timezone.utc)
    if issued_at.tzinfo is None:
        issued_at = issued_at.replace(tzinfo=timezone.utc)
    expires_at = issued_at + timedelta(minutes=expires_minutes)
    payload = {
        "sub": subject,
        "iat": issued_at,
        "exp": expires_at,
        "token_type": "access",
    }
    return jwt.encode(payload, get_settings().jwt_secret_key.get_secret_value(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(
        token,
        get_settings().jwt_secret_key.get_secret_value(),
        algorithms=[ALGORITHM],
        options={"require": ["sub", "iat", "exp"]},
    )


def create_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
