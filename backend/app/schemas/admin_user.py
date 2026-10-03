from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.models.user import UserRole


class AdminUserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12)
    role: UserRole
    full_name: str | None = Field(default=None, max_length=255)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email(cls, value: object) -> object:
        return value.strip().lower() if isinstance(value, str) else value

    @field_validator("password")
    @classmethod
    def limit_bcrypt_password_length(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 bytes")
        return value


class AdminUserUpdate(BaseModel):
    role: UserRole | None = None
    is_active: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def require_update(self) -> "AdminUserUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one user field must be provided")
        if "role" in self.model_fields_set and self.role is None:
            raise ValueError("Role cannot be null")
        if "is_active" in self.model_fields_set and self.is_active is None:
            raise ValueError("is_active cannot be null")
        return self


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str | None
    role: UserRole
    is_active: bool
