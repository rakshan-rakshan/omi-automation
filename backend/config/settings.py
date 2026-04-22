"""Application settings loaded from environment / .env file."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, field_validator


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(
        default="postgresql+asyncpg://omited:omited@localhost:5432/omited",
        alias="DATABASE_URL",
    )

    @field_validator("database_url", mode="before")
    @classmethod
    def fix_db_url(cls, v: object) -> object:
        """Railway / Heroku use postgres:// or postgresql:// — asyncpg needs postgresql+asyncpg://"""
        if isinstance(v, str):
            if v.startswith("postgres://"):
                return "postgresql+asyncpg://" + v[len("postgres://"):]
            if v.startswith("postgresql://"):
                return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    openrouter_api_key: str = Field(default="", alias="OPENROUTER_API_KEY")
    anthropic_api_key: str = Field(default="", alias="ANTHROPIC_API_KEY")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    google_api_key: str = Field(default="", alias="GOOGLE_API_KEY")

    model_best: str = Field(default="anthropic/claude-opus-4-7", alias="MODEL_BEST")
    model_good: str = Field(default="anthropic/claude-sonnet-4-6", alias="MODEL_GOOD")
    model_cheap: str = Field(default="anthropic/claude-haiku-4-5", alias="MODEL_CHEAP")

    host: str = Field(default="0.0.0.0", alias="HOST")
    port: int = Field(default=8000, alias="PORT")
    debug: bool = Field(default=False, alias="DEBUG")
    cors_origins: list[str] = Field(default=["*"], alias="CORS_ORIGINS")

    youtube_rate_limit: int = Field(default=10, alias="YOUTUBE_RATE_LIMIT")
    ingest_concurrency: int = Field(default=5, alias="INGEST_CONCURRENCY")


settings = Settings()
