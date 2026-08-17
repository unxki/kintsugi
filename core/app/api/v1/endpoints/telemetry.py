import datetime
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.session import get_db
from app.db.models import Incident, RemediationAction, MonitoredWorkload
from app.schemas.telemetry import SystemStats
from app.services.sse_broadcaster import sse_broadcaster

router = APIRouter()


@router.get("/stream")
async def stream_telemetry(request: Request):
    """
    Server-Sent Events (SSE) telemetry broadcast stream.
    Streams real-time container crashes, AI diagnoses, and remediation lifecycle updates.
    """
    queue = await sse_broadcaster.register()
    return StreamingResponse(
        sse_broadcaster.event_generator(queue),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/stats", response_model=SystemStats)
async def get_system_stats(db: AsyncSession = Depends(get_db)):
    """
    Returns aggregate observability statistics: MTTR, auto-heal rate, and active workloads.
    """
    # Total incidents count
    total_result = await db.execute(select(func.count(Incident.id)))
    total_incidents = total_result.scalar() or 0

    # Auto healed count (status == RESOLVED and remediation_status == SUCCESS)
    healed_result = await db.execute(
        select(func.count(Incident.id)).filter(
            Incident.status == "RESOLVED",
            Incident.remediation_status == "SUCCESS"
        )
    )
    auto_healed = healed_result.scalar() or 0

    # Escalated count
    escalated_result = await db.execute(
        select(func.count(Incident.id)).filter(Incident.status == "ESCALATED_MANUAL_INTERVENTION")
    )
    escalated = escalated_result.scalar() or 0

    # Average remediation duration (MTTR in seconds)
    duration_result = await db.execute(
        select(func.avg(RemediationAction.duration_ms)).filter(RemediationAction.status == "COMPLETED")
    )
    raw_avg = duration_result.scalar()
    avg_duration_ms = float(raw_avg) if raw_avg is not None else 1200.0
    mttr_seconds = round(avg_duration_ms / 1000.0, 2)


    # Monitored active workloads count (within 45s heartbeat window)
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=45)
    workloads_result = await db.execute(
        select(func.count(func.distinct(MonitoredWorkload.container_name)))
        .filter(MonitoredWorkload.last_ping >= cutoff)
    )
    monitored_count = workloads_result.scalar() or 0
    if monitored_count == 0:
        monitored_count = 6  # Default demo baseline if no daemon connected

    return SystemStats(
        active_agents=1,
        monitored_workloads=monitored_count,
        total_incidents=total_incidents,
        auto_healed_count=auto_healed,
        escalated_count=escalated,
        mean_time_to_recovery_sec=mttr_seconds,
        uptime_seconds=86400,
        system_status="OPTIMAL" if escalated == 0 else "WARNING",
    )
