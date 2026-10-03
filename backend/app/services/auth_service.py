from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.user import User, UserRole

# Used to keep unknown-user and inactive-user login attempts close to password-check cost.
DUMMY_PASSWORD_HASH = hash_password("invalid-login-placeholder")


class AuthService:
    @staticmethod
    def get_user_by_email(db: Session, email: str) -> User | None:
        return db.scalar(select(User).where(User.email == email))

    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> User | None:
        user = AuthService.get_user_by_email(db, email.strip().lower())
        if not user or not user.is_active:
            verify_password(password, DUMMY_PASSWORD_HASH)
            return None
        if not verify_password(password, user.password_hash):
            return None
        return user

    @staticmethod
    def create_user(
        db: Session,
        *,
        email: str,
        password: str,
        role: str | UserRole = UserRole.client,
        is_active: bool = True,
        full_name: str | None = None,
    ) -> User:
        user = User(
            email=email.strip().lower(),
            password_hash=hash_password(password),
            role=UserRole(role) if isinstance(role, str) else role,
            is_active=is_active,
            full_name=full_name,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
