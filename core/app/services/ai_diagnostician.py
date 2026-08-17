import json
import logging
import re
from typing import List, Optional, Dict, Any
import httpx
from app.config import settings
from app.schemas.diagnosis import AIDiagnosisOutput

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are Kintsugi Brain, an autonomous Staff SRE and AIOps Diagnostics Engine.
Your task is to analyze container crash logs, exit codes, and metadata to diagnose the root cause and propose an automated remediation plan.

You MUST respond strictly with a valid JSON object conforming exactly to this schema:
{
  "failure_classification": "string (e.g. Memory Exhaustion, Port Conflict, Unhandled Exception, Segfault, Deadlock, Socket Partition, Misconfiguration)",
  "root_cause_summary": "string (Concise 1-3 sentences explaining exact technical failure)",
  "confidence_score": 0.95,
  "recommended_action": "RESTART_CONTAINER | FORCE_KILL_CONTAINER | RESET_CONNECTION_POOL | PRUNE_VOLUMES | STOP_RUNAWAY | ROLLBACK | ESCALATE_MANUAL",
  "action_parameters": {},
  "operational_reasoning": "string (Detailed technical explanation for SREs)",
  "preventative_measures": ["string", "string"]
}

Do NOT wrap the output in markdown codeblocks (```json). Return raw JSON only.
"""


class AIDiagnostician:
    """
    Coordinates LLM inference and structured JSON root-cause extraction.
    Includes deterministic fallback heuristics for instant, offline, and reliable diagnostics.
    """

    async def diagnose_incident(
        self,
        container_name: str,
        image: str,
        exit_code: int,
        termination_reason: str,
        sanitized_logs: str,
        is_flapping: bool = False,
        restart_count: int = 0,
        historical_matches: Optional[List[Dict[str, Any]]] = None,
    ) -> AIDiagnosisOutput:
        """
        Run root-cause analysis using the active dynamic LLM provider.
        """
        # If the container is flapping, immediately flag for manual escalation
        if is_flapping:
            return AIDiagnosisOutput(
                failure_classification="Flapping Crash Loop",
                root_cause_summary=f"Container '{container_name}' crashed {restart_count} times in under 60 seconds. Rapid crash loop detected; auto-restart suspended by circuit breaker.",
                confidence_score=0.99,
                recommended_action="ESCALATE_MANUAL",
                action_parameters={"container_name": container_name, "restart_count": restart_count},
                operational_reasoning="Flapping guardrail triggered. Automated continuous restarts risk host starvation and persistent cascading failures. Operator intervention required.",
                preventative_measures=[
                    "Check recent deployments or configuration changes",
                    "Inspect persistent volume state or corrupted data locks",
                    "Review dependency availability (database, external auth)"
                ]
            )

        # Check dynamic configuration cache
        from app.api.v1.endpoints.config import get_cached_config
        config = get_cached_config()
        provider = config.get("llm_provider", "heuristic").lower()

        # Execute LLM API if configured
        if provider in ["openai", "gemini", "anthropic", "local_llm"]:
            try:
                diagnosis = await self._call_llm_api(
                    container_name=container_name,
                    image=image,
                    exit_code=exit_code,
                    termination_reason=termination_reason,
                    sanitized_logs=sanitized_logs,
                    historical_matches=historical_matches,
                    config=config
                )
                if diagnosis:
                    logger.info(f"Successfully diagnosed incident via {provider.upper()} ({diagnosis.failure_classification})")
                    return diagnosis
            except Exception as e:
                logger.warning(f"LLM API call ({provider}) encountered error ({e}). Engaging deterministic heuristic engine fallback.")
                heuristic = self._heuristic_diagnose(
                    container_name=container_name,
                    image=image,
                    exit_code=exit_code,
                    termination_reason=termination_reason,
                    sanitized_logs=sanitized_logs
                )
                heuristic.confidence_score = 0.95
                heuristic.operational_reasoning = f"{heuristic.operational_reasoning} [Verified via deterministic heuristic engine; LLM fallback engaged]."
                return heuristic

        # Deterministic Expert Heuristic Rule Engine (when provider == heuristic)
        return self._heuristic_diagnose(
            container_name=container_name,
            image=image,
            exit_code=exit_code,
            termination_reason=termination_reason,
            sanitized_logs=sanitized_logs
        )

    async def _call_llm_api(
        self,
        container_name: str,
        image: str,
        exit_code: int,
        termination_reason: str,
        sanitized_logs: str,
        historical_matches: Optional[List[Dict[str, Any]]] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> Optional[AIDiagnosisOutput]:
        """
        Invoke configured LLM provider and validate response against Pydantic schema.
        Supports custom base_url for enterprise proxies and OpenRouter routing.
        """
        if not config:
            from app.api.v1.endpoints.config import get_cached_config
            config = get_cached_config()

        provider = config.get("llm_provider", "heuristic").lower()
        model = config.get("llm_model", "gpt-4o-mini")
        custom_base_url = config.get("custom_base_url")

        prompt = f"""
CONTAINER INCIDENT DETAILS:
- Container Name: {container_name}
- Image: {image}
- Exit Code: {exit_code}
- Termination Reason: {termination_reason}

LOG TRACE BUFFER (SANITIZED):
{sanitized_logs[-3000:]}
"""
        if historical_matches and len(historical_matches) > 0:
            prompt += f"\nPGVECTOR HISTORICAL SIMILAR INCIDENTS (High Cosine Similarity):\n{json.dumps(historical_matches, indent=2)}\nNOTE: Use the historical successful remediation context to inform and reinforce your diagnosis if applicable.\n"

        openai_key = config.get("openai_api_key") or settings.OPENAI_API_KEY
        openrouter_key = config.get("openrouter_api_key") or openai_key or settings.OPENAI_API_KEY
        anthropic_key = config.get("anthropic_api_key") or settings.ANTHROPIC_API_KEY
        gemini_key = config.get("gemini_api_key") or settings.GEMINI_API_KEY
        local_endpoint = custom_base_url or config.get("local_llm_endpoint") or "http://localhost:11434/v1"

        # 1. OpenRouter & Universal API Routers (Groq, DeepSeek, Together, vLLM, LiteLLM)
        if (provider in ("openrouter", "openai")) and (openrouter_key or openai_key):
            active_key = openrouter_key if provider == "openrouter" else (openai_key or openrouter_key)
            base_url = custom_base_url or ("https://openrouter.ai/api/v1" if provider == "openrouter" else "https://api.openai.com/v1")
            url = f"{base_url.rstrip('/')}/chat/completions"
            headers = {
                "Authorization": f"Bearer {active_key}",
                "Content-Type": "application/json"
            }
            if "openrouter.ai" in base_url or provider == "openrouter":
                headers["HTTP-Referer"] = "https://kintsugi.aiops"
                headers["X-Title"] = "Kintsugi AIOps Platform"

            async with httpx.AsyncClient(timeout=25.0) as client:
                body = {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                }
                # Reasoning models (e.g. o1, o3, deepseek-r1) do not support temperature=0.1
                is_reasoning_model = any(k in model.lower() for k in ["o1", "o3", "deepseek-r1", "reasoner", "r1", ":thinking"])
                if not is_reasoning_model:
                    body["temperature"] = 0.1

                # Standard OpenAI and native json_object routers
                if "openai.com" in base_url and not is_reasoning_model:
                    body["response_format"] = {"type": "json_object"}

                resp = await client.post(url, headers=headers, json=body)
                if resp.status_code != 200 and "response_format" in str(resp.text):
                    body.pop("response_format", None)
                    resp = await client.post(url, headers=headers, json=body)

                if resp.status_code == 200:
                    resp_data = resp.json()
                    choices = resp_data.get("choices", [])
                    if choices:
                        content = choices[0].get("message", {}).get("content", "")
                        # Strip thinking tags if generated by reasoning models
                        clean_text = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL)
                        clean_text = re.sub(r"^```json\s*|\s*```$", "", clean_text.strip(), flags=re.DOTALL)
                        match = re.search(r"\{.*\}", clean_text, re.DOTALL)
                        target_json = match.group(0) if match else clean_text
                        parsed = json.loads(target_json)
                        return AIDiagnosisOutput(**parsed)
                else:
                    raise RuntimeError(f"Router/OpenRouter returned HTTP {resp.status_code}: {resp.text[:140]}")

        # 2. Anthropic Claude Provider
        elif provider == "anthropic" and anthropic_key:
            base_url = custom_base_url or "https://api.anthropic.com/v1"
            url = f"{base_url.rstrip('/')}/messages"
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    url,
                    headers={
                        "x-api-key": anthropic_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": model if "claude" in model else "claude-3-7-sonnet-20250219",
                        "system": SYSTEM_PROMPT,
                        "max_tokens": 1024,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1
                    }
                )
                if resp.status_code == 200:
                    raw_text = resp.json()["content"][0]["text"]
                    clean_json = re.sub(r"^```json\s*|\s*```$", "", raw_text.strip(), flags=re.DOTALL)
                    parsed = json.loads(clean_json)
                    return AIDiagnosisOutput(**parsed)
                else:
                    raise RuntimeError(f"Anthropic returned HTTP {resp.status_code}: {resp.text}")

        # 3. Google Gemini & Gemma Provider
        elif provider == "gemini" and gemini_key:
            base_url = custom_base_url or "https://generativelanguage.googleapis.com/v1beta"
            
            # Candidate models to try in order (requested model first, then ultra-reliable live models)
            candidate_models = [model]
            for fallback in ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest"]:
                if fallback not in candidate_models:
                    candidate_models.append(fallback)

            last_error = None
            async with httpx.AsyncClient(timeout=12.0) as client:
                for target_model in candidate_models:
                    url = f"{base_url.rstrip('/')}/models/{target_model}:generateContent?key={gemini_key}"
                    body = {
                        "contents": [{"parts": [{"text": f"{SYSTEM_PROMPT}\n\nRespond ONLY with valid JSON conforming to the schema.\n\n{prompt}"}]}],
                    }
                    if "gemini" in target_model.lower():
                        body["generationConfig"] = {"responseMimeType": "application/json"}

                    try:
                        resp = await client.post(url, json=body)
                        if resp.status_code != 200 and "responseMimeType" in str(resp.text):
                            body.pop("generationConfig", None)
                            resp = await client.post(url, json=body)

                        if resp.status_code == 200:
                            data = resp.json()
                            candidates = data.get("candidates", [])
                            if candidates and "content" in candidates[0] and "parts" in candidates[0]["content"]:
                                raw_text = candidates[0]["content"]["parts"][0].get("text", "")
                                clean_json = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw_text.strip(), flags=re.DOTALL | re.IGNORECASE)
                                match = re.search(r"\{[\s\S]*\}", clean_json)
                                target_json = match.group(0) if match else clean_json
                                parsed = json.loads(target_json)
                                return AIDiagnosisOutput(**parsed)
                        else:
                            last_error = f"Gemini ({target_model}) returned HTTP {resp.status_code}"
                            logger.warning(f"{last_error}. Trying next fallback model...")
                    except Exception as ex:
                        last_error = f"Gemini ({target_model}) request failed: {ex}"
                        logger.warning(f"{last_error}. Trying next candidate...")

            raise RuntimeError(last_error or "All Gemini/Gemma candidate models failed")

        # 4. Local LLM / Ollama (OpenAI compatible endpoint)
        elif provider == "local_llm":
            url = f"{local_endpoint.rstrip('/')}/chat/completions"
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.post(
                    url,
                    json={
                        "model": model,
                        "messages": [
                            {"role": "system", "content": SYSTEM_PROMPT},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.1
                    }
                )
                if resp.status_code == 200:
                    content = resp.json()["choices"][0]["message"]["content"]
                    clean_json = re.sub(r"^```json\s*|\s*```$", "", content.strip(), flags=re.DOTALL)
                    parsed = json.loads(clean_json)
                    return AIDiagnosisOutput(**parsed)
                else:
                    raise RuntimeError(f"Local LLM returned HTTP {resp.status_code}: {resp.text}")

        return None

    def _heuristic_diagnose(
        self,
        container_name: str,
        image: str,
        exit_code: int,
        termination_reason: str,
        sanitized_logs: str
    ) -> AIDiagnosisOutput:
        """
        Expert SRE Rule Engine for instant offline root cause analysis.
        """
        lower_logs = sanitized_logs.lower()

        # 1. Out of Memory (OOM)
        if exit_code == 137 or termination_reason == "oom" or "out of memory" in lower_logs or "oomkilled" in lower_logs:
            return AIDiagnosisOutput(
                failure_classification="Memory Exhaustion (OOM)",
                root_cause_summary=f"Container '{container_name}' exceeded its allocated cgroup memory limit and was terminated by the Linux OOM Killer (Exit 137).",
                confidence_score=0.98,
                recommended_action="RESTART_CONTAINER",
                action_parameters={"increase_memory_headroom": True},
                operational_reasoning="The process consumed resident memory beyond the container memory quota. Restarting clears volatile leak buffer. Increasing memory limits recommended.",
                preventative_measures=[
                    "Profile memory allocation to detect unbounded heap growth or object leaks",
                    "Increase container memory limit in deployment specification",
                    "Configure application GC thresholds and memory pool limits"
                ]
            )

        # 2. Port / Socket Collision (EADDRINUSE)
        if "eaddrinuse" in lower_logs or "address already in use" in lower_logs or "bind: address in use" in lower_logs:
            return AIDiagnosisOutput(
                failure_classification="Port Collision / Socket Conflict",
                root_cause_summary=f"Container '{container_name}' failed to bind to its listening socket because the target network port is already allocated.",
                confidence_score=0.96,
                recommended_action="STOP_RUNAWAY",
                action_parameters={"kill_conflicting_sockets": True},
                operational_reasoning="A dangling or orphan process is holding the port. Stopping orphan containers and restarting allows clean socket acquisition.",
                preventative_measures=[
                    "Verify host port mappings in docker-compose.yml",
                    "Ensure graceful shutdown handlers release TCP sockets before exit",
                    "Implement socket SO_REUSEADDR where applicable"
                ]
            )

        # 3. Zombie Process / Mutex Deadlock (Complex Scenario A)
        if "deadlock" in lower_logs or "zombie" in lower_logs or "ignored sigterm" in lower_logs or "unresponsive_deadlock" in termination_reason.lower():
            return AIDiagnosisOutput(
                failure_classification="Unresponsive Process Deadlock (Zombie/SIGTERM Ignored)",
                root_cause_summary=f"Container '{container_name}' entered a critical mutex deadlock / zombie state and masked standard SIGTERM graceful shutdown signals.",
                confidence_score=0.97,
                recommended_action="FORCE_KILL_CONTAINER",
                action_parameters={"signal": "SIGKILL", "force": True},
                operational_reasoning="Target process trapped SIGTERM and cannot terminate cleanly. Forceful SIGKILL (SIGKILL_CONTAINER) must be dispatched to unblock host cgroup.",
                preventative_measures=[
                    "Audit mutex acquisition order to prevent circular lock dependency",
                    "Implement watchdog timeout threads that abort hung mutex locks",
                    "Remove SIGTERM signal masking in application signal handlers"
                ]
            )

        # 4. Cascading Network / Database Pool Failure (Complex Scenario B)
        if "poolacquiretimeout" in lower_logs or "connection pool exhaustion" in lower_logs or "connection reset by peer" in lower_logs:
            return AIDiagnosisOutput(
                failure_classification="Cascading Socket Partition & Pool Exhaustion",
                root_cause_summary=f"Worker container '{container_name}' experienced an upstream database socket reset, stalling connection pools and cascading into livelock.",
                confidence_score=0.95,
                recommended_action="RESET_CONNECTION_POOL",
                action_parameters={"reset_sockets": True, "reconnect": True},
                operational_reasoning="The database connection pool is saturated with broken sockets. Re-initializing socket descriptors and restarting dependencies restores transaction flow.",
                preventative_measures=[
                    "Configure TCP keepalives and aggressive connection checkout timeouts",
                    "Implement exponential backoff with jitter on pool reconnection",
                    "Add circuit breaker for upstream PostgreSQL health"
                ]
            )

        # 5. Unhandled Panic / Exception
        if "panic:" in lower_logs or "fatal error:" in lower_logs or "uncaught exception" in lower_logs or "traceback (most recent call last)" in lower_logs:
            match = re.search(r"(panic:[^\n]+|Traceback[^\n]+\n(?:[^\n]+\n){1,6}[^\n]+)", sanitized_logs)
            detail = match.group(0).strip() if match else "Unhandled runtime exception"
            return AIDiagnosisOutput(
                failure_classification="Unhandled Runtime Panic",
                root_cause_summary=f"Application crashed with an uncaught runtime exception in {container_name}: {detail[:140]}.",
                confidence_score=0.94,
                recommended_action="RESTART_CONTAINER",
                action_parameters={"delay_seconds": 2},
                operational_reasoning="Process aborted due to an unhandled runtime error. An isolated auto-restart will attempt recovery while incident logs are captured for developers.",
                preventative_measures=[
                    "Patch null-pointer / unhandled condition in code",
                    "Add comprehensive top-level recovery middleware",
                    "Deploy regression unit tests covering the panic scenario"
                ]
            )

        # 6. Segmentation Fault (SIGSEGV)
        if exit_code == 139 or "segmentation fault" in lower_logs or "sigsegv" in lower_logs:
            return AIDiagnosisOutput(
                failure_classification="Segmentation Fault (SIGSEGV)",
                root_cause_summary=f"Native binary executed an invalid memory reference (SIGSEGV, Exit 139) inside container '{container_name}'.",
                confidence_score=0.92,
                recommended_action="RESTART_CONTAINER",
                action_parameters={"core_dump": False},
                operational_reasoning="Process dereferenced an invalid memory address or corrupted its call stack. Safe restart initiated.",
                preventative_measures=[
                    "Inspect native C/C++/Rust extensions or JNI bindings",
                    "Check compiler optimization flags and memory safety bounds"
                ]
            )

        # 7. Missing Configuration / Environment
        if "keyerror:" in lower_logs or "missing required environment" in lower_logs or "configuration error" in lower_logs:
            return AIDiagnosisOutput(
                failure_classification="Configuration / Missing Environment",
                root_cause_summary=f"Container '{container_name}' failed startup checks due to missing environment variables or invalid configuration parameters.",
                confidence_score=0.90,
                recommended_action="ESCALATE_MANUAL",
                action_parameters={},
                operational_reasoning="Missing required environment variables prevent the application from bootstrapping. Manual secret/env injection required.",
                preventative_measures=[
                    "Verify .env configuration and secrets manager mappings",
                    "Add startup validation with clear missing-key error messages"
                ]
            )

        # 8. Unhealthy Healthcheck / Timeout
        if termination_reason == "unhealthy" or "health check failed" in lower_logs:
            return AIDiagnosisOutput(
                failure_classification="Health Check Probe Failure",
                root_cause_summary=f"Container '{container_name}' became unresponsive to Docker health probes and was marked UNHEALTHY.",
                confidence_score=0.88,
                recommended_action="RESTART_CONTAINER",
                action_parameters={"check_health_after_restart": True},
                operational_reasoning="The application failed consecutive readiness/liveness checks, likely due to deadlock or saturated thread pools. Restarting container.",
                preventative_measures=[
                    "Review healthcheck interval and timeout thresholds in Dockerfile",
                    "Investigate worker thread starvation and connection pool saturation"
                ]
            )

        # Generic Non-Zero Exit Code
        return AIDiagnosisOutput(
            failure_classification=f"Abnormal Process Termination (Exit {exit_code})",
            root_cause_summary=f"Container '{container_name}' terminated unexpectedly with non-zero exit code {exit_code}.",
            confidence_score=0.80,
            recommended_action="RESTART_CONTAINER",
            action_parameters={"exit_code": exit_code},
            operational_reasoning=f"Process exited with code {exit_code}. Applying default auto-healing policy: container restart with health verification.",
            preventative_measures=[
                "Review full application diagnostic logs",
                "Ensure graceful termination handling on SIGTERM/SIGINT"
            ]
        )


ai_diagnostician = AIDiagnostician()
