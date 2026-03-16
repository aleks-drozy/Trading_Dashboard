from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    admin_email: str
    admin_password_hash: str
    secret_key: str
    database_url: str = "sqlite:///./trading.db"

    model_config = SettingsConfigDict(env_file=".env")


@lru_cache
def get_settings() -> Settings:
    return Settings()
