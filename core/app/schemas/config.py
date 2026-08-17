import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict


class SystemConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int = 1
    llm_provider: str = Field("heuristic", description="LLM Engine: heuristic, openrouter, openai, anthropic, gemini, local_llm")
    llm_model: str = Field("gpt-4o-mini", description="Model name for provider")
    openai_api_key_configured: bool = False
    openrouter_api_key_configured: bool = False
    anthropic_api_key_configured: bool = False
    gemini_api_key_configured: bool = False
    local_llm_endpoint: str = "http://localhost:11434/v1"
    custom_base_url: Optional[str] = Field(None, description="Custom API Router / Base URL (e.g. OpenRouter or Enterprise Gateway)")
    operating_mode: str = Field("ACTIVE", description="Remediation Mode: ACTIVE or PASSIVE")
    similarity_threshold: float = Field(0.85, ge=0.50, le=0.99, description="Cosine similarity threshold for pgvector match")
    confidence_threshold: float = Field(0.75, ge=0.50, le=0.99, description="Confidence threshold for autonomous remediation")
    flap_threshold: int = Field(3, ge=1, le=10, description="Crash limit before circuit breaker trips")
    flap_window_seconds: int = Field(60, ge=10, le=600, description="Sliding window in seconds")
    log_tail_lines: int = Field(100, ge=20, le=500, description="Tail lines to capture for RCA")
    auto_heal_timeout_ms: int = Field(5000, ge=1000, le=30000, description="Remediation execution timeout in ms")
    updated_at: Optional[datetime.datetime] = None


class SystemConfigUpdate(BaseModel):
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    openai_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    anthropic_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    local_llm_endpoint: Optional[str] = None
    custom_base_url: Optional[str] = None
    operating_mode: Optional[str] = None
    similarity_threshold: Optional[float] = Field(None, ge=0.50, le=0.99)
    confidence_threshold: Optional[float] = Field(None, ge=0.50, le=0.99)
    flap_threshold: Optional[int] = Field(None, ge=1, le=10)
    flap_window_seconds: Optional[int] = Field(None, ge=10, le=600)
    log_tail_lines: Optional[int] = Field(None, ge=20, le=500)
    auto_heal_timeout_ms: Optional[int] = Field(None, ge=1000, le=30000)


class LLMTestRequest(BaseModel):
    llm_provider: str = "heuristic"
    llm_model: Optional[str] = "gpt-4o-mini"
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    custom_base_url: Optional[str] = None


class LLMTestResponse(BaseModel):
    success: bool
    provider: str
    model: str
    latency_ms: int
    message: str
    error: Optional[str] = None


class ModelListRequest(BaseModel):
    llm_provider: str = "gemini"
    api_key: Optional[str] = None
    endpoint: Optional[str] = None
    custom_base_url: Optional[str] = None


class ModelListResponse(BaseModel):
    provider: str
    models: list[str]
    default_model: str
    is_live_fetched: bool = False
    error: Optional[str] = None

