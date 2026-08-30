"""
Integration tests for RLS enforcement via the FastAPI app layer.

These tests exercise the real route handlers using TestClient, with only
the auth/DB dependencies overridden (no live Supabase or network required).

Validates:
- Project membership required for triage (RLS simulation at app level)
- Role hierarchy enforcement (REPORTER vs ADMIN)
- Triage endpoint contract / response shape
- Rate limiting on the triage endpoint returns 429 when budget exceeded
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from unittest.mock import MagicMock


# ═══════════════════════════════════════════════════════════════
# Fixtures & helpers
# ═══════════════════════════════════════════════════════════════


def _make_client(membership_role, rl_budget=None):
    """Build a TestClient with overridden auth + DB dependencies."""
    from app.dependencies import get_current_user_with_client
    from app.auth import get_current_active_user
    from app.ratelimit import intel_limiter
    from app.main import app

    user = {"id": "11111111-1111-1111-1111-111111111111", "email": "tester@x.dev"}

    def fake_db():
        db = MagicMock()

        def eq_chain(*args, **kwargs):
            return select

        select = MagicMock()
        select.eq.side_effect = eq_chain
        db.table.return_value.select.return_value = select

        mem_result = MagicMock()
        if membership_role:
            mem_result.data = [{"role": membership_role}]
        else:
            mem_result.data = []
        select.execute.return_value = mem_result
        return db

    async def override_user_with_client():
        return {"user": user, "db": fake_db()}

    async def override_active_user():
        return user

    app.dependency_overrides[get_current_user_with_client] = override_user_with_client
    app.dependency_overrides[get_current_active_user] = override_active_user

    if rl_budget is not None:
        intel_limiter.limit = rl_budget

    client = TestClient(app)
    client.headers["Authorization"] = "Bearer fake-token"
    return client


def _clear_overrides():
    from app.main import app
    from app.ratelimit import intel_limiter

    app.dependency_overrides.clear()
    intel_limiter.limit = 30


_TRIAGE_PAYLOAD = {
    "title": "Payment gateway crashes when processing",
    "description": "Any failed payment causes a full crash on production.",
}


# ═══════════════════════════════════════════════════════════════
# § 1 — RLS: membership required
# ═══════════════════════════════════════════════════════════════


class TestRlsMembershipEnforcement:
    """Non-members must be rejected with 403 on project-scoped routes."""

    def test_non_member_rejected_on_triage(self):
        client = _make_client(membership_role=None)
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage", json=_TRIAGE_PAYLOAD
            )
            assert res.status_code == 403
        finally:
            _clear_overrides()

    def test_member_allowed_on_triage(self):
        client = _make_client(membership_role="REPORTER")
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage", json=_TRIAGE_PAYLOAD
            )
            assert res.status_code == 200
        finally:
            _clear_overrides()

    def test_member_allowed_on_duplicates(self):
        client = _make_client(membership_role="DEVELOPER")
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/duplicates",
                json={"title": "login crash", "description": "crashes on login"},
            )
            assert res.status_code == 200
        finally:
            _clear_overrides()

    def test_non_member_rejected_on_risk_analysis(self):
        client = _make_client(membership_role=None)
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/risk",
                json={"bug_id": "b1"},
            )
            assert res.status_code in (403, 404)
        finally:
            _clear_overrides()


# ═══════════════════════════════════════════════════════════════
# § 2 — Role hierarchy enforcement
# ═══════════════════════════════════════════════════════════════


class TestRoleHierarchy:
    """Higher-privileged routes reject low roles only when required."""

    def test_reporter_can_use_reporter_level_endpoint(self):
        client = _make_client(membership_role="REPORTER")
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage", json=_TRIAGE_PAYLOAD
            )
            assert res.status_code == 200
        finally:
            _clear_overrides()

    def test_admin_can_use_same_endpoint(self):
        client = _make_client(membership_role="ADMIN")
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage", json=_TRIAGE_PAYLOAD
            )
            assert res.status_code == 200
        finally:
            _clear_overrides()


# ═══════════════════════════════════════════════════════════════
# § 3 — Triage endpoint contract (response shape)
# ═══════════════════════════════════════════════════════════════


class TestTriageEndpointContract:
    """Successful triage returns the documented response model."""

    def test_triage_returns_suggested_values(self):
        client = _make_client(membership_role="REPORTER")
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage", json=_TRIAGE_PAYLOAD
            )
            body = res.json()
            assert res.status_code == 200
            assert body.get("suggested_severity") in {
                "BLOCKER", "CRITICAL", "MAJOR", "NORMAL", "MINOR", "TRIVIAL",
            }
            assert body.get("suggested_priority") in {"P1", "P2", "P3", "P4", "P5"}
            assert isinstance(body.get("confidence", 0), (int, float))
        finally:
            _clear_overrides()

    def test_triage_rejects_empty_title(self):
        client = _make_client(membership_role="REPORTER")
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage",
                json={"title": "", "description": ""},
            )
            assert res.status_code == 422
        finally:
            _clear_overrides()


# ═══════════════════════════════════════════════════════════════
# § 4 — Rate limiting on triage
# ═══════════════════════════════════════════════════════════════


class TestRateLimit:
    """Exceeding the budget returns 429."""

    def test_rate_limit_returns_429(self):
        client = _make_client(membership_role="REPORTER", rl_budget=0)
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage", json=_TRIAGE_PAYLOAD
            )
            assert res.status_code == 429
        finally:
            _clear_overrides()

    def test_rate_limit_allows_under_budget(self):
        client = _make_client(membership_role="REPORTER", rl_budget=10)
        try:
            res = client.post(
                "/api/intelligence/projects/p1/bugs/triage", json=_TRIAGE_PAYLOAD
            )
            assert res.status_code == 200
        finally:
            _clear_overrides()

    def test_health_detail_includes_request_id(self):
        from app.main import app
        client = TestClient(app)
        res = client.get("/health/detail")
        assert res.status_code == 200
        body = res.json()
        assert body["status"] == "ok"
        assert "version" in body
        assert "request_id" in body