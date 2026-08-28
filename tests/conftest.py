"""
Test Configuration — Shared Fixtures & Mock Infrastructure

Provides a lightweight mock Supabase client and FastAPI test client
so that integration tests can run without a live database.
"""

from __future__ import annotations

import os
import sys
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# Make `from app.xxx` imports resolve (matching existing code style)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# ── Deterministic test IDs ──────────────────────────────────
TEST_USER_ID  = "00000000-0000-0000-0000-000000000001"
TEST_USER_ID_2 = "00000000-0000-0000-0000-000000000002"
TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000001"
TEST_BUG_ID     = "00000000-0000-0000-0000-000000000001"


# ═══════════════════════════════════════════════════════════════
#  Mock Supabase Client
# ═══════════════════════════════════════════════════════════════

class _QueryBuilder:
    """
    Chainable mock that mirrors the Supabase Python SDK query-builder API.
    Every terminal method (.execute()) returns a MagicMock with `.data` and `.count`.
    """

    def __init__(self, data=None, count=None):
        self._data = data or []
        self._count = count if count is not None else len(self._data)

    # ── chainable filters (all return self) ────────────────
    def select(self, *a, count=None):       return self
    def eq(self, _f, _v):                   return self
    def neq(self, _f, _v):                  return self
    def ilike(self, _f, _v):                return self
    def in_(self, _f, _v):                  return self
    def gte(self, _f, _v):                  return self
    def or_(self, _c):                      return self
    def order(self, *a, **kw):              return self
    def range(self, *a):                    return self
    def limit(self, *a):                    return self

    # ── terminal ───────────────────────────────────────────
    def execute(self):
        m = MagicMock()
        m.data  = self._data
        m.count = self._count
        return m

    # ── write stubs ────────────────────────────────────────
    def insert(self, _d):   return self
    def update(self, _d):   return self
    def upsert(self, _d, **kw): return self
    def delete(self):       return self


class MockSupabaseClient:
    """Deterministic fake for `supabase.Client` used in tests."""

    def __init__(self, tables: dict | None = None):
        self._tables = tables or {}
        self._rpc_results: dict[str, list] = {}

    def table(self, name: str) -> _QueryBuilder:
        qb = _QueryBuilder(self._tables.get(name))
        return qb

    def rpc(self, fn: str, _params=None) -> _QueryBuilder:
        return _QueryBuilder(self._rpc_results.get(fn))

    def set_rpc(self, fn: str, data: list):
        self._rpc_results[fn] = data


# ═══════════════════════════════════════════════════════════════
#  Fixtures
# ═══════════════════════════════════════════════════════════════

@pytest.fixture
def mock_db() -> MockSupabaseClient:
    return MockSupabaseClient()


@pytest_asyncio.fixture
async def client():
    """Un-authenticated async test client."""
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def auth_client():
    """
    Authenticated async test client with a fully mocked Supabase backend.

    Yields (client, mock_db) so tests can configure mock data.
    """
    from app.main import app
    from app import dependencies

    db = MockSupabaseClient()

    async def _override():
        return {
            "user": {"id": TEST_USER_ID, "email": "test@example.com", "role": "authenticated"},
            "db": db,
        }

    app.dependency_overrides[dependencies.get_current_user_with_client] = _override

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac, db

    app.dependency_overrides.clear()
