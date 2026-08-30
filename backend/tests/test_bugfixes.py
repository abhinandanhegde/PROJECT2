"""
Regression tests for audited bug fixes.

Covers:
- create_project: create_project RPC returns a single JSONB object (dict),
  not a list of rows — must not crash on result.data[0].
- PostgREST APIError mapping to meaningful HTTP statuses.
- list_bugs: invalid sort_by / sort_order rejected as 422 (no 500).
- triage: off-vocabulary reporter severity/priority rejected as 422.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from postgrest.exceptions import APIError

from app.exceptions import register_exception_handlers


# ═══════════════════════════════════════════════════════════════
# § 1 — APIError → HTTP status mapping
# ═══════════════════════════════════════════════════════════════


def _api_error_app():
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/boom")
    def boom():
        raise APIError(
            {"code": "42501", "message": "permission denied for table bugs",
             "details": "Not authorized", "hint": None}
        )

    @app.get("/conflict")
    def conflict():
        raise APIError(
            {"code": "23505", "message": 'duplicate key value violates unique constraint',
             "details": "Key (id) already exists", "hint": None}
        )

    @app.get("/unknown")
    def unknown():
        raise APIError(
            {"code": "XX123", "message": "something odd happened",
             "details": "", "hint": None}
        )

    return app


class TestApiErrorMapping:
    def test_rls_permission_denied_maps_to_403(self):
        res = TestClient(_api_error_app()).get("/boom")
        assert res.status_code == 403
        assert "permission denied" in res.json()["detail"]

    def test_unique_violation_maps_to_409(self):
        res = TestClient(_api_error_app()).get("/conflict")
        assert res.status_code == 409

    def test_unknown_code_maps_to_400(self):
        res = TestClient(_api_error_app()).get("/unknown")
        assert res.status_code == 400


# ═══════════════════════════════════════════════════════════════
# § 2 — create_project accepts a single JSONB object
# ═══════════════════════════════════════════════════════════════


def _override(db):
    from app.dependencies import get_current_user_with_client
    from app.auth import get_current_active_user
    from app.main import app

    user = {"id": "11111111-1111-1111-1111-111111111111", "email": "tester@x.dev"}

    async def override_user_with_client():
        return {"user": user, "db": db}

    async def override_active_user():
        return user

    app.dependency_overrides[get_current_user_with_client] = override_user_with_client
    app.dependency_overrides[get_current_active_user] = override_active_user
    return app


class TestCreateProject:
    def test_create_project_handles_single_jsonb_object(self):
        from app.main import app

        db = MagicMock()
        rpc_exec = MagicMock()
        rpc_exec.data = {
            "id": "proj-1",
            "name": "Alpha",
            "description": "First project",
            "created_by": "11111111-1111-1111-1111-111111111111",
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-01-01T00:00:00Z",
        }
        db.rpc.return_value.execute.return_value = rpc_exec

        _override(db)
        try:
            client = TestClient(app)
            res = client.post("/api/projects", json={"name": "Alpha"})
            body = res.json()
            assert res.status_code == 201
            assert body["id"] == "proj-1"
            assert body["name"] == "Alpha"
        finally:
            app.dependency_overrides.clear()


# ═══════════════════════════════════════════════════════════════
# § 3 — list_bugs guards sort parameters
# ═══════════════════════════════════════════════════════════════


def _member_client(role="REPORTER"):
    from app.main import app

    db = MagicMock()
    db.table.return_value.select.return_value.eq.return_value = db.table.return_value.select.return_value

    mem_result = MagicMock()
    mem_result.data = [{"role": role}] if role else []
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = mem_result

    _override(db)
    return TestClient(app)


class TestListBugsSortGuard:
    def test_invalid_sort_by_is_422(self):
        client = _member_client()
        try:
            res = client.get("/api/projects/p1/bugs?sort_by=hacker_col")
            assert res.status_code == 422
        finally:
            from app.main import app
            app.dependency_overrides.clear()

    def test_invalid_sort_order_is_422(self):
        client = _member_client()
        try:
            res = client.get("/api/projects/p1/bugs?sort_order=upwards")
            assert res.status_code == 422
        finally:
            from app.main import app
            app.dependency_overrides.clear()


# ═══════════════════════════════════════════════════════════════
# § 4 — triage rejects off-vocabulary severity/priority
# ═══════════════════════════════════════════════════════════════


class TestTriageInputGuard:
    _PAYLOAD = {
        "title": "Payment gateway crashes when processing",
        "description": "Any failed payment causes a full crash on production.",
    }

    def _reset_limiter(self):
        from app.main import app
        from app.ratelimit import intel_limiter

        app.dependency_overrides.clear()
        intel_limiter.limit = 30
        intel_limiter._hits.clear()

    def test_invalid_severity_is_422(self):
        client = _member_client()
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage",
                json={**self._PAYLOAD, "severity": "EXTREME"},
            )
            assert res.status_code == 422
        finally:
            self._reset_limiter()

    def test_invalid_priority_is_422(self):
        client = _member_client()
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage",
                json={**self._PAYLOAD, "priority": "P0"},
            )
            assert res.status_code == 422
        finally:
            self._reset_limiter()

    def test_valid_severity_is_200(self):
        client = _member_client()
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage",
                json={**self._PAYLOAD, "severity": "CRITICAL", "priority": "P1"},
            )
            assert res.status_code == 200
            body = res.json()
            assert body["suggested_severity"] in {"BLOCKER", "CRITICAL", "MAJOR",
                                                  "NORMAL", "MINOR", "TRIVIAL"}
            assert body["suggested_priority"] in {"P1", "P2", "P3", "P4", "P5"}
        finally:
            self._reset_limiter()