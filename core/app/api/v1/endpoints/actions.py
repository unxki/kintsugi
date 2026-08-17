import time
import uuid
import datetime
from collections import deque
from datetime import timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func, delete


from app.db.session import get_db, AsyncSessionLocal
from app.db.models import Incident, IncidentLog
from app.services.remediation_policy import remediation_engine

router = APIRouter()

# Resource Protection: Sliding window rate limiter for chaos simulations
# Max 6 simulations per 10 seconds across the cluster to protect lightweight VM
_CHAOS_WINDOW_SECONDS = 10.0
_MAX_CHAOS_PER_WINDOW = 6
_chaos_timestamps: deque = deque()

# Maximum stored incidents before pruning oldest resolved ones
_MAX_STORED_INCIDENTS = 60


class ManualRemediateRequest(BaseModel):
    incident_id: str
    action: str  # RESTART_CONTAINER, PRUNE_VOLUMES, STOP_RUNAWAY, ROLLBACK
    parameters: Optional[Dict[str, Any]] = None


class ChaosSimulationRequest(BaseModel):
    scenario: str = "oom"  # oom, panic, segfault, flapping, port_conflict
    container_name: Optional[str] = None


@router.post("/remediate")
async def trigger_manual_remediation(
    payload: ManualRemediateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Manually trigger an operator-approved remediation action.
    """
    incident = await db.get(Incident, payload.incident_id)
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    background_tasks.add_task(
        remediation_engine.execute_manual_override,
        AsyncSessionLocal,
        incident.id,
        payload.action,
        payload.parameters,
    )
    return {
        "status": "DISPATCHED",
        "incident_id": incident.id,
        "action": payload.action,
        "message": f"Manual remediation '{payload.action}' dispatched to Sentinel daemon."
    }


@router.post("/remediate-all")
@router.post("/batch-remediate")
async def trigger_batch_remediation(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Operator action: auto-heal all currently unresolved (flapping/escalated/pending) incidents.
    """
    stmt = select(Incident).filter(
        or_(
            Incident.status != "RESOLVED",
            Incident.remediation_status != "SUCCESS",
        )
    )
    result = await db.execute(stmt)
    unresolved = result.scalars().all()

    if not unresolved:
        return {
            "status": "NO_OP",
            "count": 0,
            "message": "All workloads healthy. No unresolved incidents to remediate."
        }

    dispatched_ids = []
    for inc in unresolved:
        action = inc.action_taken or inc.remediation_proposal or "RESTART_CONTAINER"
        if action == "ESCALATE_MANUAL" or not action:
            action = "RESTART_CONTAINER"
        else:
            if "(" in action and ")" in action:
                action = action.split("(")[1].split(")")[0].strip()
            else:
                action = "RESTART_CONTAINER"

        background_tasks.add_task(
            remediation_engine.execute_manual_override,
            AsyncSessionLocal,
            inc.id,
            action,
            None,
        )
        dispatched_ids.append(inc.id)

    return {
        "status": "BATCH_DISPATCHED",
        "count": len(dispatched_ids),
        "incident_ids": dispatched_ids,
        "message": f"Dispatched automated remediation for {len(dispatched_ids)} unresolved incidents."
    }


@router.post("/simulate")
async def simulate_chaos_incident(
    payload: ChaosSimulationRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Simulate a realistic container incident to test the full AIOps healing pipeline.
    Includes rate-limiting and auto-pruning to protect lightweight cloud VM.
    """
    # 1. Rate-limiting check
    now = time.time()
    while _chaos_timestamps and now - _chaos_timestamps[0] > _CHAOS_WINDOW_SECONDS:
        _chaos_timestamps.popleft()

    if len(_chaos_timestamps) >= _MAX_CHAOS_PER_WINDOW:
        raise HTTPException(
            status_code=429,
            detail="Chaos simulation rate limit reached (max 6 per 10s to protect lightweight VM). Please wait a few seconds."
        )
    _chaos_timestamps.append(now)

    # 2. Bounded Storage Check: Auto-prune old resolved incidents
    try:
        count_stmt = select(func.count(Incident.id))
        res_count = await db.execute(count_stmt)
        total_inc = res_count.scalar_one() or 0
        if total_inc >= _MAX_STORED_INCIDENTS:
            subq = (
                select(Incident.id)
                .filter(Incident.status == "RESOLVED")
                .order_by(Incident.created_at.asc())
                .limit(total_inc - _MAX_STORED_INCIDENTS + 10)
            )
            old_ids_res = await db.execute(subq)
            old_ids = old_ids_res.scalars().all()
            if old_ids:
                del_stmt = delete(Incident).where(Incident.id.in_(old_ids))
                await db.execute(del_stmt)
    except Exception:
        pass
    inc_id = f"inc_{uuid.uuid4().hex[:8]}"

    scenarios = {
        "oom": {
            "name": payload.container_name or "prod-analytics-engine",
            "image": "kintsugi/analytics-worker:v3.2.0",
            "exit_code": 137,
            "reason": "oom",
            "log": "2026-08-14T12:40:01Z [INFO] Processing batch dataframe 849,200 records\n2026-08-14T12:40:03Z [WARN] Resident memory near limit: 1018MB / 1024MB\n2026-08-14T12:40:04Z [ERROR] Fatal: Out of memory. cgroup memory controller invoked oom-killer for PID 4210 (analytics_worker)\nKilled",
            "flapping": False,
            "restarts": 1,
        },
        "panic": {
            "name": payload.container_name or "prod-auth-service",
            "image": "kintsugi/auth-service:v2.4.1",
            "exit_code": 2,
            "reason": "die",
            "log": "2026-08-14T12:41:12Z [INFO] HTTP POST /v1/oauth/token from 10.0.4.12\npanic: runtime error: invalid memory address or nil pointer dereference\n[signal SIGSEGV: segmentation violation code=0x1 addr=0x0 pc=0x67a840]\ngoroutine 18 [running]:\ngithub.com/kintsugi/auth/internal/jwt.SignToken(0x0, 0xc0000a2000)\n\t/app/internal/jwt/signer.go:42 +0x2b\ngithub.com/kintsugi/auth/server.(*Server).HandleAuth(0xc000108000, 0x889200, 0xc00012e000)\n\t/app/server/auth.go:88 +0x145",
            "flapping": False,
            "restarts": 0,
        },
        "segfault": {
            "name": payload.container_name or "prod-image-processor",
            "image": "kintsugi/image-resizer:v1.1.0",
            "exit_code": 139,
            "reason": "die",
            "log": "2026-08-14T12:42:00Z [INFO] Ingesting raw WebP buffer: size 14.8MB\n2026-08-14T12:42:01Z [CRITICAL] Segmentation fault (core dumped) in libwebp_simd_x86_64.so+0x140a",
            "flapping": False,
            "restarts": 0,
        },
        "flapping": {
            "name": payload.container_name or "prod-payment-worker",
            "image": "kintsugi/payment-worker:v1.9.4",
            "exit_code": 1,
            "reason": "die",
            "log": "2026-08-14T12:43:00Z [FATAL] DB Connection refused to postgres-primary.prod:5432\n2026-08-14T12:43:01Z [FATAL] Crash loop tripped: 4 crashes in 28 seconds.",
            "flapping": True,
            "restarts": 4,
        },
        "port_conflict": {
            "name": payload.container_name or "prod-ingress-proxy",
            "image": "kintsugi/envoy-proxy:v1.30",
            "exit_code": 1,
            "reason": "die",
            "log": "2026-08-15T12:44:00Z [ERROR] bind: address already in use [0.0.0.0:8080]\n2026-08-15T12:44:01Z [CRITICAL] Listener failed to bind on socket. Exiting with status 1.",
            "flapping": False,
            "restarts": 0,
        },
        "zombie_deadlock": {
            "name": payload.container_name or "prod-analytics-engine",
            "image": "kintsugi/analytics-worker:v3.2.0",
            "exit_code": 143,
            "reason": "unresponsive_deadlock",
            "log": "2026-08-15T09:12:00Z [CRITICAL] Worker thread PID 4192 deadlocked on mutex acquire in lock_manager.cpp:114\n2026-08-15T09:12:05Z [WARN] Process 100% CPU thread lock. Graceful SIGTERM dispatched to process tree.\n2026-08-15T09:12:15Z [ALERT] Process PID 4192 ignored SIGTERM (signal masked/trapped). Process tree state: ZOMBIE/D-STATE.\n2026-08-15T09:12:16Z [ERROR] Standard restart failed: Target process unresponsive to SIGTERM. Forceful SIGKILL (SIGKILL_CONTAINER) required.",
            "flapping": False,
            "restarts": 0,
        },
        "network_cascade": {
            "name": payload.container_name or "prod-payment-worker",
            "image": "kintsugi/payment-worker:v1.9.4",
            "exit_code": 0,
            "reason": "connection_pool_exhaustion",
            "log": "2026-08-15T09:14:01Z [ERROR] psycopg2.OperationalError: server closed the connection unexpectedly (connection reset by peer)\n2026-08-15T09:14:02Z [WARN] Connection pool exhaustion: 0/50 available sockets. 142 pending requests blocked.\n2026-08-15T09:14:05Z [CRITICAL] Cascading timeout in payment worker: Failed to flush transaction ledger to postgres-cluster:5432.\n2026-08-15T09:14:06Z [ERROR] Traceback (most recent call last):\n  File \"/app/workers/payment.py\", line 184, in execute_transaction\n    conn = await pool.acquire(timeout=5.0)\n  File \"/usr/local/lib/python3.11/site-packages/asyncpg/pool.py\", line 482, in acquire\n    raise exceptions.PoolAcquireTimeoutError('timed out waiting for a connection')\nasyncpg.exceptions.PoolAcquireTimeoutError: 50 connections stalled. Upstream socket partition. Reset connection pool required.",
            "flapping": False,
            "restarts": 0,
        }
    }

    selected = scenarios.get(payload.scenario, scenarios["oom"])

    incident = Incident(
        id=inc_id,
        container_id=f"c_{uuid.uuid4().hex[:12]}",
        container_name=selected["name"],
        image=selected["image"],
        exit_code=selected["exit_code"],
        termination_reason=selected["reason"],
        status="DETECTED",
        is_flapping=selected["flapping"],
        restart_count=selected["restarts"],
        remediation_status="PENDING",
    )
    db.add(incident)

    log_entry = IncidentLog(
        incident_id=inc_id,
        raw_tail_log=selected["log"],
        sanitized_log=selected["log"],
    )
    db.add(log_entry)
    await db.commit()

    # Trigger background AIOps healing loop
    background_tasks.add_task(
        remediation_engine.process_incident_lifecycle,
        AsyncSessionLocal,
        inc_id,
    )

    return {
        "status": "SIMULATED",
        "incident_id": inc_id,
        "scenario": payload.scenario,
        "incident": {
            "id": inc_id,
            "container_id": incident.container_id,
            "container_name": incident.container_name,
            "image": incident.image,
            "exit_code": incident.exit_code,
            "termination_reason": incident.termination_reason,
            "status": "DETECTED",
            "is_flapping": incident.is_flapping,
            "restart_count": incident.restart_count,
            "confidence_score": 0.0,
            "remediation_status": "PENDING",
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "logs": [{"id": 1, "sanitized_log": selected["log"], "captured_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}],
            "remediations": []
        }
    }

