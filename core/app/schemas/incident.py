from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, ConfigDict
from app.schemas.diagnosis import AIDiagnosisOutput


class IncidentCreate(BaseModel):
    id: Optional[str] = None
    container_id: str
    container_name: str
    image: str
    exit_code: int
    termination_reason: str = "die"  # die, oom, kill, unhealthy
    sanitized_log: str
    raw_tail_log: Optional[str] = None
    is_flapping: bool = False
    restart_count: int = 0
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IncidentUpdate(BaseModel):
    status: Optional[str] = None
    failure_classification: Optional[str] = None
    root_cause: Optional[str] = None
    confidence_score: Optional[float] = None
    operational_reasoning: Optional[str] = None
    remediation_proposal: Optional[str] = None
    action_taken: Optional[str] = None
    remediation_status: Optional[str] = None


class IncidentLogResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sanitized_log: str
    captured_at: datetime


class RemediationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    action_type: str
    status: str
    execution_output: Optional[str] = None
    duration_ms: int
    executed_at: datetime


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    container_id: str
    container_name: str
    image: str
    exit_code: int
    termination_reason: str
    status: str
    failure_classification: Optional[str] = None
    root_cause: Optional[str] = None
    confidence_score: float = 0.0
    operational_reasoning: Optional[str] = None
    remediation_proposal: Optional[str] = None
    action_taken: Optional[str] = None
    remediation_status: str
    is_flapping: bool
    restart_count: int
    created_at: datetime
    updated_at: datetime
    logs: List[IncidentLogResponse] = []
    remediations: List[RemediationResponse] = []


class IncidentSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    container_id: str
    container_name: str
    image: str
    exit_code: int
    termination_reason: str
    status: str
    failure_classification: Optional[str] = None
    root_cause: Optional[str] = None
    confidence_score: float = 0.0
    operational_reasoning: Optional[str] = None
    remediation_proposal: Optional[str] = None
    action_taken: Optional[str] = None
    remediation_status: str
    is_flapping: bool
    restart_count: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
    logs: List[IncidentLogResponse] = []
    remediations: List[RemediationResponse] = []


class ContainerHeartbeat(BaseModel):
    container_id: str
    container_name: str
    image: str
    status: str
    cpu_percent: float = 0.0
    memory_usage_mb: float = 0.0
    memory_limit_mb: float = 512.0
    restart_count: int = 0
