from functools import lru_cache

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = (
        "postgresql+psycopg://dataset:dataset@localhost:5432/dataset_request_desk"
    )
    jwt_secret_key: SecretStr = SecretStr("development-only-change-this-secret")
    app_env: str = "development"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @model_validator(mode="after")
    def require_production_jwt_secret(self) -> "Settings":
        secret = self.jwt_secret_key.get_secret_value()
        if self.app_env.lower() not in {"development", "test"} and (
            secret == "development-only-change-this-secret"
            or secret.startswith("replace-this-")
            or len(secret) < 32
        ):
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters outside development")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
