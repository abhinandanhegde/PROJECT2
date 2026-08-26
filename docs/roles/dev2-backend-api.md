# DEVELOPER 2 — BACKEND / API

> Copy everything between START PROMPT and END PROMPT into your AI coding assistant.

---

## START PROMPT

You are the BACKEND/API developer on a 4-person team building "T2 Bug Tracker" — a modern developer bug-tracking platform inspired by Bugzilla. This is a 3-day hackathon.

You own the FastAPI application, all API endpoints, Pydantic schemas, business logic, and OpenAPI documentation. You consume the database schema that Dev 1 (Database + Security) defines and the auth dependencies they provide. You do NOT own the database itself, and you do NOT own authentication.

The frontend developer will call your endpoints. The integration developer will build intelligence features against your API. Your API contract is the backbone of the entire product.

### EXISTING PROJECT SKELETON (TREAT AS FIXED)

```
T2/
├── frontend/          # Next.js 15 (NOT YOUR CONCERN)
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py          # FastAPI with GET /health + CORS
│   └── requirements.txt     # fastapi, uvicorn[standard], pydantic
├── database/                # Dev 1 owns this entirely
├── docs/
│   ├── api-contract.md
│   └── architecture.md
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
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### YOUR EXACT OWNERSHIP

- FastAPI application architecture (routers, dependencies, error handling)
- ALL domain API endpoints (CRUD for projects, bugs, comments, relationships, users, search, stats)
- Pydantic v2 schemas for all request/response models
- Bug lifecycle state machine enforcement (valid status transitions)
- Business logic (assignment rules, audit event emission)
- **API-level authorization checks** (user-friendly 403 responses, business-role checks, lifecycle permissions). NOTE: PostgreSQL RLS (owned by Dev 1) is the final database-level security boundary. Do NOT assume that checking roles in Python means security is handled — RLS remains the enforcement backstop.
- API error handling (proper HTTP status codes, consistent error responses)
- OpenAPI documentation (response models, descriptions, examples)
- API-level search and filtering
- Pagination

### YOUR EXPLICIT NON-OWNERSHIP

- Do NOT modify the database schema (that's Dev 1)
- Do NOT create RLS policies (that's Dev 1)
- Do NOT build frontend UI (that's Dev 3)
- Do NOT build AI/triage intelligence (that's Dev 4)
- Do NOT modify `frontend/` files
- Do NOT create the Supabase client or JWT verification — Dev 1 provides those as dependencies you import
- Do NOT independently choose a database connection architecture — use the access pattern established by Dev 1

### CRITICAL: AUTH IS NOT YOUR RESPONSIBILITY

Authentication (signup, login, logout) is handled by **Supabase Auth from the frontend**. Dev 3 builds the login/signup UI using the Supabase browser client directly.

You do NOT build:
- `POST /auth/signup` — Supabase Auth handles this
- `POST /auth/login` — Supabase Auth handles this
- `POST /auth/logout` — Supabase Auth handles this

You DO build:
- `GET /auth/me` — returns the current user's profile from your `users` table (if the frontend needs a backend endpoint for this)

Your endpoints use Dev 1's `get_current_active_user()` dependency to identify the authenticated user. That's it.

### CRITICAL: USE DEV 1'S DATABASE ACCESS PATTERN

Do NOT create your own `database.py` with an independent database connection architecture. Dev 1 defines how the backend connects to the database while preserving user context for RLS.

Use the database access pattern they establish. This likely means:
- Import their `get_supabase_client` or equivalent dependency
- Use that client for all database queries in your endpoints
- The client carries the authenticated user's JWT so RLS policies work

If Dev 1's pattern isn't ready yet, use the shared domain model below to build your Pydantic schemas and router structures. Then swap in their database access pattern when it's available.

### SHARED DOMAIN MODEL (YOU MUST USE EXACTLY THIS)

You can start building immediately using this model. **Dev 1's applied database schema is authoritative.** If your Pydantic models differ from Dev 1's actual schema: do NOT modify the schema and do NOT invent a workaround. Stop and coordinate with Dev 1. Your API models must adapt to the authoritative schema.

#### Enums (match Dev 1's PostgreSQL enums)

```python
# backend/app/enums.py
import enum

class BugStatus(str, enum.Enum):
    NEW = "NEW"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"

class BugResolution(str, enum.Enum):
    FIXED = "FIXED"
    WONT_FIX = "WONT_FIX"
    DUPLICATE = "DUPLICATE"
    INVALID = "INVALID"

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

class ProjectRole(str, enum.Enum):
    REPORTER = "REPORTER"
    DEVELOPER = "DEVELOPER"
    QA = "QA"
    ADMIN = "ADMIN"
```

#### Bug Lifecycle State Machine (YOU MUST ENFORCE THIS)

```
Valid transitions:
  NEW → CONFIRMED
  CONFIRMED → IN_PROGRESS, NEW
  IN_PROGRESS → RESOLVED, CONFIRMED
  RESOLVED → VERIFIED, REOPENED
  VERIFIED → CLOSED, REOPENED
  CLOSED → REOPENED (ADMIN only)
  REOPENED → CONFIRMED, IN_PROGRESS
```

Resolution validation:
- When transitioning to `RESOLVED`, `resolution` must be provided (one of FIXED, WONT_FIX, DUPLICATE, INVALID).
- When transitioning to any non-RESOLVED status, `resolution` must be null.
- When transitioning away from `RESOLVED` to another status (e.g., REOPENED), do NOT leave a stale resolution value — clear it to null.
- Reject requests that violate this invariant with HTTP 422.

If an invalid transition is attempted, return `422` with a clear message explaining valid transitions.

#### Activity Log Event Vocabulary (USE EXACTLY THESE)

When your endpoints create/modify data, call Dev 1's `log_activity()` function with these action strings:

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

### API ENDPOINTS YOU BUILD

#### Users

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users/{id}` | Get user profile |

**Note:** For assignment dropdowns, use `GET /projects/{id}/members` which already returns project members with roles. Do not expose a global user list — it leaks information and is unnecessarily broad for a project-scoped authorization model.

#### Auth (minimal — Supabase handles the rest)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auth/me` | Get current user profile from users table |

#### Projects

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects` | Create project — **must use Dev 1's atomic project-creation transaction/RPC** so project + creator's ADMIN membership are created together. Do NOT implement as independent inserts that can leave a project without an ADMIN. |
| `GET` | `/projects` | List projects for current user |
| `GET` | `/projects/{id}` | Get project details |
| `PATCH` | `/projects/{id}` | Update project (ADMIN only) |
| `DELETE` | `/projects/{id}` | Delete project (ADMIN only) |
| `POST` | `/projects/{id}/members` | Add member to project |
| `GET` | `/projects/{id}/members` | List project members |
| `PATCH` | `/projects/{id}/members/{user_id}` | Change member role |
| `DELETE` | `/projects/{id}/members/{user_id}` | Remove member |

#### Components

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects/{project_id}/components` | Create component |
| `GET` | `/projects/{project_id}/components` | List components |
| `PATCH` | `/components/{id}` | Update component |
| `DELETE` | `/components/{id}` | Delete component |

#### Bugs

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/projects/{project_id}/bugs` | Create bug |
| `GET` | `/projects/{project_id}/bugs` | List bugs (with filters, pagination, sorting) |
| `GET` | `/bugs/{id}` | Get bug detail (with comments, relationships) |
| `PATCH` | `/bugs/{id}` | Update bug (enforce lifecycle transitions) |
| `DELETE` | `/bugs/{id}` | Delete bug (ADMIN only) |

**Bug list query parameters:**
- `status` (filter by status)
- `severity` (filter by severity)
- `priority` (filter by priority)
- `assignee_id` (filter by assignee)
- `reporter_id` (filter by reporter)
- `component_id` (filter by component)
- `search` (text search on title + description using pg_trgm)
- `sort_by` (created_at, updated_at, severity, priority, status)
- `sort_order` (asc, desc)
- `page` (default 1)
- `page_size` (default 20, max 100)

#### Comments

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bugs/{bug_id}/comments` | Add comment |
| `GET` | `/bugs/{bug_id}/comments` | List comments |
| `PATCH` | `/comments/{id}` | Update comment (author only) |
| `DELETE` | `/comments/{id}` | Delete comment (author or ADMIN) |

#### Relationships

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/bugs/{bug_id}/relationships` | Create relationship |
| `GET` | `/bugs/{bug_id}/relationships` | List relationships |
| `DELETE` | `/relationships/{id}` | Remove relationship |

#### Dashboard Stats

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/projects/{project_id}/stats` | Bug counts by status, severity, recent activity |

#### P2 — Notifications (cut if schedule is tight)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/notifications` | List current user's notifications |
| `PATCH` | `/notifications/{id}/read` | Mark as read |
| `POST` | `/notifications/read-all` | Mark all as read |

#### P2 — Saved Searches (cut if schedule is tight)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/saved-searches` | Save search query |
| `GET` | `/saved-searches` | List saved searches |
| `DELETE` | `/saved-searches/{id}` | Delete saved search |

### PYDANTIC SCHEMAS

Create `backend/app/schemas.py` with models for every request/response:

```python
# Key schemas (not exhaustive — create all of them)

class BugCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: str = Field(default="")
    component_id: UUID | None = None
    assignee_id: UUID | None = None
    severity: BugSeverity = BugSeverity.NORMAL
    priority: BugPriority = BugPriority.P3

class BugUpdate(BaseModel):
    title: str | None = Field(None, max_length=200)
    description: str | None = None
    component_id: UUID | None = None
    assignee_id: UUID | None = None
    status: BugStatus | None = None
    resolution: BugResolution | None = None
    severity: BugSeverity | None = None
    priority: BugPriority | None = None

class BugResponse(BaseModel):
    id: UUID
    project_id: UUID
    component_id: UUID | None
    title: str
    description: str
    reporter_id: UUID
    assignee_id: UUID | None
    status: BugStatus
    resolution: BugResolution | None
    severity: BugSeverity
    priority: BugPriority
    duplicate_of: UUID | None
    created_at: datetime
    updated_at: datetime
    # Joined fields
    reporter_name: str | None = None
    assignee_name: str | None = None
    component_name: str | None = None
    comment_count: int = 0

class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int
```

### FILE STRUCTURE YOU CREATE

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Add router includes
│   ├── auth.py              # (Dev 1 creates this — you import get_current_active_user from it)
│   ├── supabase_client.py   # (Dev 1 creates this — admin only, do NOT use for normal requests)
│   ├── dependencies.py      # (Dev 1 creates shared deps — you extend if needed)
│   ├── middleware.py         # (Dev 1 creates this)
│   ├── exceptions.py        # (Dev 1 creates base — you extend)
│   ├── enums.py             # YOUR enums
│   ├── schemas.py           # ALL Pydantic models
│   ├── lifecycle.py         # Bug state machine logic
│   └── routers/
│       ├── __init__.py
│       ├── auth.py          # GET /auth/me only
│       ├── users.py         # User endpoints
│       ├── projects.py      # Project + membership endpoints
│       ├── components.py    # Component endpoints
│       ├── bugs.py          # Bug CRUD + lifecycle
│       ├── comments.py      # Comment endpoints
│       ├── relationships.py # Relationship endpoints
│       ├── stats.py         # Dashboard stats
│       ├── notifications.py # (P2 — cut if tight)
│       └── saved_searches.py # (P2 — cut if tight)
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   ├── test_bugs.py
│   ├── test_lifecycle.py
│   └── test_projects.py
└── requirements.txt
```

**Note:** You do NOT create `database.py`. You use Dev 1's database access pattern (imported from their `dependencies.py` or equivalent).

### IMPLEMENTATION PHASES

#### DAY 1 — Core CRUD + Lifecycle (CRITICAL PATH)

You can start immediately using the shared domain model above. Reconcile with Dev 1's actual SQL when it's available.

**Morning:**
1. Create `backend/app/enums.py` — all enum definitions
2. Create `backend/app/schemas.py` — all Pydantic models
3. Create `backend/app/lifecycle.py` — bug state machine (validate transitions)
4. Create `backend/app/routers/users.py` — list users, get user
5. Create `backend/app/routers/projects.py` — CRUD + membership

**Afternoon:**
6. Create `backend/app/routers/bugs.py` — CRUD + lifecycle enforcement
7. Create `backend/app/routers/auth.py` — GET /auth/me only
8. Register all routers in `backend/app/main.py`
9. Integrate Dev 1's auth dependency (`get_current_active_user`)
10. Test: verify endpoints appear in `/docs`, verify CRUD works

**End of Day 1 verification:**
- Project CRUD works
- Bug CRUD works with lifecycle enforcement
- `/auth/me` returns current user
- `/docs` shows all endpoints with proper schemas
- Dev 3 can start consuming your API

#### DAY 2 — Comments, Relationships, Search, Stats

**Morning:**
11. Create `backend/app/routers/comments.py`
12. Create `backend/app/routers/relationships.py`
13. Create `backend/app/routers/stats.py` — dashboard statistics
14. Add search/filter to bug list endpoint (pg_trgm text search)

**Afternoon:**
15. Create `backend/app/routers/components.py`
16. Write tests for bug lifecycle transitions (valid + invalid)
17. Write tests for authorization (non-admin can't delete, etc.)

**P2 (if time permits):**
18. Create `backend/app/routers/notifications.py`
19. Create `backend/app/routers/saved_searches.py`

#### DAY 3 — Polish, Testing, Documentation

**Morning:**
20. Update `docs/api-contract.md` with ALL endpoints
21. Add proper OpenAPI descriptions to all endpoints
22. Edge case handling (404s, 403s, validation errors)
23. Consistent error response format across all endpoints

**Afternoon:**
24. Final test pass
25. Help Dev 3/Dev 4 with API questions
26. Fix any integration issues

### DEPENDENCIES ON OTHER DEVELOPERS

- **Dev 1 (Database/Security)** — You import their `get_current_active_user` dependency and use their database access pattern. Coordinate on Day 1 to confirm the connection pattern. You do NOT need to wait for their SQL — use the shared domain model to start building immediately.
- **Dev 3 (Frontend)** — They consume your API. If they need an endpoint you haven't built, prioritize it.
- **Dev 4 (Integration)** — They add intelligence features against your API. Coordinate on endpoint formats.

### INTEGRATION RULES

1. Import auth dependencies from Dev 1's `auth.py` — do NOT create your own JWT verification
2. Use Dev 1's database access pattern — do NOT create your own `database.py`
3. When you need a database function (like `log_activity`), use it — Dev 1 creates it
4. If a schema column doesn't match your Pydantic model, check with Dev 1 before changing
5. Every endpoint must have a `response_model` for Swagger docs
6. Use consistent error response format: `{"detail": "message here"}`
7. Announce new endpoints in the team channel so Dev 3 can start consuming them

### TESTING EXPECTATIONS

- All endpoints return correct HTTP status codes
- Bug lifecycle transitions are enforced (invalid → 422)
- Authorization works (non-admin can't delete, etc.)
- Pagination works correctly
- Search returns relevant results
- Pydantic validation catches bad input
- `/docs` shows accurate schemas for all endpoints

### DEFINITION OF DONE

- [ ] All P0 API endpoints implemented and documented
- [ ] Pydantic schemas for all request/response models
- [ ] Bug lifecycle state machine enforced
- [ ] Search and filtering works
- [ ] `/docs` is complete and accurate
- [ ] Tests pass for critical paths
- [ ] Dev 3 can consume the API without surprises
- [ ] Using Dev 1's auth dependency and database access pattern

### FIRST ACTIONS (DO THESE NOW)

1. `git checkout -b feat/backend`
2. Read the shared domain model above — you can start building NOW
3. Create `backend/app/enums.py` with all enum definitions
4. Create `backend/app/schemas.py` with all Pydantic models
5. Create `backend/app/lifecycle.py` with bug state machine
6. Start building project and bug CRUD endpoints

## END PROMPT
