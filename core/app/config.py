import os
from typing import List, Optional
from pydantic import ConfigDict
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    model_config = ConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Kintsugi Core"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Database Settings
    # Supports postgresql+asyncpg:// for pgvector or sqlite+aiosqlite:/// fallback
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "sqlite+aiosqlite:///./kintsugi.db"
    )
    
    # Vector Configuration
    EMBEDDING_DIMENSION: int = 384
    
    # LLM Settings
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "heuristic")  # "openai", "gemini", "anthropic", "heuristic"
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", None)
    GEMINI_API_KEY: Optional[str] = os.getenv("GEMINI_API_KEY", None)
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY", None)
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gpt-4o-mini")
    
    # Sentinel Agent Communication
    SENTINEL_ENDPOINT: str = os.getenv("SENTINEL_ENDPOINT", "http://localhost:8081")
    
    # Sentinel Guardrails
    FLAP_THRESHOLD: int = int(os.getenv("FLAP_THRESHOLD", "3"))
    FLAP_WINDOW_SECONDS: int = int(os.getenv("FLAP_WINDOW_SECONDS", "60"))
    LOG_TAIL_LINES: int = int(os.getenv("LOG_TAIL_LINES", "100"))

    # CORS
    CORS_ORIGINS: List[str] = ["*"]


settings = Settings()

