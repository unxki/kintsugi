import time
import datetime
import httpx
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.db.models import SystemConfiguration
from app.schemas.config import (
    SystemConfigResponse,
    SystemConfigUpdate,
    LLMTestRequest,
    LLMTestResponse,
    ModelListRequest,
    ModelListResponse,
)
from app.services.sse_broadcaster import sse_broadcaster
from app.schemas.telemetry import TelemetryEvent
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory cached configuration for fast synchronous access
_cached_config: dict = {
    "llm_provider": settings.LLM_PROVIDER,
    "llm_model": settings.LLM_MODEL,
    "operating_mode": "ACTIVE",
    "similarity_threshold": 0.85,
    "confidence_threshold": 0.75,
    "flap_threshold": settings.FLAP_THRESHOLD,
    "flap_window_seconds": settings.FLAP_WINDOW_SECONDS,
    "log_tail_lines": settings.LOG_TAIL_LINES,
    "auto_heal_timeout_ms": 5000,
    "openai_api_key": settings.OPENAI_API_KEY,
    "openrouter_api_key": None,
    "anthropic_api_key": settings.ANTHROPIC_API_KEY,
    "gemini_api_key": settings.GEMINI_API_KEY,
    "local_llm_endpoint": "http://localhost:11434/v1",
    "custom_base_url": None,
}


def get_cached_config() -> dict:
    return _cached_config


async def get_or_create_db_config(db: AsyncSession) -> SystemConfiguration:
    stmt = select(SystemConfiguration).filter(SystemConfiguration.id == 1)
    result = await db.execute(stmt)
    config = result.scalar_one_or_none()

    if not config:
        config = SystemConfiguration(
            id=1,
            llm_provider=settings.LLM_PROVIDER or "heuristic",
            llm_model=settings.LLM_MODEL or "gpt-4o-mini",
            openai_api_key=settings.OPENAI_API_KEY or None,
            openrouter_api_key=None,
            anthropic_api_key=settings.ANTHROPIC_API_KEY or None,
            gemini_api_key=settings.GEMINI_API_KEY or None,
            local_llm_endpoint="http://localhost:11434/v1",
            custom_base_url=None,
            operating_mode="ACTIVE",
            similarity_threshold=0.85,
            confidence_threshold=0.75,
            flap_threshold=settings.FLAP_THRESHOLD or 3,
            flap_window_seconds=settings.FLAP_WINDOW_SECONDS or 60,
            log_tail_lines=settings.LOG_TAIL_LINES or 100,
            auto_heal_timeout_ms=5000,
            updated_at=datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

    # Sync to in-memory cache
    _cached_config["llm_provider"] = config.llm_provider
    _cached_config["llm_model"] = config.llm_model
    _cached_config["operating_mode"] = config.operating_mode
    _cached_config["similarity_threshold"] = config.similarity_threshold
    _cached_config["confidence_threshold"] = config.confidence_threshold
    _cached_config["flap_threshold"] = config.flap_threshold
    _cached_config["flap_window_seconds"] = config.flap_window_seconds
    _cached_config["log_tail_lines"] = config.log_tail_lines
    _cached_config["auto_heal_timeout_ms"] = config.auto_heal_timeout_ms
    _cached_config["openai_api_key"] = config.openai_api_key
    _cached_config["openrouter_api_key"] = config.openrouter_api_key
    _cached_config["anthropic_api_key"] = config.anthropic_api_key
    _cached_config["gemini_api_key"] = config.gemini_api_key
    _cached_config["local_llm_endpoint"] = config.local_llm_endpoint
    _cached_config["custom_base_url"] = config.custom_base_url

    return config


@router.get("", response_model=SystemConfigResponse)
async def get_system_config(db: AsyncSession = Depends(get_db)):
    """
    Get active dynamic system configuration.
    API keys are returned as boolean flags (configured vs not configured) for security.
    """
    config = await get_or_create_db_config(db)
    return SystemConfigResponse(
        id=config.id,
        llm_provider=config.llm_provider,
        llm_model=config.llm_model,
        openai_api_key_configured=bool(config.openai_api_key),
        openrouter_api_key_configured=bool(config.openrouter_api_key or (config.openai_api_key and "openrouter" in str(config.custom_base_url or ""))),
        anthropic_api_key_configured=bool(config.anthropic_api_key),
        gemini_api_key_configured=bool(config.gemini_api_key),
        local_llm_endpoint=config.local_llm_endpoint or "http://localhost:11434/v1",
        custom_base_url=config.custom_base_url,
        operating_mode=config.operating_mode,
        similarity_threshold=config.similarity_threshold,
        confidence_threshold=config.confidence_threshold,
        flap_threshold=config.flap_threshold,
        flap_window_seconds=config.flap_window_seconds,
        log_tail_lines=config.log_tail_lines,
        auto_heal_timeout_ms=config.auto_heal_timeout_ms,
        updated_at=config.updated_at,
    )


@router.put("", response_model=SystemConfigResponse)
async def update_system_config(
    payload: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update system configuration dynamically without rebooting containers.
    """
    config = await get_or_create_db_config(db)

    if payload.llm_provider is not None:
        config.llm_provider = payload.llm_provider
    if payload.llm_model is not None:
        config.llm_model = payload.llm_model
    if payload.openai_api_key is not None:
        config.openai_api_key = payload.openai_api_key.strip() if payload.openai_api_key.strip() else None
    if payload.openrouter_api_key is not None:
        config.openrouter_api_key = payload.openrouter_api_key.strip() if payload.openrouter_api_key.strip() else None
    if payload.anthropic_api_key is not None:
        config.anthropic_api_key = payload.anthropic_api_key.strip() if payload.anthropic_api_key.strip() else None
    if payload.gemini_api_key is not None:
        config.gemini_api_key = payload.gemini_api_key.strip() if payload.gemini_api_key.strip() else None
    if payload.local_llm_endpoint is not None:
        config.local_llm_endpoint = payload.local_llm_endpoint.strip() or "http://localhost:11434/v1"
    if payload.custom_base_url is not None:
        config.custom_base_url = payload.custom_base_url.strip() if payload.custom_base_url.strip() else None
    if payload.operating_mode is not None:
        config.operating_mode = payload.operating_mode
    if payload.similarity_threshold is not None:
        config.similarity_threshold = payload.similarity_threshold
    if payload.confidence_threshold is not None:
        config.confidence_threshold = payload.confidence_threshold
    if payload.flap_threshold is not None:
        config.flap_threshold = payload.flap_threshold
    if payload.flap_window_seconds is not None:
        config.flap_window_seconds = payload.flap_window_seconds
    if payload.log_tail_lines is not None:
        config.log_tail_lines = payload.log_tail_lines
    if payload.auto_heal_timeout_ms is not None:
        config.auto_heal_timeout_ms = payload.auto_heal_timeout_ms

    config.updated_at = datetime.datetime.now(datetime.timezone.utc)
    await db.commit()
    await db.refresh(config)

    # Sync cache
    _cached_config["llm_provider"] = config.llm_provider
    _cached_config["llm_model"] = config.llm_model
    _cached_config["operating_mode"] = config.operating_mode
    _cached_config["similarity_threshold"] = config.similarity_threshold
    _cached_config["confidence_threshold"] = config.confidence_threshold
    _cached_config["flap_threshold"] = config.flap_threshold
    _cached_config["flap_window_seconds"] = config.flap_window_seconds
    _cached_config["log_tail_lines"] = config.log_tail_lines
    _cached_config["auto_heal_timeout_ms"] = config.auto_heal_timeout_ms
    _cached_config["openai_api_key"] = config.openai_api_key
    _cached_config["openrouter_api_key"] = config.openrouter_api_key
    _cached_config["anthropic_api_key"] = config.anthropic_api_key
    _cached_config["gemini_api_key"] = config.gemini_api_key
    _cached_config["local_llm_endpoint"] = config.local_llm_endpoint
    _cached_config["custom_base_url"] = config.custom_base_url

    # Broadcast update event over SSE
    await sse_broadcaster.broadcast(
        TelemetryEvent(
            event_type="config.updated",
            incident_id="",
            data={
                "llm_provider": config.llm_provider,
                "llm_model": config.llm_model,
                "operating_mode": config.operating_mode,
                "similarity_threshold": config.similarity_threshold,
                "confidence_threshold": config.confidence_threshold,
                "custom_base_url": config.custom_base_url,
            }
        )
    )

    logger.info(f"System Configuration updated: provider={config.llm_provider}, mode={config.operating_mode}, model={config.llm_model}")

    return SystemConfigResponse(
        id=config.id,
        llm_provider=config.llm_provider,
        llm_model=config.llm_model,
        openai_api_key_configured=bool(config.openai_api_key),
        anthropic_api_key_configured=bool(config.anthropic_api_key),
        gemini_api_key_configured=bool(config.gemini_api_key),
        local_llm_endpoint=config.local_llm_endpoint or "http://localhost:11434/v1",
        custom_base_url=config.custom_base_url,
        operating_mode=config.operating_mode,
        similarity_threshold=config.similarity_threshold,
        confidence_threshold=config.confidence_threshold,
        flap_threshold=config.flap_threshold,
        flap_window_seconds=config.flap_window_seconds,
        log_tail_lines=config.log_tail_lines,
        auto_heal_timeout_ms=config.auto_heal_timeout_ms,
        updated_at=config.updated_at,
    )


@router.post("/test-llm", response_model=LLMTestResponse)
async def test_llm_connectivity(payload: LLMTestRequest, db: AsyncSession = Depends(get_db)):
    """
    Test real-time connectivity against the specified provider using configured or supplied credentials.
    """
    provider = payload.llm_provider.lower()
    model = payload.llm_model or "default"
    custom_base_url = payload.custom_base_url
    start_time = time.time()

    # 1. Deterministic Heuristic Engine
    if provider == "heuristic":
        latency_ms = int((time.time() - start_time) * 1000) + 5
        return LLMTestResponse(
            success=True,
            provider="Heuristic Rule Engine",
            model="deterministic-regex-v1",
            latency_ms=latency_ms,
            message="Deterministic heuristic regex engine is online and operating with sub-millisecond execution.",
        )

    # 2. Local LLM / Ollama
    if provider == "local_llm":
        endpoint = custom_base_url or payload.endpoint or _cached_config.get("local_llm_endpoint") or "http://localhost:11434/v1"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(f"{endpoint.rstrip('/v1')}/api/tags")
                latency_ms = int((time.time() - start_time) * 1000)
                if resp.status_code == 200:
                    return LLMTestResponse(
                        success=True,
                        provider="Local LLM / Ollama",
                        model=model,
                        latency_ms=latency_ms,
                        message=f"Local inference endpoint reachable at {endpoint}.",
                    )
                else:
                    return LLMTestResponse(
                        success=False,
                        provider="Local LLM",
                        model=model,
                        latency_ms=latency_ms,
                        message=f"Local LLM endpoint returned HTTP {resp.status_code}",
                        error=resp.text
                    )
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return LLMTestResponse(
                success=False,
                provider="Local LLM",
                model=model,
                latency_ms=latency_ms,
                message=f"Failed to connect to local LLM server at {endpoint}: {e}",
                error=str(e)
            )

    # Resolve API Key
    config = await get_or_create_db_config(db)
    api_key = payload.api_key
    if not api_key:
        if provider == "openai":
            api_key = config.openai_api_key or settings.OPENAI_API_KEY
        elif provider == "anthropic":
            api_key = config.anthropic_api_key or settings.ANTHROPIC_API_KEY
        elif provider == "gemini":
            api_key = config.gemini_api_key or settings.GEMINI_API_KEY

    if not api_key:
        latency_ms = int((time.time() - start_time) * 1000)
        return LLMTestResponse(
            success=False,
            provider=provider.capitalize(),
            model=model,
            latency_ms=latency_ms,
            message=f"No API key configured for {provider.capitalize()}. Please input an API key.",
            error="MISSING_API_KEY"
        )

    # Test OpenRouter & OpenAI / API Router
    if provider in ("openrouter", "openai"):
        base_url = custom_base_url or config.custom_base_url or ("https://openrouter.ai/api/v1" if provider == "openrouter" else "https://api.openai.com/v1")
        try:
            headers = {"Authorization": f"Bearer {api_key}"}
            if "openrouter.ai" in base_url or provider == "openrouter":
                headers["HTTP-Referer"] = "https://kintsugi.aiops"
                headers["X-Title"] = "Kintsugi AIOps Platform"

            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{base_url.rstrip('/')}/models",
                    headers=headers
                )
                latency_ms = int((time.time() - start_time) * 1000)
                if resp.status_code == 200:
                    provider_title = "OpenRouter" if provider == "openrouter" or "openrouter" in base_url else "OpenAI / API Router"
                    return LLMTestResponse(
                        success=True,
                        provider=provider_title,
                        model=model,
                        latency_ms=latency_ms,
                        message=f"API router verified via {base_url}. Model catalog accessible.",
                    )
                else:
                    return LLMTestResponse(
                        success=False,
                        provider="OpenRouter" if provider == "openrouter" else "OpenAI",
                        model=model,
                        latency_ms=latency_ms,
                        message=f"Authentication failed: HTTP {resp.status_code}",
                        error=resp.text
                    )
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return LLMTestResponse(
                success=False,
                provider="OpenRouter" if provider == "openrouter" else "OpenAI",
                model=model,
                latency_ms=latency_ms,
                message=f"API Router request failed: {e}",
                error=str(e)
            )

    # Test Anthropic API
    if provider == "anthropic":
        base_url = custom_base_url or config.custom_base_url or "https://api.anthropic.com/v1"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    f"{base_url.rstrip('/')}/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": model,
                        "max_tokens": 10,
                        "messages": [{"role": "user", "content": "ping"}]
                    }
                )
                latency_ms = int((time.time() - start_time) * 1000)
                if resp.status_code in [200, 400]:
                    return LLMTestResponse(
                        success=True,
                        provider="Anthropic",
                        model=model,
                        latency_ms=latency_ms,
                        message=f"Anthropic API key verified. Claude engine ready.",
                    )
                return LLMTestResponse(
                    success=False,
                    provider="Anthropic",
                    model=model,
                    latency_ms=latency_ms,
                    message=f"Anthropic API check returned HTTP {resp.status_code}",
                    error=resp.text
                )
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return LLMTestResponse(
                success=False,
                provider="Anthropic",
                model=model,
                latency_ms=latency_ms,
                message=f"Anthropic request failed: {e}",
                error=str(e)
            )

    # Test Gemini & Gemma API
    if provider == "gemini":
        base_url = custom_base_url or config.custom_base_url or "https://generativelanguage.googleapis.com/v1beta"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{base_url.rstrip('/')}/models?key={api_key}"
                )
                latency_ms = int((time.time() - start_time) * 1000)
                if resp.status_code == 200:
                    return LLMTestResponse(
                        success=True,
                        provider="Google Gemini & Gemma",
                        model=model,
                        latency_ms=latency_ms,
                        message="Gemini & Gemma API key verified. Models accessible.",
                    )
                return LLMTestResponse(
                    success=False,
                    provider="Google Gemini & Gemma",
                    model=model,
                    latency_ms=latency_ms,
                    message=f"Gemini API check returned HTTP {resp.status_code}",
                    error=resp.text
                )
        except Exception as e:
            latency_ms = int((time.time() - start_time) * 1000)
            return LLMTestResponse(
                success=False,
                provider="Google Gemini & Gemma",
                model=model,
                latency_ms=latency_ms,
                message=f"Gemini request failed: {e}",
                error=str(e)
            )

    return LLMTestResponse(
        success=True,
        provider=provider,
        model=model,
        latency_ms=int((time.time() - start_time) * 1000),
        message=f"Provider '{provider}' configured.",
    )


@router.post("/fetch-models", response_model=ModelListResponse)
async def fetch_provider_models(payload: ModelListRequest, db: AsyncSession = Depends(get_db)):
    """
    Dynamically fetch available models from the provider API using the configured/supplied API key, endpoint, or custom router.
    """
    provider = payload.llm_provider.lower()
    config = await get_or_create_db_config(db)
    custom_base_url = payload.custom_base_url or config.custom_base_url

    api_key = payload.api_key
    if not api_key:
        if provider == "openai":
            api_key = config.openai_api_key or settings.OPENAI_API_KEY
        elif provider == "anthropic":
            api_key = config.anthropic_api_key or settings.ANTHROPIC_API_KEY
        elif provider == "gemini":
            api_key = config.gemini_api_key or settings.GEMINI_API_KEY

    endpoint = payload.endpoint or config.local_llm_endpoint or "http://localhost:11434/v1"

    # 1. Deterministic Heuristic
    if provider == "heuristic":
        return ModelListResponse(
            provider="Heuristic Rule Engine",
            models=["deterministic-regex-v1"],
            default_model="deterministic-regex-v1",
            is_live_fetched=True
        )

    # 2. Google Gemini & Gemma
    if provider == "gemini":
        default_gemini = [
            "gemini-2.5-flash",
            "gemini-2.5-pro",
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemma-4-31b-it",
            "gemma-3-27b-it",
            "gemma-2-27b-it",
            "gemma-2-9b-it",
            "gemini-1.5-pro",
            "gemini-1.5-flash",
        ]
        if not api_key:
            return ModelListResponse(
                provider="Google Gemini & Gemma",
                models=default_gemini,
                default_model="gemini-2.5-flash",
                is_live_fetched=False
            )
        try:
            base_url = custom_base_url or "https://generativelanguage.googleapis.com/v1beta"
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{base_url.rstrip('/')}/models?key={api_key}"
                )
                if resp.status_code == 200:
                    data = resp.json()
                    models_raw = data.get("models", [])
                    extracted = []
                    for m in models_raw:
                        name = m.get("name", "").replace("models/", "")
                        methods = m.get("supportedGenerationMethods", [])
                        
                        if name.startswith(("embedding", "text-embedding", "aqa", "imagen", "tts")):
                            continue

                        if any(method in methods for method in ["generateContent", "generateMessage", "bidiGenerateContent"]) or "gemini" in name.lower() or "gemma" in name.lower():
                            extracted.append(name)
                    
                    if extracted:
                        def model_rank(m_name: str) -> tuple:
                            m_lower = m_name.lower()
                            if "flash-lite-latest" in m_lower:
                                return (0, m_lower)
                            if "3.5-flash" in m_lower:
                                return (1, m_lower)
                            if "flash-latest" in m_lower:
                                return (2, m_lower)
                            if "gemma-4" in m_lower:
                                return (3, m_lower)
                            if "3-flash" in m_lower:
                                return (4, m_lower)
                            if "gemma-3" in m_lower:
                                return (5, m_lower)
                            if "2.5" in m_lower:
                                return (6, m_lower)
                            return (7, m_lower)

                        extracted = list(dict.fromkeys(extracted))
                        extracted.sort(key=model_rank)
                        return ModelListResponse(
                            provider="Google Gemini & Gemma",
                            models=extracted,
                            default_model="gemini-flash-lite-latest",
                            is_live_fetched=True
                        )
        except Exception as e:
            logger.warning(f"Failed to fetch Gemini & Gemma live models: {e}")

        default_gemini = [
            "gemini-flash-lite-latest",
            "gemini-3.5-flash",
            "gemini-flash-latest",
            "gemma-4-31b-it",
            "gemma-4-26b-a4b-it",
            "gemini-3-flash-preview",
            "gemini-2.5-flash",
        ]
        return ModelListResponse(
            provider="Google Gemini & Gemma",
            models=default_gemini,
            default_model="gemini-flash-lite-latest",
            is_live_fetched=False
        )

    # 3. OpenRouter & Universal API Routers (Groq, DeepSeek, Together AI, LiteLLM, vLLM)
    if provider == "openrouter" or (provider == "openai" and custom_base_url and "openrouter" in custom_base_url.lower()):
        default_openrouter = [
            "anthropic/claude-3.7-sonnet",
            "deepseek/deepseek-r1",
            "meta-llama/llama-3.3-70b-instruct",
            "google/gemini-2.0-flash-001",
            "qwen/qwen-2.5-coder-32b-instruct",
            "openai/gpt-4o",
            "openai/o3-mini",
            "mistralai/mistral-large-2411",
            "deepseek/deepseek-chat",
            "groq/llama-3.3-70b-versatile",
            "cohere/command-r-plus",
        ]
        if not api_key:
            return ModelListResponse(
                provider="OpenRouter & Custom Routers",
                models=default_openrouter,
                default_model="anthropic/claude-3.7-sonnet",
                is_live_fetched=False
            )
        try:
            base_url = custom_base_url or "https://openrouter.ai/api/v1"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "https://kintsugi.aiops",
                "X-Title": "Kintsugi AIOps Platform"
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(f"{base_url.rstrip('/')}/models", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    models_raw = data.get("data", [])
                    extracted = []
                    for m in models_raw:
                        if isinstance(m, dict) and "id" in m:
                            m_id = m["id"]
                            # Filter non-chat/embedding models
                            if any(skip in m_id.lower() for skip in ["embedding", "tts", "whisper", "dall-e", "moderation", "audio", "image"]):
                                continue
                            extracted.append(m_id)
                    
                    if extracted:
                        def router_rank(name: str) -> tuple:
                            nl = name.lower()
                            # Preferred frontier models at the very top
                            if "claude-3.7-sonnet" in nl or "claude-3-7-sonnet" in nl:
                                return (0, nl)
                            if "deepseek-r1" in nl or "deepseek/deepseek-r1" in nl:
                                return (1, nl)
                            if "claude-3.5-sonnet" in nl or "claude-3-5-sonnet" in nl:
                                return (2, nl)
                            if "llama-3.3-70b" in nl:
                                return (3, nl)
                            if "gemini-2.0-flash" in nl or "gemini-2.5-flash" in nl or "gemini-flash" in nl:
                                return (4, nl)
                            if "qwen-2.5-coder-32b" in nl or "qwen2.5-coder" in nl:
                                return (5, nl)
                            if "gpt-4o" in nl:
                                return (6, nl)
                            if "o3-mini" in nl:
                                return (7, nl)
                            if "mistral-large" in nl:
                                return (8, nl)
                            if any(lead in nl for lead in ["anthropic/", "deepseek/", "meta-llama/", "google/", "openai/", "qwen/"]):
                                return (9, nl)
                            return (10, nl)

                        extracted = list(dict.fromkeys(extracted))
                        extracted.sort(key=router_rank)
                        return ModelListResponse(
                            provider="OpenRouter / Universal Router",
                            models=extracted,
                            default_model=extracted[0],
                            is_live_fetched=True
                        )
        except Exception as e:
            logger.warning(f"Failed to fetch OpenRouter live models: {e}")

        return ModelListResponse(
            provider="OpenRouter & Custom Routers",
            models=default_openrouter,
            default_model="anthropic/claude-3.7-sonnet",
            is_live_fetched=False
        )

    # 4. Standard OpenAI
    if provider == "openai":
        default_openai = [
            "gpt-4o-mini",
            "gpt-4o",
            "o3-mini",
            "o1-mini",
            "o1",
            "gpt-4-turbo",
        ]
        if not api_key:
            return ModelListResponse(
                provider="OpenAI",
                models=default_openai,
                default_model="gpt-4o-mini",
                is_live_fetched=False
            )
        try:
            base_url = custom_base_url or "https://api.openai.com/v1"
            headers = {"Authorization": f"Bearer {api_key}"}
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(
                    f"{base_url.rstrip('/')}/models",
                    headers=headers
                )
                if resp.status_code == 200:
                    data = resp.json()
                    models_raw = data.get("data", [])
                    extracted = [
                        m["id"] for m in models_raw
                        if isinstance(m, dict) and "id" in m and not m["id"].startswith(("tts", "whisper", "dall-e", "text-embedding", "babbage", "davinci"))
                    ]
                    if extracted:
                        extracted.sort(key=lambda x: ("4o" not in x, "o3" not in x, "o1" not in x, "sonnet" not in x, x))
                        return ModelListResponse(
                            provider="OpenAI / API Router",
                            models=extracted,
                            default_model=extracted[0],
                            is_live_fetched=True
                        )
        except Exception as e:
            logger.warning(f"Failed to fetch OpenAI/Router live models: {e}")

        return ModelListResponse(
            provider="OpenAI",
            models=default_openai,
            default_model="gpt-4o-mini",
            is_live_fetched=False
        )

    # 4. Anthropic
    if provider == "anthropic":
        anthropic_models = [
            "claude-3-7-sonnet-20250219",
            "claude-3-5-sonnet-20241022",
            "claude-3-5-haiku-20241022",
            "claude-3-opus-20240229",
        ]
        return ModelListResponse(
            provider="Anthropic",
            models=anthropic_models,
            default_model="claude-3-7-sonnet-20250219",
            is_live_fetched=bool(api_key)
        )

    # 5. Local LLM / Ollama
    if provider == "local_llm":
        default_local = [
            "deepseek-r1:latest",
            "llama3.3:latest",
            "qwen2.5-coder:latest",
            "mistral-small:latest",
        ]
        try:
            local_url = custom_base_url or endpoint
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.get(f"{local_url.rstrip('/v1')}/api/tags")
                if resp.status_code == 200:
                    data = resp.json()
                    models_raw = data.get("models", [])
                    extracted = [m["name"] for m in models_raw if "name" in m]
                    if extracted:
                        return ModelListResponse(
                            provider="Local LLM / Ollama",
                            models=extracted,
                            default_model=extracted[0],
                            is_live_fetched=True
                        )
        except Exception as e:
            logger.warning(f"Failed to fetch local models: {e}")

        return ModelListResponse(
            provider="Local LLM / Ollama",
            models=default_local,
            default_model="deepseek-r1:latest",
            is_live_fetched=False
        )

    return ModelListResponse(
        provider=provider,
        models=["default"],
        default_model="default",
        is_live_fetched=False
    )
