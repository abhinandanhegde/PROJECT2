"""
Authentication Integration Tests

Verifies that all protected endpoints enforce JWT authentication:
  - Missing token  → 401
  - Invalid token  → 401
  - Malformed header → 401
  - Health check (public) → 200
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_missing_token_returns_401(client: AsyncClient):
    resp = await client.get("/api/projects/x/bugs")
    assert resp.status_code == 401
    assert "detail" in resp.json()


@pytest.mark.asyncio
async def test_invalid_token_returns_401(client: AsyncClient):
    resp = await client.get("/api/projects/x/bugs", headers={"Authorization": "Bearer garbage"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_malformed_header_returns_401(client: AsyncClient):
    resp = await client.get("/api/projects/x/bugs", headers={"Authorization": "NotBearer x"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_empty_bearer_returns_401(client: AsyncClient):
    resp = await client.get("/api/projects/x/bugs", headers={"Authorization": "Bearer "})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_health_endpoint_requires_no_auth(client: AsyncClient):
    resp = await client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
