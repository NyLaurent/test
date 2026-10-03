from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.user import User, UserRole
from app.schemas.admin_user import AdminUserCreate, AdminUserRead, AdminUserUpdate

router = APIRouter(
    prefix="/admin/users",
    tags=["admin"],
    dependencies=[Depends(require_roles(UserRole.admin.value))],
)


@router.get("", response_model=list[AdminUserRead])
def list_users(db: Session = Depends(get_db)) -> list[User]:
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("", response_model=AdminUserRead, status_code=status.HTTP_201_CREATED)
def create_user(payload: AdminUserCreate, db: Session = Depends(get_db)) -> User:
    user = User(
        email=str(payload.email).strip().lower(),
        password_hash=hash_password(payload.password),
        role=payload.role,
        is_active=True,
        full_name=payload.full_name.strip() if payload.full_name else None,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists",
        ) from exc
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=AdminUserRead)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    current_user: User = Depends(require_roles(UserRole.admin.value)),
    db: Session = Depends(get_db),
) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if user.id == current_user.id and (
        payload.is_active is False
        or (payload.role is not None and payload.role != UserRole.admin)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate or demote your own account",
        )
    if (
        user.is_active
        and user.role == UserRole.admin
        and (payload.is_active is False or (payload.role is not None and payload.role != UserRole.admin))
    ):
        active_admin_count = db.scalar(
            select(func.count(User.id)).where(
                User.role == UserRole.admin,
                User.is_active.is_(True),
            )
        )
        if active_admin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one active admin account must remain",
            )
    if payload.role is not None:
        user.role = payload.role
    if payload.is_active is not None:
        user.is_active = payload.is_active
    if "full_name" in payload.model_fields_set:
        user.full_name = payload.full_name.strip() if payload.full_name else None
    db.commit()
    db.refresh(user)
    return user
