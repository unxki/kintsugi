from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    Column,
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    Text,
    ForeignKey,
    JSON,
)
from sqlalchemy.orm import relationship
from app.db.session import Base
from app.config import settings

def utc_now():
    return datetime.now(timezone.utc)


# Attempt pgvector import; fallback to JSON/Text column for vector store abstraction
try:
    from pgvector.sqlalchemy import Vector
    PGVECTOR_AVAILABLE = True
except ImportError:
    PGVECTOR_AVAILABLE = False


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String(64), primary_key=True, index=True)
    container_id = Column(String(64), index=True, nullable=False)
    container_name = Column(String(255), index=True, nullable=False)
    image = Column(String(255), nullable=False)
    exit_code = Column(Integer, nullable=False)
    termination_reason = Column(String(64), default="die")  # die, oom, kill, unhealthy
    
    # Lifecycle Status: DETECTED, DIAGNOSING, REMEDIATING, RESOLVED, ESCALATED_MANUAL_INTERVENTION
    status = Column(String(32), default="DETECTED", index=True, nullable=False)
    
    # AI Diagnosis Fields
    failure_classification = Column(String(128), nullable=True)
    root_cause = Column(Text, nullable=True)
    confidence_score = Column(Float, default=0.0)
    operational_reasoning = Column(Text, nullable=True)
    remediation_proposal = Column(Text, nullable=True)
    
    # Remediation execution status
    action_taken = Column(String(128), nullable=True)
    remediation_status = Column(String(32), default="PENDING")  # PENDING, IN_PROGRESS, SUCCESS, FAILED, ESCALATED
    is_flapping = Column(Boolean, default=False)
    restart_count = Column(Integer, default=0)
    
    created_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    # Relationships
    logs = relationship("IncidentLog", back_populates="incident", cascade="all, delete-orphan")
    embedding = relationship("IncidentEmbedding", back_populates="incident", uselist=False, cascade="all, delete-orphan")
    remediations = relationship("RemediationAction", back_populates="incident", cascade="all, delete-orphan")


class IncidentLog(Base):
    __tablename__ = "incident_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False, index=True)
    raw_tail_log = Column(Text, nullable=True)
    sanitized_log = Column(Text, nullable=False)
    captured_at = Column(DateTime(timezone=True), default=utc_now)

    incident = relationship("Incident", back_populates="logs")


class IncidentEmbedding(Base):
    __tablename__ = "incident_embeddings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), unique=True, nullable=False, index=True)
    
    # If using postgresql + pgvector, use Vector(384); otherwise JSON array
    if PGVECTOR_AVAILABLE and "postgres" in settings.DATABASE_URL:
        embedding = Column(Vector(settings.EMBEDDING_DIMENSION))
    else:
        embedding = Column(JSON, nullable=True)
        
    signature_hash = Column(String(64), index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    incident = relationship("Incident", back_populates="embedding")


class RemediationAction(Base):
    __tablename__ = "remediation_actions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    incident_id = Column(String(64), ForeignKey("incidents.id"), nullable=False, index=True)
    action_type = Column(String(64), nullable=False)  # RESTART_CONTAINER, PRUNE_VOLUMES, STOP_RUNAWAY, ROLLBACK
    status = Column(String(32), default="PENDING")    # PENDING, EXECUTING, COMPLETED, FAILED
    execution_output = Column(Text, nullable=True)
    duration_ms = Column(Integer, default=0)
    executed_at = Column(DateTime(timezone=True), default=utc_now)

    incident = relationship("Incident", back_populates="remediations")


class MonitoredWorkload(Base):
    __tablename__ = "monitored_workloads"

    container_id = Column(String(64), primary_key=True)
    container_name = Column(String(255), nullable=False, index=True)
    image = Column(String(255), nullable=False)
    status = Column(String(32), default="running")  # running, restarting, exited, unhealthy
    cpu_percent = Column(Float, default=0.0)
    memory_usage_mb = Column(Float, default=0.0)
    memory_limit_mb = Column(Float, default=0.0)
    restart_count = Column(Integer, default=0)
    last_ping = Column(DateTime(timezone=True), default=utc_now)


class SystemConfiguration(Base):
    __tablename__ = "system_configuration"

    id = Column(Integer, primary_key=True, default=1)
    llm_provider = Column(String(32), default="heuristic", nullable=False)  # heuristic, openrouter, openai, anthropic, gemini, local_llm
    llm_model = Column(String(255), default="gpt-4o-mini", nullable=False)
    openai_api_key = Column(String(255), nullable=True)
    openrouter_api_key = Column(String(255), nullable=True)
    anthropic_api_key = Column(String(255), nullable=True)
    gemini_api_key = Column(String(255), nullable=True)
    local_llm_endpoint = Column(String(255), default="http://localhost:11434/v1", nullable=True)
    custom_base_url = Column(String(512), nullable=True)  # Enterprise Gateway or OpenRouter (e.g. https://openrouter.ai/api/v1)
    operating_mode = Column(String(32), default="ACTIVE", nullable=False)  # ACTIVE, PASSIVE
    similarity_threshold = Column(Float, default=0.85, nullable=False)
    confidence_threshold = Column(Float, default=0.75, nullable=False)
    flap_threshold = Column(Integer, default=3, nullable=False)
    flap_window_seconds = Column(Integer, default=60, nullable=False)
    log_tail_lines = Column(Integer, default=100, nullable=False)
    auto_heal_timeout_ms = Column(Integer, default=5000, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

