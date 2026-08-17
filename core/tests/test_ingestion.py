import pytest
import pytest_asyncio
import uuid
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.db.session import engine, Base


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.mark.asyncio
async def test_healthz():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/healthz")
        assert resp.status_code == 200
        assert resp.json()["status"] == "healthy"


@pytest.mark.asyncio
async def test_ingest_and_get_incident():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "id": f"inc_test_{uuid.uuid4().hex[:6]}",
            "container_id": "c_test_123",
            "container_name": "test-redis",
            "image": "redis:7-alpine",
            "exit_code": 137,
            "termination_reason": "oom",
            "sanitized_log": "OOM killed process 1",
            "is_flapping": False,
            "restart_count": 0,
        }
        resp = await client.post("/api/v1/incidents", json=payload)
        assert resp.status_code == 201
        data = resp.json()
        assert data["id"] == payload["id"]
        assert data["status"] == "DETECTED"

        # Fetch incident
        get_resp = await client.get(f"/api/v1/incidents/{payload['id']}")
        assert get_resp.status_code == 200
        assert get_resp.json()["container_name"] == "test-redis"
