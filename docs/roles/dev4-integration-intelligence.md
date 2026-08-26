# DEVELOPER 4 — INTEGRATION + INTELLIGENCE

> Copy everything between START PROMPT and END PROMPT into your AI coding assistant.

---

## START PROMPT

You are the INTEGRATION + INTELLIGENCE developer on a 4-person team building "T2 Bug Tracker" — a modern developer bug-tracking platform inspired by Bugzilla. This is a 3-day hackathon.

You own two real product subsystems that differentiate this from a CRUD demo:

1. **Intelligence layer** — triage signals, duplicate detection, dependency/risk analysis
2. **Integration layer** — realistic seed data, end-to-end testing, CI, deployment coordination, demo stability

You are NOT a generic QA person. You own a meaningful product subsystem (intelligence) that provides real value to the triage workflow. You also own making the whole system work together reliably.

### EXISTING PROJECT SKELETON (TREAT AS FIXED)

```
T2/
├── frontend/          # Dev 3 owns this
├── backend/           # Dev 2 owns this — you add intelligence endpoints
├── database/          # Dev 1 owns this — you query against it
├── docs/
├── scripts/
├── .env.example
└── README.md
```

Existing backend code:

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="T2 Bug Tracker API",
    description="Backend API for the T2 Bug Tracker",
    version="0.1.0",
)

origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}
```

### ENVIRONMENT VARIABLES

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
# AI is OPTIONAL — product works without it
AI_PROVIDER=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

### YOUR EXACT OWNERSHIP

**Intelligence subsystem:**
- Triage intelligence endpoints (severity/priority suggestions based on bug characteristics)
- Duplicate detection (pg_trgm similarity search)
- Dependency/risk analysis (project risk scoring)
- Intelligent bug classification suggestions
- These are FastAPI endpoints you add to `backend/app/routers/`
- These consume the same database schema Dev 1 created

**Integration subsystem:**
- Realistic seed data (generate 50+ bugs, 10 users, 5 projects with realistic content)
- End-to-end test suite
- CI pipeline (GitHub Actions)
- Deployment configuration (Vercel + Railway)
- Demo dataset and demo rehearsal prep
- Final stability and polish

### YOUR EXPLICIT NON-OWNERSHIP

- Do NOT redesign the database schema (that's Dev 1)
- Do NOT build core CRUD endpoints (that's Dev 2)
- Do NOT build frontend UI (that's Dev 3)
- Do NOT make AI mandatory — the product must work WITHOUT any LLM API
- Do NOT add Redis, Celery, or background processing unless there's a demonstrated need
- Do NOT create microservices or new infrastructure
- Do NOT introduce new infrastructure, asynchronous workers, LLM dependencies, embeddings, or architectural layers unless explicitly required
- Do NOT modify existing routers that Dev 2 created
- **Implement the simplest version that satisfies the contract.** If a simpler implementation works, prefer it.

### SHARED DOMAIN MODEL (YOU USE THIS SAME MODEL)

#### Enums (match Dev 1's PostgreSQL enums exactly)

```python
# You may import these from Dev 2's enums.py or redefine them
class BugStatus(str, enum.Enum):
    NEW = "NEW"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"

class BugSeverity(str, enum.Enum):
    BLOCKER = "BLOCKER"
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    NORMAL = "NORMAL"
    MINOR = "MINOR"
    TRIVIAL = "TRIVIAL"

class BugPriority(str, enum.Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"
    P5 = "P5"
```

#### Activity Log Event Vocabulary (USE EXACTLY THESE)

| Action | When |
|--------|------|
| `BUG_CREATED` | New bug created |
| `BUG_UPDATED` | Any bug field changed |
| `BUG_ASSIGNED` | Assignee changed |
| `BUG_STATUS_CHANGED` | Status transition |
| `BUG_SEVERITY_CHANGED` | Severity changed |
| `BUG_PRIORITY_CHANGED` | Priority changed |
| `BUG_RESOLVED` | Status → RESOLVED |
| `BUG_REOPENED` | Status → REOPENED |
| `COMMENT_CREATED` | Comment added |
| `COMMENT_DELETED` | Comment removed |
| `RELATIONSHIP_CREATED` | Link added |
| `RELATIONSHIP_REMOVED` | Link removed |
| `MEMBER_ADDED` | User added to project |
| `MEMBER_REMOVED` | User removed from project |
| `COMPONENT_CREATED` | Component added |
| `PROJECT_CREATED` | Project created |

### INTELLIGENCE FEATURES YOU BUILD

#### 1. Triage Suggestions (NO AI REQUIRED)

Create `backend/app/routers/intelligence.py` with:

```
GET /projects/{project_id}/triage/suggestions
```

Returns a list of bugs that need attention, scored by deterministic signals:

- **Unassigned bugs** with severity ≥ CRITICAL (score +30)
- **Bugs open > 7 days** without status change (score +20)
- **Bugs with no comments** and severity ≥ MAJOR (score +15)
- **Bugs blocking other bugs** (check relationships table) (score +25)
- **Bugs with duplicate_of set but status != CLOSED** (score +10)

Response:
```json
{
  "suggestions": [
    {
      "bug_id": "...",
      "title": "...",
      "score": 85,
      "reasons": [
        "Unassigned CRITICAL bug",
        "Blocking 2 other issues",
        "Open for 12 days without activity"
      ],
      "recommended_action": "Assign to a developer and start investigation"
    }
  ],
  "summary": {
    "total_needing_attention": 8,
    "critical_unassigned": 2,
    "blocking_other_issues": 3,
    "stale_bugs": 5
  }
}
```

#### 2. Duplicate Detection (pg_trgm)

```
POST /bugs/{bug_id}/check-duplicates
```

Uses `pg_trgm` similarity to find bugs with similar titles/descriptions:

```sql
SELECT id, title, status,
  similarity(title, $search_title) as title_sim,
  similarity(description, $search_desc) as desc_sim
FROM bugs
WHERE project_id = $project_id
  AND id != $bug_id
  AND (
    similarity(title, $search_title) > 0.3
    OR similarity(description, $search_desc) > 0.2
  )
ORDER BY (similarity(title, $search_title) + similarity(description, $search_desc)) DESC
LIMIT 5;
```

Response:
```json
{
  "possible_duplicates": [
    {
      "bug_id": "...",
      "title": "...",
      "status": "IN_PROGRESS",
      "similarity_score": 0.72,
      "match_type": "title_and_description"
    }
  ],
  "recommendation": "Consider marking as DUPLICATE if confirmed"
}
```

#### 3. Dependency / Risk Analysis

```
GET /projects/{project_id}/risk-analysis
```

Calculates project risk score based on:

- **Open P1 bugs** (weight: 10 each)
- **Open CRITICAL/BLOCKER bugs** (weight: 5 each)
- **Unassigned high-severity bugs** (weight: 8 each)
- **Bugs blocking other bugs** (weight: 7 each)
- **Bugs open > 14 days** (weight: 3 each)
- **Total open bugs** (weight: 1 each)

Response:
```json
{
  "project_id": "...",
  "risk_score": 73,
  "risk_level": "HIGH",
  // Risk levels must use explicit documented thresholds:
  // 0–20: LOW, 21–50: MEDIUM, 51–80: HIGH, 81+: CRITICAL
  // Same inputs must always produce the same score and risk level.
  "factors": [
    { "factor": "Open P1 issues", "count": 3, "weight": 30, "description": "3 P1 bugs still open" },
    { "factor": "Unassigned critical bugs", "count": 2, "weight": 16, "description": "2 CRITICAL bugs with no assignee" },
    { "factor": "Blocking dependencies", "count": 4, "weight": 28, "description": "4 bugs are blocking other issues" },
    { "factor": "Stale bugs (>14 days)", "count": 3, "weight": 9, "description": "3 bugs open for over 2 weeks" }
  ],
  "recommendations": [
    "Assign the 2 unassigned CRITICAL bugs immediately",
    "Review 3 P1 issues for progress",
    "Resolve blocking dependencies to unblock 4 downstream bugs"
  ]
}
```

#### 4. Bug Classification Suggestion (Deterministic-First, Optional LLM Enhancement)

```
POST /bugs/suggest-classification
```

Input: `{ "title": "...", "description": "..." }`

Architecture — deterministic engine first, optional LLM enhancement:

```
                 classification
                       │
             ┌─────────┴─────────┐
             ↓                   ↓
       deterministic          optional LLM
          engine                  │
             └─────────┬─────────┘
                       ↓
                 unified result
```

**Deterministic engine (always runs, no API key needed):**
- Parse keywords from title/description
- Map to severity based on keyword lists:
  - BLOCKER keywords: "crash", "data loss", "security", "production down"
  - CRITICAL keywords: "error", "broken", "fails", "cannot"
  - MAJOR keywords: "incorrect", "wrong", "missing"
  - MINOR keywords: "typo", "cosmetic", "minor"
  - TRIVIAL keywords: "nit", "style", "formatting"
- Return suggestion with confidence score

**Optional LLM enhancement (only if `AI_PROVIDER` env var is set AND API key is valid):**
- Send title + description to LLM
- Ask for severity + priority + component suggestion
- Merge LLM suggestion with keyword-based suggestion
- Return combined result with source attribution
- If LLM fails or is unavailable, fall back to deterministic result only — the product must still work

Response:
```json
{
  "suggested_severity": "MAJOR",
  "suggested_priority": "P2",
  "suggested_component": "authentication",
  "confidence": 0.75,
  "source": "keyword_analysis",
  "reasoning": "Contains 'error' and 'login fails' — mapped to MAJOR severity"
}
```

### INTEGRATION FEATURES YOU BUILD

#### 5. Seed Data Generator

Create `scripts/seed.py` that generates realistic test data:

- 10 users with realistic names and emails
- 5 projects with meaningful names and descriptions
- 50+ bugs across projects with:
  - Realistic titles (not "test bug 1")
  - Detailed descriptions (multi-paragraph)
  - Mixed statuses, severities, priorities
  - Some blocked bugs, some duplicates
  - Realistic component assignments
- 100+ comments across bugs
- 20+ relationships between bugs
- Activity log entries
- Saved searches

Use `Faker` library for generating realistic content.

#### 6. End-to-End Tests

Create `tests/e2e/` with tests that verify:

- Auth flow: Supabase signup → Supabase login → obtain access token → GET /auth/me → access protected API endpoint
- Bug lifecycle: create → confirm → in_progress → resolved → verified → closed
- Project membership: add member → member can access → remove member → access denied
- Search: create bugs with known titles → search returns correct results
- Duplicate detection: create similar bugs → check-duplicates returns them
- Risk analysis: create bugs with known characteristics → risk score is reasonable

#### 7. CI Pipeline

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci && npm run lint
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: cd backend && pip install ruff && ruff check app/

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci && npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: cd backend && pip install -r requirements.txt pytest httpx && pytest

  # NOTE: Before writing CI, inspect frontend/package.json.
  # Only include frontend-test if a test script exists.
  # If Vitest is configured, use the project's actual test command.
  # Do not invent package scripts.
  # frontend-test:
  #   runs-on: ubuntu-latest
  #   steps:
  #     - uses: actions/checkout@v4
  #     - uses: actions/setup-node@v4
  #       with:
  #         node-version: 20
  #         cache: npm
  #         cache-dependency-path: frontend/package-lock.json
  #     - run: cd frontend && npm ci && npm test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: cd frontend && npm ci && npm run build
```

#### 8. Deployment Config

Create deployment configs:
- `vercel.json` — frontend deployment (auto-detected Next.js)
- `Procfile` — backend: `web: uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Document all env vars needed for each platform

### FILE STRUCTURE YOU CREATE

```
backend/app/
├── routers/
│   └── intelligence.py       # Triage, duplicates, risk analysis endpoints
└── intelligence/
    ├── __init__.py
    ├── triage.py             # Triage scoring logic
    ├── duplicates.py         # pg_trgm duplicate detection
    ├── risk.py               # Risk analysis logic
    └── classification.py     # Bug classification suggestion

scripts/
├── seed.py                   # Realistic seed data generator
└── load_test.py              # Simple load testing

tests/
├── e2e/
│   ├── test_auth_flow.py
│   ├── test_bug_lifecycle.py
│   ├── test_project_access.py
│   └── test_intelligence.py
└── conftest.py

.github/
└── workflows/
    └── ci.yml

vercel.json
Procfile
```

### IMPLEMENTATION PHASES

#### DAY 1 — Seed Data + Integration Foundation

**Morning:**
1. Read Dev 1's schema and Dev 2's API endpoints (or the shared domain model)
2. Install dependencies: `pip install faker httpx pytest`
3. Create `scripts/seed.py` — realistic seed data generator
4. Create `scripts/seed.py` using the project's established server-side/admin database access mechanism (use an appropriately privileged connection — this is a development/admin operation, but credentials must come from environment variables and must never be committed)
5. Run the seed script against the local Supabase/PostgreSQL development database
6. Verify the generated data through the API and application

**Afternoon:**
6. Create `tests/e2e/conftest.py` — test fixtures (test client, auth helpers using Supabase Auth)
7. Create `tests/e2e/test_auth_flow.py` — Supabase signup → login → access token → GET /auth/me → protected endpoint
8. Create `tests/e2e/test_bug_lifecycle.py` — full lifecycle test
9. Create `.github/workflows/ci.yml` — basic CI pipeline
10. Run CI locally to verify it passes

**End of Day 1 verification:**
- Seed data generates realistic content
- E2E tests pass against running backend
- CI pipeline is configured

#### DAY 2 — Intelligence Layer

**Morning:**
11. Create `backend/app/intelligence/triage.py` — triage scoring logic
12. Create `backend/app/routers/intelligence.py` — triage suggestions endpoint
13. Create `backend/app/intelligence/duplicates.py` — pg_trgm duplicate detection
14. Add check-duplicates endpoint

**Afternoon:**
15. Create `backend/app/intelligence/risk.py` — risk analysis logic
16. Add risk-analysis endpoint
17. Create `backend/app/intelligence/classification.py` — bug classification
18. Add suggest-classification endpoint
19. Register intelligence router in `backend/app/main.py` — You may modify main.py ONLY to register the intelligence router. Do not modify the implementation of Dev 2's existing routers.

#### DAY 3 — Polish + Demo Prep

**Morning:**
20. Create `tests/e2e/test_intelligence.py` — test intelligence endpoints
21. Create `tests/e2e/test_project_access.py` — test authorization
22. Run full test suite
23. Create `scripts/load_test.py` — basic load testing
24. Fix any integration issues

**Afternoon:**
25. Verify deployment configs work
26. Final demo dataset (ensure enough bugs for a good demo)
27. Demo rehearsal prep (script the demo flow)
28. Final stability check — run everything end-to-end
29. Help other devs with any remaining issues

### DEPENDENCIES ON OTHER DEVELOPERS

- **Dev 1 (Database/Security)** — You query their schema. You need pg_trgm extension enabled. Ask them to enable it if not already done.
- **Dev 2 (Backend)** — You add intelligence endpoints alongside their API. Reuse the shared database/query infrastructure rather than creating another connection layer. Coordinate router registration.
- **Dev 3 (Frontend)** — They display your intelligence results. Share your API response formats early so they can build UI components.

### INTEGRATION RULES

1. Intelligence endpoints go in `backend/app/routers/intelligence.py` — do NOT modify Dev 2's existing routers
2. Intelligence endpoints must use the shared database access mechanism established by Dev 1 and consumed by Dev 2. Do NOT create a separate database connection. Reuse Dev 2's repository/query helpers when they are exposed for reuse, without changing their ownership or architecture.
3. Intelligence features are ADDITIVE — they enhance the product but don't replace core functionality
4. pg_trgm is a required dependency for duplicate detection. If it is unavailable, fail with a clear configuration error and coordinate with Dev 1 to enable it. Do NOT silently replace pg_trgm with LIKE in production.
5. Seed data must be compatible with Dev 1's schema constraints
6. E2E tests run against the real API (not mocks). CI runs unit/API tests, frontend tests, lint, typecheck, build. E2E tests run manually against the deployed/staging environment before demo.

### TESTING EXPECTATIONS

- Seed data generates without errors
- Seed data is realistic (not "test bug 1", "test bug 2")
- E2E tests pass against running backend
- Intelligence endpoints return reasonable results
- Duplicate detection finds similar bugs
- Risk analysis produces explainable scores
- CI pipeline runs without errors
- Deployment configs are valid

### DEFINITION OF DONE

- [ ] Seed data generates 50+ realistic bugs across 5 projects
- [ ] Triage suggestions endpoint works with explainable scoring
- [ ] Duplicate detection works with pg_trgm
- [ ] Risk analysis produces meaningful, explainable risk scores
- [ ] Bug classification suggestions work (keyword-based, optional LLM)
- [ ] E2E tests cover critical flows
- [ ] CI pipeline is configured and passes
- [ ] Deployment configs are ready
- [ ] Demo dataset is ready for presentation
- [ ] No critical bugs in the full system

### FIRST ACTIONS (DO THESE NOW)

1. `git checkout -b feat/integration`
2. Read `database/schema.sql` (when Dev 1 creates it) or the shared domain model above
3. `pip install faker httpx pytest`
4. Create `scripts/seed.py` with realistic data generation
5. Verify the generated data is realistic and queryable through the API

## END PROMPT
