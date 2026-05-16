from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# Resolve .env file relative to this config file's location (backend/.env)
_env_file = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:1234@localhost:5432/scholanexus_db"
    SECRET_KEY: str = "change-this-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    SCHOOL_NAME: str = "Mujumuzi Golden Bridge Secondary School"
    SCHOOL_ADDRESS: str = "P.O BOX 1985 Bukoba"

    class Config:
        env_file = str(_env_file)
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
