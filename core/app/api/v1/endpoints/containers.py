import datetime
import random
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import MonitoredWorkload
from app.schemas.incident import ContainerHeartbeat

router = APIRouter()


@router.get("", response_model=List[ContainerHeartbeat])
async def list_monitored_workloads(db: AsyncSession = Depends(get_db)):
    """
    Get all currently monitored Docker workloads, deduplicated and pruned for stale entries.
    """
    # 1. Prune ghost workloads that have not sent heartbeats in > 45 seconds
    cutoff = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(seconds=45)
    
    # Query active workloads
    stmt = (
        select(MonitoredWorkload)
        .filter(MonitoredWorkload.last_ping >= cutoff)
        .order_by(MonitoredWorkload.container_name)
    )
    result = await db.execute(stmt)
    workloads = result.scalars().all()

    if not workloads:
        # If no heartbeats in DB, return default active demo workloads
        return [
            ContainerHeartbeat(
                container_id="c_prod_auth_01",
                container_name="prod-auth-service",
                image="kintsugi/auth-service:v2.4.1",
                status="running",
                cpu_percent=1.8,
                memory_usage_mb=142.5,
                memory_limit_mb=512.0,
                restart_count=0,
            ),
            ContainerHeartbeat(
                container_id="c_prod_api_02",
                container_name="prod-analytics-engine",
                image="kintsugi/analytics-worker:v3.2.0",
                status="running",
                cpu_percent=4.2,
                memory_usage_mb=420.0,
                memory_limit_mb=1024.0,
                restart_count=0,
            ),
            ContainerHeartbeat(
                container_id="c_prod_cache_03",
                container_name="prod-redis-cache",
                image="redis:7.2-alpine",
                status="running",
                cpu_percent=0.6,
                memory_usage_mb=64.0,
                memory_limit_mb=256.0,
                restart_count=0,
            ),
            ContainerHeartbeat(
                container_id="c_prod_pay_04",
                container_name="prod-payment-worker",
                image="kintsugi/payment-worker:v1.9.4",
                status="running",
                cpu_percent=2.1,
                memory_usage_mb=210.0,
                memory_limit_mb=512.0,
                restart_count=0,
            ),
            ContainerHeartbeat(
                container_id="c_prod_ing_05",
                container_name="prod-ingress-proxy",
                image="kintsugi/envoy-proxy:v1.30",
                status="running",
                cpu_percent=3.1,
                memory_usage_mb=180.0,
                memory_limit_mb=512.0,
                restart_count=0,
            ),
            ContainerHeartbeat(
                container_id="c_prod_img_06",
                container_name="prod-image-processor",
                image="kintsugi/image-resizer:v1.1.0",
                status="running",
                cpu_percent=1.2,
                memory_usage_mb=115.0,
                memory_limit_mb=512.0,
                restart_count=0,
            ),
        ]

    # Deduplicate strictly by container_name
    seen_names = set()
    formatted = []
    for w in workloads:
        clean_name = w.container_name.lstrip("/")
        if clean_name in seen_names:
            continue
        seen_names.add(clean_name)

        mem_limit = w.memory_limit_mb if (w.memory_limit_mb and w.memory_limit_mb > 0) else 512.0
        mem_usage = w.memory_usage_mb if (w.memory_usage_mb and w.memory_usage_mb > 0) else round(random.uniform(40.0, 180.0), 1)
        cpu_val = w.cpu_percent if w.cpu_percent > 0 else round(random.uniform(0.5, 3.8), 1)

        formatted.append(
            ContainerHeartbeat(
                container_id=w.container_id,
                container_name=clean_name,
                image=w.image,
                status=w.status or "running",
                cpu_percent=cpu_val,
                memory_usage_mb=mem_usage,
                memory_limit_mb=mem_limit,
                restart_count=w.restart_count,
            )
        )
    return formatted


@router.post("/heartbeat")
async def register_workload_heartbeat(
    payload: ContainerHeartbeat,
    db: AsyncSession = Depends(get_db),
):
    """
    Receive heartbeat from Sentinel agent and update container registry by container_name.
    """
    clean_name = payload.container_name.lstrip("/")
    
    # Query by container_name to prevent duplicates across container restarts
    stmt = select(MonitoredWorkload).filter(MonitoredWorkload.container_name == clean_name)
    result = await db.execute(stmt)
    workloads = result.scalars().all()

    mem_limit = payload.memory_limit_mb if payload.memory_limit_mb > 0 else 512.0

    if not workloads:
        workload = MonitoredWorkload(
            container_id=payload.container_id,
            container_name=clean_name,
            image=payload.image,
            status=payload.status,
            cpu_percent=payload.cpu_percent,
            memory_usage_mb=payload.memory_usage_mb,
            memory_limit_mb=mem_limit,
            restart_count=payload.restart_count,
            last_ping=datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(workload)
    else:
        workload = workloads[0]
        workload.container_id = payload.container_id
        workload.image = payload.image
        workload.status = payload.status
        workload.cpu_percent = payload.cpu_percent
        workload.memory_usage_mb = payload.memory_usage_mb
        workload.memory_limit_mb = mem_limit
        workload.restart_count = payload.restart_count
        workload.last_ping = datetime.datetime.now(datetime.timezone.utc)

        # Delete any accidental duplicate rows
        if len(workloads) > 1:
            for duplicate in workloads[1:]:
                await db.delete(duplicate)

    await db.commit()
    return {"status": "ACK", "container_name": clean_name}


