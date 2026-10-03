from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.security import (
    REFRESH_TOKEN_EXPIRE_DAYS,
    create_refresh_token,
    hash_refresh_token,
)
from app.models.auth_session import AuthSession
from app.models.user import User


class AuthSessionService:
    @staticmethod
    def create_session(db: Session, user: User) -> str:
        raw_token = create_refresh_token()
        now = datetime.now(timezone.utc)
        db.add(
            AuthSession(
                user_id=user.id,
                refresh_token_hash=hash_refresh_token(raw_token),
                expires_at=now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            )
        )
        db.commit()
        return raw_token

    @staticmethod
    def rotate_refresh_token(db: Session, raw_token: str) -> tuple[User, str] | None:
        now = datetime.now(timezone.utc)
        token_hash = hash_refresh_token(raw_token)
        session = db.scalar(
            select(AuthSession).where(AuthSession.refresh_token_hash == token_hash)
        )
        if session is None or session.revoked_at is not None:
            return None

        expires_at = session.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= now:
            db.execute(
                update(AuthSession)
                .where(AuthSession.id == session.id, AuthSession.revoked_at.is_(None))
                .values(revoked_at=now)
            )
            db.commit()
            return None

        user = db.get(User, session.user_id)
        if user is None or not user.is_active:
            db.execute(
                update(AuthSession)
                .where(AuthSession.id == session.id, AuthSession.revoked_at.is_(None))
                .values(revoked_at=now)
            )
            db.commit()
            return None

        revoked = db.execute(
            update(AuthSession)
            .where(
                AuthSession.id == session.id,
                AuthSession.revoked_at.is_(None),
                AuthSession.expires_at > now,
            )
            .values(revoked_at=now)
            .execution_options(synchronize_session=False)
        )
        if revoked.rowcount != 1:
            db.rollback()
            return None

        replacement_token = create_refresh_token()
        db.add(
            AuthSession(
                user_id=user.id,
                refresh_token_hash=hash_refresh_token(replacement_token),
                expires_at=now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            )
        )
        db.commit()
        return user, replacement_token

    @staticmethod
    def revoke_refresh_token(db: Session, raw_token: str | None) -> None:
        if not raw_token:
            return
        db.execute(
            update(AuthSession)
            .where(
                AuthSession.refresh_token_hash == hash_refresh_token(raw_token),
                AuthSession.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(timezone.utc))
        )
        db.commit()
