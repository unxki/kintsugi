from fastapi import APIRouter
from app.api.v1.endpoints import incidents, telemetry, containers, actions, config

api_router = APIRouter()

api_router.include_router(incidents.router, prefix="/incidents", tags=["incidents"])
api_router.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"])
api_router.include_router(containers.router, prefix="/containers", tags=["containers"])
api_router.include_router(actions.router, prefix="/actions", tags=["actions"])
api_router.include_router(config.router, prefix="/config", tags=["config"])

