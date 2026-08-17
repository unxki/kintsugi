from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field


class AIDiagnosisOutput(BaseModel):
    failure_classification: str = Field(
        ...,
        description="High-level category of failure (e.g., Memory Exhaustion, Port Conflict, Unhandled Exception, Segfault, Deadlock, Misconfiguration)"
    )
    root_cause_summary: str = Field(
        ...,
        description="Concise 1-3 sentence explanation of why the container crashed based on log traces and metadata"
    )
    confidence_score: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0 in the diagnosis"
    )
    recommended_action: str = Field(
        ...,
        description="Automated remediation strategy: RESTART_CONTAINER, PRUNE_VOLUMES, STOP_RUNAWAY, ROLLBACK, or ESCALATE_MANUAL"
    )
    action_parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Parameters for the remediation action (e.g., timeout, volume_id, rollback_tag)"
    )
    operational_reasoning: str = Field(
        ...,
        description="Detailed technical reasoning intended for on-call SRE operators"
    )
    preventative_measures: List[str] = Field(
        default_factory=list,
        description="Recommended long-term fixes to prevent recurrence"
    )
