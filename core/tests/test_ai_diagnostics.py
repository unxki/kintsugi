import pytest
import pytest_asyncio
from app.schemas.diagnosis import AIDiagnosisOutput
from app.services.ai_diagnostician import ai_diagnostician
from app.services.embedding_service import embedding_service


@pytest.mark.asyncio
async def test_oom_heuristic_diagnosis():
    diagnosis = await ai_diagnostician.diagnose_incident(
        container_name="prod-worker-1",
        image="worker:latest",
        exit_code=137,
        termination_reason="oom",
        sanitized_logs="Fatal: Out of memory. cgroup memory controller invoked oom-killer for PID 4210",
        is_flapping=False,
        restart_count=0
    )
    assert isinstance(diagnosis, AIDiagnosisOutput)
    assert "Memory Exhaustion" in diagnosis.failure_classification
    assert diagnosis.recommended_action == "RESTART_CONTAINER"
    assert diagnosis.confidence_score >= 0.9


@pytest.mark.asyncio
async def test_panic_heuristic_diagnosis():
    diagnosis = await ai_diagnostician.diagnose_incident(
        container_name="auth-api",
        image="auth:v1",
        exit_code=2,
        termination_reason="die",
        sanitized_logs="panic: runtime error: invalid memory address or nil pointer dereference",
        is_flapping=False,
        restart_count=0
    )
    assert isinstance(diagnosis, AIDiagnosisOutput)
    assert "Unhandled Runtime Panic" in diagnosis.failure_classification
    assert diagnosis.recommended_action == "RESTART_CONTAINER"
    assert diagnosis.confidence_score >= 0.9


@pytest.mark.asyncio
async def test_flapping_circuit_breaker_diagnosis():
    diagnosis = await ai_diagnostician.diagnose_incident(
        container_name="flapping-service",
        image="broken:v1",
        exit_code=1,
        termination_reason="die",
        sanitized_logs="Crash log",
        is_flapping=True,
        restart_count=5
    )
    assert isinstance(diagnosis, AIDiagnosisOutput)
    assert "Flapping" in diagnosis.failure_classification
    assert diagnosis.recommended_action == "ESCALATE_MANUAL"
    assert diagnosis.confidence_score >= 0.95


def test_embedding_cosine_similarity():
    log1 = "panic: runtime error: nil pointer dereference at auth/signer.go:42"
    log2 = "panic: runtime error: nil pointer dereference at auth/verifier.go:88"
    log_unrelated = "cgroup memory controller invoked oom-killer"

    emb1 = embedding_service.generate_embedding(log1)
    emb2 = embedding_service.generate_embedding(log2)
    emb_diff = embedding_service.generate_embedding(log_unrelated)

    sim_similar = embedding_service.cosine_similarity(emb1, emb2)
    sim_diff = embedding_service.cosine_similarity(emb1, emb_diff)

    assert sim_similar > sim_diff
    assert sim_similar > 0.6
