from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.user import User, UserRole


def seed_users(db: Session, users: list[dict[str, str]]) -> int:
    seeded_count = 0

    for user_data in users:
        email = user_data["email"].strip().lower()
        role = UserRole(user_data["role"])
        user = db.scalar(select(User).where(User.email == email))

        if user is None:
            user = User(email=email, password_hash="", role=role)
            db.add(user)
            seeded_count += 1

        user.password_hash = hash_password(user_data["password"])
        user.role = role
        user.is_active = True
        user.full_name = user_data["name"]

    db.commit()
    return seeded_count
