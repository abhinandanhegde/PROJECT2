"""
Intelligence Endpoint Integration Tests

Covers:
  • Triage — deterministic keyword analysis, reporter overrides, edge cases
  • Duplicate Detection — similarity scoring, threshold filtering
  • Risk Analysis — multi-factor scoring, high/low risk scenarios
"""

import pytest
from unittest.mock import patch

from tests.conftest import TEST_PROJECT_ID, TEST_BUG_ID, TEST_USER_ID


# ═══════════════════════════════════════════════════════════════
#  Helpers
# ═══════════════════════════════════════════════════════════════

def _mock_project_member():
    return [{"project_id": TEST_PROJECT_ID, "user_id": TEST_USER_ID, "role": "DEVELOPER"}]


def _patch_role(role="DEVELOPER"):
    return patch("app.routers.intelligence.require_project_role", return_value=role)


# ═══════════════════════════════════════════════════════════════
#  Triage
# ═══════════════════════════════════════════════════════════════

class TestTriage:

    @pytest.mark.asyncio
    async def test_returns_structured_result(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/triage",
                json={"title": "App crashes on login", "description": "Critical production issue"},
            )

        assert resp.status_code == 200
        data = resp.json()
        assert set(data) >= {"suggested_severity", "suggested_priority", "confidence", "reasons", "signals"}
        assert 0.0 <= data["confidence"] <= 1.0
        assert isinstance(data["reasons"], list) and len(data["reasons"]) > 0

    @pytest.mark.asyncio
    async def test_high_severity_keywords(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/triage",
                json={
                    "title": "Security vulnerability allows data loss and system crash",
                    "description": "Critical security issue causing production outage",
                },
            )

        data = resp.json()
        assert data["suggested_severity"] in ("BLOCKER", "CRITICAL")
        assert data["suggested_priority"] in ("P1", "P2")

    @pytest.mark.asyncio
    async def test_trivial_content_gets_low_scores(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/triage",
                json={"title": "Typo in footer", "description": "Minor nit"},
            )

        data = resp.json()
        assert data["suggested_severity"] in ("TRIVIAL", "MINOR", "NORMAL")

    @pytest.mark.asyncio
    async def test_reporter_severity_overrides_engine(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/triage",
                json={
                    "title": "Minor cosmetic issue",
                    "severity": "BLOCKER",
                },
            )

        data = resp.json()
        assert data["suggested_severity"] == "BLOCKER"

    @pytest.mark.asyncio
    async def test_empty_description_signal(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/triage",
                json={"title": "Something broke"},
            )

        data = resp.json()
        assert any("description" in s.lower() or "no description" in s.lower()
                    for s in data["signals"])

    @pytest.mark.asyncio
    async def test_no_auth_returns_401(self, client):
        resp = await client.post(
            f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/triage",
            json={"title": "x"},
        )
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════
#  Duplicate Detection
# ═══════════════════════════════════════════════════════════════

class TestDuplicateDetection:

    @pytest.mark.asyncio
    async def test_similar_bugs_returned(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()
        db._tables["bugs"] = [
            {"id": "b1", "title": "Crash on login", "status": "NEW", "severity": "CRITICAL", "priority": "P1"},
            {"id": "b2", "title": "App crashes when logging in", "status": "CONFIRMED", "severity": "MAJOR", "priority": "P2"},
        ]

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/duplicates",
                json={"title": "Crash during login", "threshold": 0.2},
            )

        data = resp.json()
        assert resp.status_code == 200
        assert isinstance(data["candidates"], list)
        assert data["query_title"] == "Crash during login"
        assert "checked_at" in data

    @pytest.mark.asyncio
    async def test_unrelated_bugs_not_returned(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()
        db._tables["bugs"] = [
            {"id": "b1", "title": "Login page loads slowly", "status": "NEW", "severity": "MINOR", "priority": "P4"},
        ]

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/duplicates",
                json={"title": "Database connection timeout", "threshold": 0.5},
            )

        data = resp.json()
        high = [c for c in data["candidates"] if c["similarity"] > 0.7]
        assert len(high) == 0

    @pytest.mark.asyncio
    async def test_threshold_filters_results(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()
        db._tables["bugs"] = [
            {"id": "b1", "title": "Login page loads slowly", "status": "NEW", "severity": "MINOR", "priority": "P4"},
        ]

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/duplicates",
                json={"title": "Something completely different", "threshold": 0.95},
            )

        data = resp.json()
        for c in data["candidates"]:
            assert c["similarity"] >= 0.95

    @pytest.mark.asyncio
    async def test_no_auth_returns_401(self, client):
        resp = await client.post(
            f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/duplicates",
            json={"title": "x"},
        )
        assert resp.status_code == 401


# ═══════════════════════════════════════════════════════════════
#  Risk Analysis
# ═══════════════════════════════════════════════════════════════

class TestRiskAnalysis:

    @pytest.mark.asyncio
    async def test_high_risk_bug(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()
        db._tables["bugs"] = [{
            "id": TEST_BUG_ID, "project_id": TEST_PROJECT_ID,
            "title": "Critical crash", "status": "REOPENED",
            "severity": "BLOCKER", "priority": "P1",
            "assignee_id": None,
            "created_at": "2025-01-01T00:00:00Z",
            "updated_at": "2025-06-01T00:00:00Z",
        }]
        db._tables["activity_log"] = [
            {"id": "a1", "bug_id": TEST_BUG_ID, "action": "BUG_REOPENED"},
            {"id": "a2", "bug_id": TEST_BUG_ID, "action": "BUG_REOPENED"},
        ]

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/risk",
                json={"bug_id": TEST_BUG_ID},
            )

        data = resp.json()
        assert resp.status_code == 200
        assert data["risk_level"] in ("CRITICAL", "HIGH")
        assert data["risk_score"] >= 50.0
        assert len(data["factors"]) >= 5

    @pytest.mark.asyncio
    async def test_low_risk_bug(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()
        db._tables["bugs"] = [{
            "id": TEST_BUG_ID, "project_id": TEST_PROJECT_ID,
            "title": "Minor typo", "status": "VERIFIED",
            "severity": "TRIVIAL", "priority": "P5",
            "assignee_id": TEST_USER_ID,
            "created_at": "2025-08-20T00:00:00Z",
            "updated_at": "2025-08-27T00:00:00Z",
        }]
        db._tables["activity_log"] = []

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/risk",
                json={"bug_id": TEST_BUG_ID},
            )

        data = resp.json()
        assert data["risk_level"] in ("LOW", "MINIMAL", "MEDIUM")
        assert data["risk_score"] < 50.0

    @pytest.mark.asyncio
    async def test_nonexistent_bug_returns_404(self, auth_client):
        client, db = auth_client
        db._tables["project_members"] = _mock_project_member()
        db._tables["bugs"] = []

        with _patch_role():
            resp = await client.post(
                f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/risk",
                json={"bug_id": "nonexistent"},
            )

        assert resp.status_code == 404

    @pytest.mark.asyncio
    async def test_no_auth_returns_401(self, client):
        resp = await client.post(
            f"/api/intelligence/projects/{TEST_PROJECT_ID}/bugs/risk",
            json={"bug_id": "x"},
        )
        assert resp.status_code == 401
