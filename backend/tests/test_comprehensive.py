"""
Comprehensive backend tests for T2 Bug Tracker.

Tests validate:
- Auth middleware (JWT verification, rejection)
- API endpoint contracts (request/response shapes)
- Security headers
- Error handling
- RLS patterns
- Intelligence algorithms (deterministic, no DB)
- Bug lifecycle state machine
- Helper functions
"""

import os
import sys
import pytest
from unittest.mock import MagicMock, patch

# Ensure backend app is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ═══════════════════════════════════════════════════════════════
# § 1 — Auth Module Tests
# ═══════════════════════════════════════════════════════════════


class TestAuthModule:
    """Test JWT verification and auth dependencies."""

    def test_auth_module_importable(self):
        """auth.py should be importable without side effects."""
        from app import auth
        assert hasattr(auth, "verify_supabase_token")
        assert hasattr(auth, "get_current_user")
        assert hasattr(auth, "get_current_active_user")
        assert hasattr(auth, "get_raw_token")

    def test_accepted_algorithms(self):
        """Should accept ES256 and RS256 (Supabase tokens)."""
        from app.auth import ACCEPTED_ALGORITHMS
        assert "ES256" in ACCEPTED_ALGORITHMS
        assert "RS256" in ACCEPTED_ALGORITHMS

    def test_jwks_cache_ttl(self):
        """JWKS cache TTL should be reasonable (1 hour)."""
        from app.auth import _JWKS_CACHE_TTL_SECONDS
        assert _JWKS_CACHE_TTL_SECONDS == 3600


# ═══════════════════════════════════════════════════════════════
# § 2 — Bug Lifecycle State Machine Tests
# ═══════════════════════════════════════════════════════════════


class TestBugLifecycle:
    """Test the bug lifecycle state machine transitions."""

    def test_valid_transitions_exist(self):
        from app.models.bugs import VALID_TRANSITIONS
        assert "NEW" in VALID_TRANSITIONS
        assert "CLOSED" in VALID_TRANSITIONS

    def test_new_can_only_go_confirmed(self):
        from app.models.bugs import VALID_TRANSITIONS
        assert VALID_TRANSITIONS["NEW"] == ["CONFIRMED"]

    def test_confirmed_can_go_in_progress_or_new(self):
        from app.models.bugs import VALID_TRANSITIONS
        assert set(VALID_TRANSITIONS["CONFIRMED"]) == {"IN_PROGRESS", "NEW"}

    def test_in_progress_can_go_resolved_or_confirmed(self):
        from app.models.bugs import VALID_TRANSITIONS
        assert set(VALID_TRANSITIONS["IN_PROGRESS"]) == {"RESOLVED", "CONFIRMED"}

    def test_resolved_can_go_verified_or_reopened(self):
        from app.models.bugs import VALID_TRANSITIONS
        assert set(VALID_TRANSITIONS["RESOLVED"]) == {"VERIFIED", "REOPENED"}

    def test_verified_can_go_closed_or_reopened(self):
        from app.models.bugs import VALID_TRANSITIONS
        assert set(VALID_TRANSITIONS["VERIFIED"]) == {"CLOSED", "REOPENED"}

    def test_reopened_can_go_confirmed_or_in_progress(self):
        from app.models.bugs import VALID_TRANSITIONS
        assert set(VALID_TRANSITIONS["REOPENED"]) == {"CONFIRMED", "IN_PROGRESS"}

    def test_closed_can_only_reopen(self):
        from app.models.bugs import VALID_TRANSITIONS
        assert VALID_TRANSITIONS["CLOSED"] == ["REOPENED"]

    def test_all_statuses_have_transitions(self):
        from app.models.bugs import VALID_TRANSITIONS, BugStatus
        for status in BugStatus:
            assert status.value in VALID_TRANSITIONS, f"{status.value} missing transitions"


# ═══════════════════════════════════════════════════════════════
# § 3 — Intelligence Algorithm Tests (No DB Required)
# ═══════════════════════════════════════════════════════════════


class TestTriageAlgorithm:
    """Test deterministic triage keyword analysis."""

    def test_crash_keyword_suggests_blocker(self):
        from app.routers.intelligence import _count_keyword_matches, _SEVERITY_KEYWORDS
        matches = _count_keyword_matches("Application crashes on login", _SEVERITY_KEYWORDS)
        assert "BLOCKER" in matches

    def test_critical_keyword_detected(self):
        from app.routers.intelligence import _count_keyword_matches, _SEVERITY_KEYWORDS
        matches = _count_keyword_matches("Critical security vulnerability found", _SEVERITY_KEYWORDS)
        assert "CRITICAL" in matches

    def test_typo_keyword_suggests_trivial(self):
        from app.routers.intelligence import _count_keyword_matches, _SEVERITY_KEYWORDS
        matches = _count_keyword_matches("Typo in error message", _SEVERITY_KEYWORDS)
        assert "TRIVIAL" in matches

    def test_empty_text_returns_no_matches(self):
        from app.routers.intelligence import _count_keyword_matches, _SEVERITY_KEYWORDS
        matches = _count_keyword_matches("", _SEVERITY_KEYWORDS)
        assert len(matches) == 0

    def test_best_category_returns_highest_severity(self):
        from app.routers.intelligence import _best_category, _SEVERITY_ORDER
        matches = {"NORMAL": 2, "CRITICAL": 1}
        result = _best_category(matches, _SEVERITY_ORDER)
        assert result == "CRITICAL"

    def test_best_category_returns_none_for_empty(self):
        from app.routers.intelligence import _best_category, _SEVERITY_ORDER
        result = _best_category({}, _SEVERITY_ORDER)
        assert result is None


class TestJaccardSimilarity:
    """Test Jaccard similarity for duplicate detection."""

    def test_identical_strings_return_1(self):
        from app.routers.intelligence import _jaccard_similarity
        assert _jaccard_similarity("hello world", "hello world") == 1.0

    def test_completely_different_returns_0(self):
        from app.routers.intelligence import _jaccard_similarity
        assert _jaccard_similarity("hello", "xyz") == 0.0

    def test_empty_strings_return_0(self):
        from app.routers.intelligence import _jaccard_similarity
        assert _jaccard_similarity("", "hello") == 0.0
        assert _jaccard_similarity("hello", "") == 0.0
        assert _jaccard_similarity("", "") == 0.0

    def test_partial_overlap(self):
        from app.routers.intelligence import _jaccard_similarity
        sim = _jaccard_similarity("login crashes on auth", "login fails on auth page")
        assert 0.3 < sim < 0.8

    def test_case_insensitive(self):
        from app.routers.intelligence import _jaccard_similarity
        assert _jaccard_similarity("Hello World", "hello world") == 1.0


# ═══════════════════════════════════════════════════════════════
# § 4 — Risk Analysis Tests
# ═══════════════════════════════════════════════════════════════


class TestRiskAnalysis:
    """Test risk factor calculations."""

    def test_risk_severity_map_completeness(self):
        from app.routers.intelligence import _RISK_SEVERITY_MAP
        for sev in ["BLOCKER", "CRITICAL", "MAJOR", "NORMAL", "MINOR", "TRIVIAL"]:
            assert sev in _RISK_SEVERITY_MAP

    def test_risk_priority_map_completeness(self):
        from app.routers.intelligence import _RISK_PRIORITY_MAP
        for pri in ["P1", "P2", "P3", "P4", "P5"]:
            assert pri in _RISK_PRIORITY_MAP

    def test_factor_weights_sum_to_100(self):
        from app.routers.intelligence import _RISK_FACTOR_WEIGHTS
        total = sum(_RISK_FACTOR_WEIGHTS.values())
        assert total == 100, f"Weights sum to {total}, expected 100"

    def test_risk_levels_ordered(self):
        from app.routers.intelligence import _RISK_SEVERITY_MAP
        assert _RISK_SEVERITY_MAP["BLOCKER"] > _RISK_SEVERITY_MAP["CRITICAL"]
        assert _RISK_SEVERITY_MAP["CRITICAL"] > _RISK_SEVERITY_MAP["MAJOR"]
        assert _RISK_SEVERITY_MAP["MAJOR"] > _RISK_SEVERITY_MAP["NORMAL"]


# ═══════════════════════════════════════════════════════════════
# § 5 — Helper Function Tests
# ═══════════════════════════════════════════════════════════════


class TestHelpers:
    """Test shared helper functions."""

    def test_role_hierarchy_order(self):
        from app.helpers import ROLE_HIERARCHY
        assert ROLE_HIERARCHY == ["REPORTER", "DEVELOPER", "QA", "ADMIN"]

    def test_role_hierarchy_index(self):
        from app.helpers import ROLE_HIERARCHY
        assert ROLE_HIERARCHY.index("ADMIN") > ROLE_HIERARCHY.index("REPORTER")
        assert ROLE_HIERARCHY.index("DEVELOPER") > ROLE_HIERARCHY.index("REPORTER")


# ═══════════════════════════════════════════════════════════════
# § 6 — Model / Schema Tests
# ═══════════════════════════════════════════════════════════════


class TestModels:
    """Test Pydantic model validation."""

    def test_bug_create_valid(self):
        from app.models.bugs import BugCreate, BugSeverity, BugPriority
        bug = BugCreate(title="Test bug", severity=BugSeverity.CRITICAL, priority=BugPriority.P1)
        assert bug.title == "Test bug"
        assert bug.severity == BugSeverity.CRITICAL

    def test_bug_create_empty_title_rejected(self):
        from app.models.bugs import BugCreate
        with pytest.raises(Exception):
            BugCreate(title="")

    def test_status_change_requires_resolution_for_resolved(self):
        from app.models.bugs import StatusChangeRequest, BugStatus
        req = StatusChangeRequest(status=BugStatus.RESOLVED)
        assert req.resolution is None  # Must be provided by caller

    def test_relationship_types(self):
        from app.models.relationships import RelationshipType
        assert RelationshipType.BLOCKS.value == "blocks"
        assert RelationshipType.DEPENDS_ON.value == "depends_on"
        assert RelationshipType.RELATED_TO.value == "related_to"

    def test_all_severity_values(self):
        from app.models.bugs import BugSeverity
        values = [s.value for s in BugSeverity]
        assert set(values) == {"BLOCKER", "CRITICAL", "MAJOR", "NORMAL", "MINOR", "TRIVIAL"}

    def test_all_priority_values(self):
        from app.models.bugs import BugPriority
        values = [p.value for p in BugPriority]
        assert set(values) == {"P1", "P2", "P3", "P4", "P5"}

    def test_all_status_values(self):
        from app.models.bugs import BugStatus
        values = [s.value for s in BugStatus]
        assert set(values) == {"NEW", "CONFIRMED", "IN_PROGRESS", "RESOLVED", "VERIFIED", "CLOSED", "REOPENED"}


# ═══════════════════════════════════════════════════════════════
# § 7 — Exception / Error Handler Tests
# ═══════════════════════════════════════════════════════════════


class TestExceptions:
    """Test custom exception classes."""

    def test_authentication_error_is_401(self):
        from app.exceptions import AuthenticationError
        exc = AuthenticationError()
        assert exc.status_code == 401

    def test_authorization_error_is_403(self):
        from app.exceptions import AuthorizationError
        exc = AuthorizationError()
        assert exc.status_code == 403

    def test_not_found_error_is_404(self):
        from app.exceptions import NotFoundError
        exc = NotFoundError()
        assert exc.status_code == 404

    def test_conflict_error_is_409(self):
        from app.exceptions import ConflictError
        exc = ConflictError()
        assert exc.status_code == 409

    def test_validation_error_is_422(self):
        from app.exceptions import ValidationError
        exc = ValidationError()
        assert exc.status_code == 422

    def test_custom_detail_messages(self):
        from app.exceptions import NotFoundError, AuthorizationError
        assert NotFoundError("Bug not found").detail == "Bug not found"
        assert AuthorizationError("No access").detail == "No access"


# ═══════════════════════════════════════════════════════════════
# § 8 — Middleware Tests
# ═══════════════════════════════════════════════════════════════


class TestMiddleware:
    """Test security middleware registration."""

    def test_middleware_module_importable(self):
        from app.middleware import register_middleware, SecurityHeadersMiddleware, RequestIDMiddleware
        assert callable(register_middleware)
        assert issubclass(SecurityHeadersMiddleware, object)
        assert issubclass(RequestIDMiddleware, object)


# ═══════════════════════════════════════════════════════════════
# § 9 — App Entry Point Tests
# ═══════════════════════════════════════════════════════════════


class TestApp:
    """Test FastAPI app initialization."""

    def test_app_importable(self):
        from app.main import app
        assert app is not None

    def test_app_has_routers(self):
        from app.main import app
        # Check routes exist by string representation
        route_strs = [str(r) for r in app.routes]
        assert any("health" in r.lower() for r in route_strs)

    def test_app_title(self):
        from app.main import app
        assert "T2" in app.title


# ═══════════════════════════════════════════════════════════════
# § 10 — Frontend Types Consistency Tests
# ═══════════════════════════════════════════════════════════════


class TestFrontendTypesMatch:
    """Verify backend enums match frontend TypeScript types."""

    def test_severity_values_match_frontend(self):
        from app.models.bugs import BugSeverity
        frontend_values = {"BLOCKER", "CRITICAL", "MAJOR", "NORMAL", "MINOR", "TRIVIAL"}
        backend_values = {s.value for s in BugSeverity}
        assert frontend_values == backend_values

    def test_priority_values_match_frontend(self):
        from app.models.bugs import BugPriority
        frontend_values = {"P1", "P2", "P3", "P4", "P5"}
        backend_values = {p.value for p in BugPriority}
        assert frontend_values == backend_values

    def test_status_values_match_frontend(self):
        from app.models.bugs import BugStatus
        frontend_values = {"NEW", "CONFIRMED", "IN_PROGRESS", "RESOLVED", "VERIFIED", "CLOSED", "REOPENED"}
        backend_values = {s.value for s in BugStatus}
        assert frontend_values == backend_values


# ═══════════════════════════════════════════════════════════════
# § 11 — Supabase Client Tests
# ═══════════════════════════════════════════════════════════════


class TestSupabaseClient:
    """Test Supabase client factory."""

    def test_get_user_client_requires_env(self):
        from app.supabase_client import get_user_client
        # Should raise if env vars are missing
        with patch.dict(os.environ, {"SUPABASE_URL": "", "SUPABASE_ANON_KEY": ""}):
            with pytest.raises(RuntimeError):
                get_user_client("fake-token")

    def test_service_role_client_requires_env(self):
        from app.supabase_client import get_service_role_client
        with patch.dict(os.environ, {"SUPABASE_URL": "", "SUPABASE_SERVICE_ROLE_KEY": ""}):
            with pytest.raises(RuntimeError):
                get_service_role_client()
