import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
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

            # Ensure column migrations for existing tables
            if "postgres" in settings.DATABASE_URL:
                try:
                    await conn.execute(text("ALTER TABLE system_configuration ADD COLUMN IF NOT EXISTS custom_base_url VARCHAR(512)"))
                except Exception as e:
                    logger.warning(f"Migration notice: {e}")

        logger.info("Database schemas verified.")
    except Exception as err:
        logger.error(f"Database initialization error (continuing startup): {err}")

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

# Include v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/healthz")
async def healthz():
    return {
        "status": "healthy",
        "service": "kintsugi-core",
        "version": settings.VERSION
    }
