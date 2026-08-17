from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


class TelemetryEvent(BaseModel):
    event_type: str = Field(
        ...,
        description="Event kind: incident.detected, incident.diagnosing, incident.remediating, incident.resolved, incident.escalated, node.heartbeat, stats.update"
    )
    incident_id: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    data: Dict[str, Any] = Field(default_factory=dict)


class SystemStats(BaseModel):
    active_agents: int = 1
    monitored_workloads: int = 0
    total_incidents: int = 0
    auto_healed_count: int = 0
    escalated_count: int = 0
    mean_time_to_recovery_sec: float = 0.0
    uptime_seconds: int = 0
    system_status: str = "HEALTHY"

