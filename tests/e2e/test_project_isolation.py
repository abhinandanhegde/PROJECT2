"""
Project Isolation Integration Tests

Verifies that intelligence endpoints enforce project-level authorization:
  - Unauthenticated users → 401
  - Users not in the project → 403
  - Users in the project → 200
"""

import pytest
from unittest.mock import patch

from app.exceptions import AuthorizationError
from tests.conftest import TEST_PROJECT_ID, TEST_BUG_ID, TEST_USER_ID


def _auth_error():
    return AuthorizationError("You are not a member of this project")


_INTELLIGENCE_ENDPOINTS = [
    ("/api/intelligence/projects/{pid}/bugs/triage",     {"title": "x"}),
    ("/api/intelligence/projects/{pid}/bugs/duplicates",  {"title": "x"}),
    ("/api/intelligence/projects/{pid}/bugs/risk",        {"bug_id": "x"}),
]


class TestProjectIsolation:

    @pytest.mark.asyncio
    async def test_unauthenticated_users_get_401(self, client):
        """All intelligence endpoints require authentication."""
        for tpl, body in _INTELLIGENCE_ENDPOINTS:
            resp = await client.post(tpl.format(pid=TEST_PROJECT_ID), json=body)
            assert resp.status_code == 401, f"Endpoint {tpl} did not return 401"

    @pytest.mark.asyncio
    async def test_non_members_get_403(self, auth_client):
        """Users who are not project members get 403 on every endpoint."""
        client, _ = auth_client
        for tpl, body in _INTELLIGENCE_ENDPOINTS:
            with patch("app.routers.intelligence.require_project_role", side_effect=_auth_error()):
                resp = await client.post(tpl.format(pid=TEST_PROJECT_ID), json=body)
            assert resp.status_code == 403, f"Endpoint {tpl} did not return 403"

    @pytest.mark.asyncio
    async def test_members_get_200(self, auth_client):
        """Authenticated project members can access intelligence endpoints."""
        client, db = auth_client
        db._tables["bugs"] = [{
            "id": TEST_BUG_ID, "project_id": TEST_PROJECT_ID,
            "title": "x", "status": "NEW", "severity": "NORMAL",
            "priority": "P3", "created_at": "2025-08-01T00:00:00Z",
            "updated_at": "2025-08-27T00:00:00Z",
        }]
        db._tables["activity_log"] = []

        for tpl, body in _INTELLIGENCE_ENDPOINTS:
            with patch("app.routers.intelligence.require_project_role", return_value="DEVELOPER"):
                resp = await client.post(tpl.format(pid=TEST_PROJECT_ID), json=body)
            assert resp.status_code == 200, f"Endpoint {tpl} returned {resp.status_code}"

    @pytest.mark.asyncio
    async def test_cross_project_leakage_prevented(self, auth_client):
        """Authorization is enforced before any data is returned."""
        client, db = auth_client

        # Without project membership, the endpoint must reject the request
        # even if the bug table contains data from other projects.
        with patch("app.routers.intelligence.require_project_role", side_effect=_auth_error()):
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/duplicates",
                json={"title": "Any title", "threshold": 0.1},
            )
        assert resp.status_code == 403
