import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from sqlalchemy.orm import selectinload

from app.db.session import get_db, AsyncSessionLocal
from app.db.models import Incident, IncidentLog, RemediationAction
from app.schemas.incident import (
    IncidentCreate,
    IncidentResponse,
    IncidentSummary,
    IncidentLogResponse,
)
from app.services.remediation_policy import remediation_engine

router = APIRouter()


@router.post("", response_model=IncidentResponse, status_code=201)
async def ingest_incident(
    payload: IncidentCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Ingest a new container incident payload dispatched by a Sentinel daemon.
    Triggers the asynchronous AI diagnosis and remediation lifecycle.
    """
    incident_id = payload.id or f"inc_{uuid.uuid4().hex[:10]}"

    # Create Incident Record
    incident = Incident(
        id=incident_id,
        container_id=payload.container_id,
        container_name=payload.container_name,
        image=payload.image,
        exit_code=payload.exit_code,
        termination_reason=payload.termination_reason,
        status="DETECTED",
        is_flapping=payload.is_flapping,
        restart_count=payload.restart_count,
        remediation_status="PENDING",
    )
    db.add(incident)

    # Save Sanitized Tail Log
    log_entry = IncidentLog(
        incident_id=incident_id,
        raw_tail_log=payload.raw_tail_log,
        sanitized_log=payload.sanitized_log,
    )
    db.add(log_entry)
    await db.commit()

    # Launch background lifecycle processing
    background_tasks.add_task(
        remediation_engine.process_incident_lifecycle,
        AsyncSessionLocal,
        incident_id,
    )

    # Refresh and return
    stmt = (
        select(Incident)
        .options(selectinload(Incident.logs), selectinload(Incident.remediations))
        .filter(Incident.id == incident_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("", response_model=List[IncidentSummary])
async def list_incidents(
    status: Optional[str] = None,
    limit: int = Query(100, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    List historical incidents ordered by creation time descending with full logs & remediations.
    """
    stmt = (
        select(Incident)
        .options(selectinload(Incident.logs), selectinload(Incident.remediations))
        .order_by(desc(Incident.created_at))
        .limit(limit)
    )
    if status:
        stmt = stmt.filter(Incident.status == status)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Fetch full incident details including logs and remediation history.
    """
    stmt = (
        select(Incident)
        .options(selectinload(Incident.logs), selectinload(Incident.remediations))
        .filter(Incident.id == incident_id)
    )
    result = await db.execute(stmt)
    incident = result.scalar_one_or_none()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.delete("/clear")
async def clear_all_incidents(db: AsyncSession = Depends(get_db)):
    """
    Purge incident history for testing and clean slate demos.
    """
    from app.db.models import IncidentEmbedding
    await db.execute(delete(IncidentLog))
    await db.execute(delete(IncidentEmbedding))
    await db.execute(delete(RemediationAction))
    await db.execute(delete(Incident))
    await db.commit()
    return {"status": "CLEARED", "message": "All incident history purged."}

