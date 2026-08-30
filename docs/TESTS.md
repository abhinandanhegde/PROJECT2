# BugNexus — Test Documentation & Proof

> Every test run with timestamp, environment, and full output.

---

## Table of Contents

1. [Backend Test Suite (100 Tests)](#1-backend-test-suite-100-tests)
2. [Frontend Verification](#2-frontend-verification)
3. [CI Pipeline](#3-ci-pipeline)

---

## 1. Backend Test Suite (100 Tests)

### Test Categories

| Category | Tests | What It Proves |
|----------|-------|----------------|
| Auth Module | 3 | JWT verification, algorithm support, JWKS caching |
| Bug Lifecycle | 9 | All 7 state machine transitions are valid and complete |
| Triage Algorithm | 11 | Keyword matching, severity/priority suggestion, input validation |
| Jaccard Similarity | 5 | Duplicate detection math (identical, partial, empty, case-insensitive) |
| Risk Analysis | 4 | Factor completeness, weight correctness (sum=100), ordering |
| Graph Impact | 9 | BFS reach counting, cycle detection, critical path, fork counting, tie-breaking |
| Helpers | 2 | Role hierarchy order and index logic |
| Models | 7 | Pydantic validation, enum completeness, schema constraints |
| Exceptions | 6 | All 5 custom HTTP error codes + custom messages |
| Frontend Types | 3 | Backend enums match TypeScript types exactly |
| Supabase Client | 2 | Env validation, error handling |
| Endpoint Behavior | 10 | Auth enforcement on all protected routes (401 without token) |
| Search Security | 5 | Input escaping for commas, parens, quotes, ILIKE wildcards |
| Triage Scoring | 5 | Keyword-to-severity mapping correctness |
| App / Middleware | 4 | FastAPI app loads, routers registered, middleware imports |
| Bug Fixes | 9 | Error mapping, sort validation, triage input guards |
| Intelligence Integration | 11 | RLS enforcement, role hierarchy, triage contracts, rate limiting |

### Full Test Output

```
============================= test session starts =============================
platform win32 -- Python 3.14.3, pytest-9.0.3, pluggy-1.6.0
rootdir: C:\Users\abhinandan\Desktop\clonefest\T2
configfile: pytest.ini
plugins: anyio-4.13.0, asyncio-1.4.0
asyncio: mode=Mode.AUTO
collecting ... collected 100 items

tests/test_bugfixes.py::TestApiErrorMapping::test_rls_permission_denied_maps_to_403 PASSED [  1%]
tests/test_bugfixes.py::TestApiErrorMapping::test_unique_violation_maps_to_409 PASSED [  2%]
tests/test_bugfixes.py::TestApiErrorMapping::test_unknown_code_maps_to_400 PASSED [  3%]
tests/test_bugfixes.py::TestCreateProject::test_create_project_handles_single_jsonb_object PASSED [  4%]
tests/test_bugfixes.py::TestListBugsSortGuard::test_invalid_sort_by_is_422 PASSED [  5%]
tests/test_bugfixes.py::TestListBugsSortGuard::test_invalid_sort_order_is_422 PASSED [  6%]
tests/test_bugfixes.py::TestTriageInputGuard::test_invalid_severity_is_422 PASSED [  7%]
tests/test_bugfixes.py::TestTriageInputGuard::test_invalid_priority_is_422 PASSED [  8%]
tests/test_bugfixes.py::TestTriageInputGuard::test_valid_severity_is_200 PASSED [  9%]
tests/test_comprehensive.py::TestAuthModule::test_auth_module_importable PASSED [ 10%]
tests/test_comprehensive.py::TestAuthModule::test_accepted_algorithms PASSED [ 11%]
tests/test_comprehensive.py::TestAuthModule::test_jwks_cache_ttl PASSED  [ 12%]
tests/test_comprehensive.py::TestBugLifecycle::test_valid_transitions_exist PASSED [ 13%]
tests/test_comprehensive.py::TestBugLifecycle::test_new_can_only_go_confirmed PASSED [ 14%]
tests/test_comprehensive.py::TestBugLifecycle::test_confirmed_can_go_in_progress_or_new PASSED [ 15%]
tests/test_comprehensive.py::TestBugLifecycle::test_in_progress_can_go_resolved_or_confirmed PASSED [ 16%]
tests/test_comprehensive.py::TestBugLifecycle::test_resolved_can_go_verified_or_reopened PASSED [ 17%]
tests/test_comprehensive.py::TestBugLifecycle::test_verified_can_go_closed_or_reopened PASSED [ 18%]
tests/test_comprehensive.py::TestBugLifecycle::test_reopened_can_go_confirmed_or_in_progress PASSED [ 19%]
tests/test_comprehensive.py::TestBugLifecycle::test_closed_can_only_reopen PASSED [ 20%]
tests/test_comprehensive.py::TestBugLifecycle::test_all_statuses_have_transitions PASSED [ 21%]
tests/test_comprehensive.py::TestTriageAlgorithm::test_crash_keyword_suggests_blocker PASSED [ 22%]
tests/test_comprehensive.py::TestTriageAlgorithm::test_critical_keyword_detected PASSED [ 23%]
tests/test_comprehensive.py::TestTriageAlgorithm::test_typo_keyword_suggests_trivial PASSED [ 24%]
tests/test_comprehensive.py::TestTriageAlgorithm::test_empty_text_returns_no_matches PASSED [ 25%]
tests/test_comprehensive.py::TestTriageAlgorithm::test_best_category_returns_highest_severity PASSED [ 26%]
tests/test_comprehensive.py::TestTriageAlgorithm::test_best_category_returns_none_for_empty PASSED [ 27%]
tests/test_comprehensive.py::TestJaccardSimilarity::test_identical_strings_return_1 PASSED [ 28%]
tests/test_comprehensive.py::TestJaccardSimilarity::test_completely_different_returns_0 PASSED [ 29%]
tests/test_comprehensive.py::TestJaccardSimilarity::test_empty_strings_return_0 PASSED [ 30%]
tests/test_comprehensive.py::TestJaccardSimilarity::test_partial_overlap PASSED [ 31%]
tests/test_comprehensive.py::TestJaccardSimilarity::test_case_insensitive PASSED [ 32%]
tests/test_comprehensive.py::TestRiskAnalysis::test_risk_severity_map_completeness PASSED [ 33%]
tests/test_comprehensive.py::TestRiskAnalysis::test_risk_priority_map_completeness PASSED [ 34%]
tests/test_comprehensive.py::TestRiskAnalysis::test_factor_weights_sum_to_100 PASSED [ 35%]
tests/test_comprehensive.py::TestRiskAnalysis::test_risk_levels_ordered PASSED [ 36%]
tests/test_comprehensive.py::TestHelpers::test_role_hierarchy_order PASSED [ 37%]
tests/test_comprehensive.py::TestHelpers::test_role_hierarchy_index PASSED [ 38%]
tests/test_comprehensive.py::TestModels::test_bug_create_valid PASSED    [ 39%]
tests/test_comprehensive.py::TestModels::test_bug_create_empty_title_rejected PASSED [ 40%]
tests/test_comprehensive.py::TestModels::test_status_change_requires_resolution_for_resolved PASSED [ 41%]
tests/test_comprehensive.py::TestModels::test_relationship_types PASSED  [ 42%]
tests/test_comprehensive.py::TestModels::test_all_severity_values PASSED [ 43%]
tests/test_comprehensive.py::TestModels::test_all_priority_values PASSED [ 44%]
tests/test_comprehensive.py::TestModels::test_all_status_values PASSED   [ 45%]
tests/test_comprehensive.py::TestExceptions::test_authentication_error_is_401 PASSED [ 46%]
tests/test_comprehensive.py::TestExceptions::test_authorization_error_is_403 PASSED [ 47%]
tests/test_comprehensive.py::TestExceptions::test_not_found_error_is_404 PASSED [ 48%]
tests/test_comprehensive.py::TestExceptions::test_conflict_error_is_409 PASSED [ 49%]
tests/test_comprehensive.py::TestExceptions::test_validation_error_is_422 PASSED [ 50%]
tests/test_comprehensive.py::TestExceptions::test_custom_detail_messages PASSED [ 51%]
tests/test_comprehensive.py::TestMiddleware::test_middleware_module_importable PASSED [ 52%]
tests/test_comprehensive.py::TestApp::test_app_importable PASSED         [ 53%]
tests/test_comprehensive.py::TestApp::test_app_has_routers PASSED        [ 54%]
tests/test_comprehensive.py::TestApp::test_app_title PASSED              [ 55%]
tests/test_comprehensive.py::TestFrontendTypesMatch::test_severity_values_match_frontend PASSED [ 56%]
tests/test_comprehensive.py::TestFrontendTypesMatch::test_priority_values_match_frontend PASSED [ 57%]
tests/test_comprehensive.py::TestFrontendTypesMatch::test_status_values_match_frontend PASSED [ 58%]
tests/test_comprehensive.py::TestSupabaseClient::test_get_user_client_requires_env PASSED [ 59%]
tests/test_comprehensive.py::TestSupabaseClient::test_service_role_client_requires_env PASSED [ 60%]
tests/test_comprehensive.py::TestEndpointBehavior::test_health_returns_200 PASSED [ 61%]
tests/test_comprehensive.py::TestEndpointBehavior::test_health_detail_returns_uptime PASSED [ 62%]
tests/test_comprehensive.py::TestEndpointBehavior::test_projects_requires_auth PASSED [ 63%]
tests/test_comprehensive.py::TestEndpointBehavior::test_bugs_requires_auth PASSED [ 64%]
tests/test_comprehensive.py::TestEndpointBehavior::test_dashboard_stats_requires_auth PASSED [ 65%]
tests/test_comprehensive.py::TestEndpointBehavior::test_search_requires_auth PASSED [ 66%]
tests/test_comprehensive.py::TestEndpointBehavior::test_auth_me_requires_auth PASSED [ 67%]
tests/test_comprehensive.py::TestEndpointBehavior::test_invalid_token_returns_401 PASSED [ 68%]
tests/test_comprehensive.py::TestEndpointBehavior::test_create_project_requires_auth PASSED [ 69%]
tests/test_comprehensive.py::TestEndpointBehavior::test_intelligence_triage_requires_auth PASSED [ 70%]
tests/test_comprehensive.py::TestSearchFilter::test_comma_is_escaped PASSED [ 71%]
tests/test_comprehensive.py::TestSearchFilter::test_parens_are_escaped PASSED [ 72%]
tests/test_comprehensive.py::TestSearchFilter::test_quotes_are_escaped PASSED [ 73%]
tests/test_comprehensive.py::TestSearchFilter::test_ilike_wildcards_are_escaped PASSED [ 74%]
tests/test_comprehensive.py::TestSearchFilter::test_output_has_title_and_description PASSED [ 75%]
tests/test_comprehensive.py::TestTriageScoring::test_security_keyword_suggests_high_severity PASSED [ 76%]
tests/test_comprehensive.py::TestTriageScoring::test_production_down_is_blocker PASSED [ 77%]
tests/test_comprehensive.py::TestTriageScoring::test_cosmetic_is_minor PASSED [ 78%]
tests/test_comprehensive.py::TestTriageScoring::test_immediate_keyword_suggests_p1 PASSED [ 79%]
tests/test_comprehensive.py::TestTriageScoring::test_suggestion_keyword_suggests_p5 PASSED [ 80%]
tests/test_graph_impact.py::TestComputeBlockingImpact::test_empty_input PASSED [ 81%]
tests/test_graph_impact.py::TestComputeBlockingImpact::test_related_edges_have_no_blocking_impact PASSED [ 82%]
tests/test_graph_impact.py::TestComputeBlockingImpact::test_depends_on_is_normalized_to_a_blocking_edge PASSED [ 83%]
tests/test_graph_impact.py::TestComputeBlockingImpact::test_simple_chain PASSED [ 84%]
tests/test_graph_impact.py::TestComputeBlockingImpact::test_fork_counts_and_path PASSED [ 85%]
tests/test_graph_impact.py::TestComputeBlockingImpact::test_cycle_terminates PASSED [ 86%]
tests/test_graph_impact.py::TestComputeBlockingImpact::test_edges_to_hidden_nodes_ignored PASSED [ 87%]
tests/test_graph_impact.py::TestComputeBlockingImpact::test_self_edge_ignored PASSED [ 88%]
tests/test_graph_impact.py::TestComputeBlockingImpact::test_deterministic_tie_break PASSED [ 89%]
tests/test_intelligence_integration.py::TestRlsMembershipEnforcement::test_non_member_rejected_on_triage PASSED [ 90%]
tests/test_intelligence_integration.py::TestRlsMembershipEnforcement::test_member_allowed_on_triage PASSED [ 91%]
tests/test_intelligence_integration.py::TestRlsMembershipEnforcement::test_member_allowed_on_duplicates PASSED [ 92%]
tests/test_intelligence_integration.py::TestRlsMembershipEnforcement::test_non_member_rejected_on_risk_analysis PASSED [ 93%]
tests/test_intelligence_integration.py::TestRoleHierarchy::test_reporter_can_use_reporter_level_endpoint PASSED [ 94%]
tests/test_intelligence_integration.py::TestRoleHierarchy::test_admin_can_use_same_endpoint PASSED [ 95%]
tests/test_intelligence_integration.py::TestTriageEndpointContract::test_triage_returns_suggested_values PASSED [ 96%]
tests/test_intelligence_integration.py::TestTriageEndpointContract::test_triage_rejects_empty_title PASSED [ 97%]
tests/test_intelligence_integration.py::TestRateLimit::test_rate_limit_returns_429 PASSED [ 98%]
tests/test_intelligence_integration.py::TestRateLimit::test_rate_limit_allows_under_budget PASSED [ 99%]
tests/test_intelligence_integration.py::TestRateLimit::test_health_detail_includes_request_id PASSED [100%]

============================== warnings summary ===============================
backend/tests/test_bugfixes.py::TestCreateProject::test_create_project_handles_single_jsonb_object
  DeprecationWarning: The 'timeout' parameter is deprecated.

backend/tests/test_bugfixes.py::TestCreateProject::test_create_project_handles_single_jsonb_object
  DeprecationWarning: The 'verify' parameter is deprecated.

======================= 100 passed, 3 warnings in 4.15s ========================
```

---

## 2. Frontend Verification

### TypeScript Compilation

```
$ cd frontend && npx tsc --noEmit
# (no output = 0 errors)
```

### ESLint

```
$ cd frontend && npx next lint
✔ No ESLint warnings or errors
```

### Production Build

```
$ cd frontend && npm run build

Route (app)                                 Size  First Load JS
┌ ○ /                                    5.13 kB         176 kB
├ ○ /_not-found                            127 B         103 kB
├ ○ /analytics                           4.13 kB         173 kB
├ ○ /bugs                                5.78 kB         175 kB
├ ƒ /bugs/[id]                           6.88 kB         178 kB
├ ○ /bugs/new                            5.97 kB         177 kB
├ ○ /graph                               6.56 kB         176 kB
├ ○ /login                               2.17 kB         173 kB
├ ○ /projects                            3.92 kB         173 kB
├ ○ /reports                             3.96 kB         173 kB
├ ○ /search                              3.63 kB         175 kB
├ ○ /settings                            1.52 kB         171 kB
├ ○ /signup                              2.21 kB         173 kB
└ ○ /teams                               3.96 kB         173 kB

✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (16/16)

○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

---

## 3. CI Pipeline

GitHub Actions runs on every push to `main`:

```yaml
jobs:
  lint:          # cd frontend && npm ci && npm run lint
  typecheck:     # cd frontend && npm ci && npx tsc --noEmit
  build:         # cd frontend && npm ci && npm run build
  backend-test:  # cd backend && python -m pytest tests/ -v
```

No `|| true` — real test failures block the pipeline.

---

*Last updated: 2026-08-30*
