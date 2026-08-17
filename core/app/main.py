import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from app.config import settings
from app.api.v1.router import api_router
from app.db.session import engine, Base
import app.db.models  # Ensure models are imported

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("kintsugi.core")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing Kintsugi Core Database & Engine...")
    try:
        async with engine.begin() as conn:
            if "postgres" in settings.DATABASE_URL:
                try:
                    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
                    logger.info("pgvector extension enabled.")
                except Exception as e:
                    logger.warning(f"Could not enable pgvector extension automatically: {e}")
            # Create tables if not existing
            await conn.run_sync(Base.metadata.create_all)

            # Ensure all column migrations exist for system_configuration on PostgreSQL
            if "postgres" in settings.DATABASE_URL:
                migrations = [
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS custom_base_url VARCHAR(512)",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS openrouter_api_key VARCHAR(255)",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS gemini_api_key VARCHAR(255)",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS openai_api_key VARCHAR(255)",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS anthropic_api_key VARCHAR(255)",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS local_llm_endpoint VARCHAR(255) DEFAULT 'http://localhost:11434/v1'",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS operating_mode VARCHAR(32) DEFAULT 'ACTIVE'",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS similarity_threshold FLOAT DEFAULT 0.85",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS confidence_threshold FLOAT DEFAULT 0.75",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS flap_threshold INTEGER DEFAULT 3",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS flap_window_seconds INTEGER DEFAULT 60",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS log_tail_lines INTEGER DEFAULT 100",
                    "ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS auto_heal_timeout_ms INTEGER DEFAULT 5000",
                ]
                for mig in migrations:
                    try:
                        await conn.execute(text(mig))
                    except Exception as e:
                        logger.warning(f"Migration notice ({mig}): {e}")

        logger.info("Database schemas verified.")
    except Exception as err:
        logger.error(f"Database initialization error (continuing startup): {err}", exc_info=True)

    yield
    logger.info("Shutting down Kintsugi Core Engine...")
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

# CORS Configuration for Console
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__, "path": request.url.path},
    )


# Include v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/healthz")
async def healthz():
    return {
        "status": "healthy",
        "service": "kintsugi-core",
        "version": settings.VERSION
    }
