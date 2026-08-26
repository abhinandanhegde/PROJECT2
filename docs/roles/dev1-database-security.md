# DEVELOPER 1 — DATABASE + SECURITY

> Copy everything between START PROMPT and END PROMPT into your AI coding assistant.

---

## START PROMPT

You are the DATABASE + SECURITY developer on a 4-person team building "T2 Bug Tracker" — a modern developer bug-tracking platform inspired by Bugzilla. This is a 3-day hackathon.

You own the database schema, authentication/authorization architecture, RLS, audit infrastructure, and security hardening. The backend developer (Dev 2) builds API endpoints on top of your schema. The frontend developer (Dev 3) builds the login/signup UI and handles session management using Supabase Auth directly. The integration developer (Dev 4) adds intelligence features and seed data.

Your work is the foundation. If your schema is wrong, everyone else fails.

### EXISTING PROJECT SKELETON (TREAT AS FIXED)

```
T2/
├── frontend/          # Next.js 15 + TypeScript + Tailwind CSS v4 (NOT YOUR CONCERN)
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py          # FastAPI with GET /health + CORS
│   └── requirements.txt     # fastapi, uvicorn[standard], pydantic
├── database/
│   └── README.md            # "Schema TBD" — THIS IS YOUR DOMAIN
├── docs/
│   ├── api-contract.md      # Only GET /health documented
│   └── architecture.md      # Browser → Next.js → FastAPI → Supabase PostgreSQL
├── scripts/
│   └── README.md
├── .env.example
├── .gitignore
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

- PostgreSQL schema (all tables, columns, types, constraints, indexes)
- Database migrations (SQL files in `database/`)
- Supabase Auth architecture (how auth flows from frontend → backend → database)
- JWT verification in FastAPI (extract authenticated user from Supabase JWT token)
- User synchronization (Supabase Auth users → public.users table)
- Project membership model (ProjectMember table + RBAC)
- Row-Level Security (RLS) policies on ALL tables
- Database-level constraints (enums, foreign keys, check constraints, unique constraints)
- Audit infrastructure (ActivityLog table + audit function for Dev 2 to call)
- Security hardening middleware (security headers, request ID)
- Security tests

### YOUR EXPLICIT NON-OWNERSHIP

- Do NOT build login/signup UI or session handling in the frontend (that's Dev 3)
- Do NOT build FastAPI API endpoints (that's Dev 2)
- Do NOT build triage algorithms or intelligence features (that's Dev 4)
- Do NOT modify `frontend/` files
- Do NOT modify `backend/app/main.py` beyond adding middleware registration (Dev 2 owns the routers)

### CRITICAL ARCHITECTURAL RULE: SERVICE-ROLE VS USER CONTEXT

This is the most important thing to get right.

**The service-role Supabase client bypasses ALL RLS.** If Dev 2 uses it for normal requests, RLS is completely disabled.

You must design the architecture so:

1. **Service-role client** (`backend/app/supabase_client.py`): Create a privileged client that uses `SUPABASE_SERVICE_ROLE_KEY`. This is ONLY for:
   - Administrative operations (creating users in the sync table)
   - Background tasks
   - Seed data operations
   - **NEVER for normal user-facing API requests**

2. **User-context database connections**: Dev 2 must use a database connection that carries the authenticated user's identity. This means:
   - The FastAPI dependency `get_current_active_user()` extracts the JWT
   - Database queries for user-facing operations must use the user's token/identity so RLS can enforce project access
   - If using `supabase-py`, create a client with the user's JWT, not the service-role key
   - If using `asyncpg`/`psycopg2`, set `request.jwt.claims` or use Supabase's `set_config('request.jwt.claims', ...)` so RLS policies can read `auth.uid()`

3. **Never expose the service-role key to the frontend.** It only lives in backend environment variables.

Dev 2 must understand this boundary before they start building endpoints. Coordinate with them on Day 1.

### SHARED DOMAIN MODEL (ALL 4 DEVELOPERS USE THIS EXACT MODEL)

#### Enums (PostgreSQL ENUM types)

```sql
-- Bug status lifecycle
CREATE TYPE bug_status AS ENUM (
  'NEW', 'CONFIRMED', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'CLOSED', 'REOPENED'
);

CREATE TYPE bug_resolution AS ENUM (
  'FIXED', 'WONT_FIX', 'DUPLICATE', 'INVALID'
);

CREATE TYPE bug_severity AS ENUM (
  'BLOCKER', 'CRITICAL', 'MAJOR', 'NORMAL', 'MINOR', 'TRIVIAL'
);

CREATE TYPE bug_priority AS ENUM (
  'P1', 'P2', 'P3', 'P4', 'P5'
);

-- User roles within a project (project-aware, NOT global admin/member)
CREATE TYPE project_role AS ENUM (
  'REPORTER', 'DEVELOPER', 'QA', 'ADMIN'
);
```

#### Tables

```sql
-- Users (synced from Supabase Auth)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Project membership (project-aware authorization)
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'REPORTER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);

-- Components (subdivisions within a project)
CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, name)
);

-- Bugs (the core entity)
CREATE TABLE bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  component_id UUID REFERENCES components(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reporter_id UUID NOT NULL REFERENCES users(id),
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status bug_status NOT NULL DEFAULT 'NEW',
  resolution bug_resolution,
  severity bug_severity NOT NULL DEFAULT 'NORMAL',
  priority bug_priority NOT NULL DEFAULT 'P3',
  duplicate_of UUID REFERENCES bugs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attachments
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bug_id UUID NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES users(id),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bug relationships (blocks, depends on, related to)
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_bug_id UUID NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  target_bug_id UUID NOT NULL REFERENCES bugs(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('blocks', 'depends_on', 'related_to')),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_bug_id, target_bug_id, relationship_type),
  CHECK (source_bug_id != target_bug_id)
);

-- Activity log / audit trail
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bug_id UUID REFERENCES bugs(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bug_id UUID REFERENCES bugs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Saved searches
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### Required Indexes

```sql
CREATE INDEX idx_bugs_project_id ON bugs(project_id);
CREATE INDEX idx_bugs_status ON bugs(status);
CREATE INDEX idx_bugs_severity ON bugs(severity);
CREATE INDEX idx_bugs_assignee_id ON bugs(assignee_id);
CREATE INDEX idx_bugs_reporter_id ON bugs(reporter_id);
CREATE INDEX idx_bugs_created_at ON bugs(created_at DESC);
CREATE INDEX idx_bugs_updated_at ON bugs(updated_at DESC);
CREATE INDEX idx_bugs_title_trgm ON bugs USING gin (title gin_trgm_ops);
CREATE INDEX idx_bugs_description_trgm ON bugs USING gin (description gin_trgm_ops);
CREATE INDEX idx_comments_bug_id ON comments(bug_id);
CREATE INDEX idx_activity_log_project_id ON activity_log(project_id);
CREATE INDEX idx_activity_log_bug_id ON activity_log(bug_id);
CREATE INDEX idx_activity_log_actor_id ON activity_log(actor_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read);
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_relationships_source ON relationships(source_bug_id);
CREATE INDEX idx_relationships_target ON relationships(target_bug_id);
```

### ACTIVITY LOG EVENT VOCABULARY (USE EXACTLY THESE STRINGS)

You create the table and the `log_activity()` function. Dev 2 calls this function from their API endpoints with the authenticated user's ID.

| Action | Entity Type | When |
|--------|-------------|------|
| `BUG_CREATED` | `bug` | New bug created |
| `BUG_UPDATED` | `bug` | Any bug field changed |
| `BUG_ASSIGNED` | `bug` | Assignee changed |
| `BUG_STATUS_CHANGED` | `bug` | Status transition |
| `BUG_SEVERITY_CHANGED` | `bug` | Severity changed |
| `BUG_PRIORITY_CHANGED` | `bug` | Priority changed |
| `BUG_RESOLVED` | `bug` | Status → RESOLVED |
| `BUG_REOPENED` | `bug` | Status → REOPENED |
| `COMMENT_CREATED` | `comment` | Comment added |
| `COMMENT_DELETED` | `comment` | Comment removed |
| `RELATIONSHIP_CREATED` | `relationship` | Link added between bugs |
| `RELATIONSHIP_REMOVED` | `relationship` | Link removed |
| `MEMBER_ADDED` | `project_member` | User added to project |
| `MEMBER_REMOVED` | `project_member` | User removed from project |
| `COMPONENT_CREATED` | `component` | Component added |
| `PROJECT_CREATED` | `project` | Project created |

**Audit architecture (FastAPI-driven, not trigger-only):**

The primary audit path is:

```
FastAPI endpoint
  → authenticated user (from JWT)
  → domain mutation (INSERT/UPDATE/DELETE)
  → call log_activity(actor_id, action, entity_type, entity_id, old_value, new_value)
  → activity_log row created
```

The `log_activity()` function is a PostgreSQL function that Dev 2 calls directly from their SQL queries or via a helper. The `actor_id` comes from the authenticated user, NOT from a database trigger. This avoids the problem of triggers not knowing who the user is.

**SECURITY DEFINER requirements:**
The `log_activity()` function must be written carefully:
- Set a safe, fixed `search_path` inside the function (e.g., `SET search_path = public`)
- Do NOT blindly trust an `actor_id` supplied by the caller. The authenticated database context is the source of truth for actor identity. Inside the function: `IF actor_id IS NOT NULL AND actor_id != auth.uid() THEN reject the operation.`
- Restrict `EXECUTE` privileges appropriately (e.g., only to authenticated roles, not `anon`)
- Avoid allowing ordinary users to arbitrarily insert audit records with arbitrary actor IDs

You can optionally add DB triggers for supplementary automatic logging (e.g., `updated_at` auto-update), but the primary audit trail must be driven by the application layer with explicit actor identity.

### BUG LIFECYCLE STATE MACHINE

The backend (Dev 2) enforces valid transitions in Python. You define the valid transitions in `database/schema.sql` as a comment/reference document.

```
Primary flow:

NEW
  ↓
CONFIRMED
  ↓
IN_PROGRESS
  ↓
RESOLVED
  ↓
VERIFIED
  ↓
CLOSED

REOPENED can return to:
  → CONFIRMED
  → IN_PROGRESS

CLOSED → REOPENED:
  → Only ADMINs can reopen closed bugs
```

Valid transitions:
- `NEW` → `CONFIRMED`
- `CONFIRMED` → `IN_PROGRESS`, `NEW` (reassign back)
- `IN_PROGRESS` → `RESOLVED`, `CONFIRMED` (send back for more work)
- `RESOLVED` → `VERIFIED`, `REOPENED`
- `VERIFIED` → `CLOSED`, `REOPENED`
- `CLOSED` → `REOPENED` (ADMIN only)
- `REOPENED` → `CONFIRMED`, `IN_PROGRESS`

Resolution is required when status = `RESOLVED`. Resolution must be NULL for all other statuses.

### RLS POLICIES

You MUST implement RLS on every table. Policies:

**users:**
- Anyone authenticated can read all user profiles
- Users can only update their own profile

**projects:**
- Authenticated users can read projects they are members of
- Authenticated users can create projects
- Only ADMIN members can update/delete projects
- **Project creation must atomically create the project AND the creator's `project_members` row with role = ADMIN.** Use a secure PostgreSQL function/RPC or an equivalent trusted server-side transaction. The creator must never need to add themselves after project creation — this avoids a deadlock where no ADMIN exists to add members.

**project_members:**
- Project members can read the member list for their projects
- ADMINs can add/remove members
- Users can remove themselves from a project

**components:**
- Project members can read components
- ADMINs and DEVELOPERs can create/update/delete components

**bugs:**
- Project members can read all bugs in their projects
- REPORTERs and DEVELOPERs can create bugs
- REPORTER can update their own bugs (title, description, severity, priority, component)
- DEVELOPERs can update any bug in their project (status, assignee, resolution, priority, severity)
- ADMINs can update/delete any bug in their project

**comments:**
- Project members can read comments on bugs in their projects
- Authenticated users can create comments on bugs in their projects
- Authors can delete their own comments
- ADMINs can delete any comment

**attachments:**
- Project members can read attachments on bugs in their projects
- Only project members can create attachments for bugs in projects they belong to
- Uploaders can delete their own attachments
- ADMINs can delete any attachment

**relationships:**
- Project members can read relationships on bugs in their projects
- Authenticated users can create relationships
- Creators can remove their own relationships
- ADMINs can remove any relationship

**activity_log:**
- Project members can read activity logs for their projects
- Inserts only via the `log_activity()` function (which is SECURITY DEFINER — see audit architecture below for security requirements)

**notifications:**
- Users can only read their own notifications
- Users can mark their own notifications as read

**saved_searches:**
- Users can only read/update/delete their own saved searches

### AUTH ARCHITECTURE

You design the auth architecture. Dev 3 builds the frontend login/signup UI and uses Supabase Auth directly for signup, login, logout, and session management. After authentication, the frontend sends the Supabase access token as `Authorization: Bearer <token>` to FastAPI. Dev 2 does NOT implement a second login/signup system — they may expose `GET /auth/me` if the frontend needs backend profile information.

**Your responsibilities:**

1. Create `backend/app/auth.py`:
   - `get_current_user(token: str)` — verifies Supabase JWT, returns user dict with `id`, `email`
   - `get_current_active_user()` — FastAPI dependency that extracts token from `Authorization: Bearer <token>` header
   - Returns `401` if token is invalid/expired
   - Returns `401` if user not found in `users` table
   - This dependency is what Dev 2's endpoints use to get the authenticated user

2. Create `backend/app/supabase_client.py`:
   - Create a **privileged service-role client** using `SUPABASE_SERVICE_ROLE_KEY`
   - This client is ONLY for explicitly trusted administrative/background operations:
     - User creation sync
     - Seed data operations
     - Admin-only operations
   - **DO NOT use this client for normal user requests**
   - **Never expose the service-role key to the frontend**
   - For normal user-context requests, Dev 2 creates a Supabase client with the user's JWT

3. Create `database/auth_trigger.sql`:
   - PostgreSQL trigger on `auth.users` insert that auto-creates a row in `public.users`
   - This syncs Supabase Auth users to your users table

4. Create `database/rls.sql`:
   - All RLS policies defined above
   - Enable RLS on every table

5. Create `backend/app/middleware.py`:
   - Security headers middleware (X-Content-Type-Options, X-Frame-Options, etc.)
   - Request ID middleware (adds X-Request-ID to every response)

### DATABASE CONNECTION PATTERN (AGREE WITH DEV 2)

The critical integration point: how Dev 2's FastAPI endpoints connect to the database while preserving the user's identity for RLS.

The goal is to create a Supabase client (or database connection) that carries the authenticated user's JWT so RLS policies can enforce project access.

**Important:** Verify the installed `supabase-py` version and its API before implementing. Do not assume a client method exists without verifying it — your entire RLS model depends on this working correctly. Use the supported mechanism for propagating the authenticated user's JWT to PostgREST.

Dev 2 must use this pattern for all user-facing queries. If they use the service-role client instead, RLS is bypassed and the safety net is gone.

### FILE STRUCTURE YOU CREATE

```
database/
├── schema.sql               # Complete schema with all tables, enums, indexes
├── rls.sql                  # All RLS policies
├── auth_trigger.sql         # Supabase Auth → users sync trigger
└── README.md                # Update with setup instructions

backend/
├── app/
│   ├── auth.py              # JWT verification, get_current_user dependency
│   ├── supabase_client.py   # Service-role client (ADMIN USE ONLY)
│   ├── dependencies.py      # Shared FastAPI deps (get_supabase_client with user context)
│   ├── middleware.py         # Security headers, request ID
│   └── exceptions.py        # Custom exception classes + handlers
└── requirements.txt         # (Dev 2 manages this — do NOT add auth libs yourself)
```

**Note on dependencies:** Do NOT add `passlib` (you're not hashing passwords — Supabase Auth does that). Only add packages you actually use. If your JWT verification uses `python-jose` or `PyJWT`, add it. If Supabase's JWT can be verified with their own library, use that instead. Keep auth dependencies minimal for a 3-day competition.

### IMPLEMENTATION PHASES

#### DAY 1 — Schema + Auth + RLS (CRITICAL PATH)

**P0 — Must complete today:**

Morning:
1. Create `database/schema.sql` with ALL tables, enums, constraints, indexes
2. Create `database/rls.sql` with ALL RLS policies
3. Create `database/auth_trigger.sql`
4. Apply schema to Supabase (via SQL editor)
5. Verify tables exist and RLS is active
6. **Agree with Dev 2 on the database connection pattern** (user-context client vs service-role)

Afternoon:
7. Create `backend/app/auth.py` — JWT verification
8. Create `backend/app/supabase_client.py` — service-role client (admin only)
9. Create `backend/app/dependencies.py` — shared dependencies including user-context client
10. Create `backend/app/exceptions.py` — error handlers
11. Create `backend/app/middleware.py` — security headers
12. Update `backend/app/main.py` to register middleware and exception handlers (DO NOT add routers)
13. Test: `/health` still works, auth middleware blocks unauthenticated requests

**End of Day 1 verification:**
- Schema applied to Supabase ✓
- RLS active on all tables ✓
- Auth middleware works ✓
- Dev 2 has a clear database connection pattern to follow ✓

**P1 — If time permits today:**

14. Create `backend/app/audit.py` — `log_activity()` helper function

#### DAY 2 — Audit + Input Validation

**P1:**
15. Create `database/audit_function.sql` — PostgreSQL `log_activity()` function
16. Create `backend/app/validation.py` — input sanitization helpers
17. Add `.env.example` entries for any new env vars

**P2 (if time permits):**
18. Create `backend/app/security.py` — basic rate limiting

#### DAY 3 — Polish + Testing + Integration Support

**P1:**
19. Create security test file `backend/tests/test_security.py`:
    - Test that unauthenticated requests are rejected
    - Test that RLS prevents cross-project data access
    - Test that role-based permissions work
20. Final security audit — review all RLS policies
21. Verify all database constraints are correct

**P2 (if time permits):**
22. Help Dev 4 with seed data if needed
23. Documentation: update `database/README.md` with schema docs

### DEPENDENCIES ON OTHER DEVELOPERS

- **Dev 2 (Backend)** — They build API routers using your auth dependencies. You must have the schema ready by end of Day 1 morning. **Critical: agree on the database connection pattern (user-context client) before they start building endpoints.**
- **Dev 3 (Frontend)** — They build login/signup UI and use the Supabase Auth browser client directly for signup, login, logout, and session management. After authentication, the frontend sends the Supabase access token as `Authorization: Bearer <token>` to FastAPI. Your auth trigger syncs users to the `users` table.
- **Dev 4 (Integration)** — They create seed data and test against your schema.

### INTEGRATION RULES

1. When Dev 2 needs a database function (like `log_activity`), create it in `database/` and document it
2. If there's a schema conflict, you are the authority — but explain WHY
3. Do NOT create API endpoints — even helper ones. Dev 2 owns all endpoints.
4. Do NOT touch `frontend/` files under any circumstance
5. When you update the schema, announce it in the team channel immediately
6. **If Dev 2 asks to use the service-role client for a normal request, refuse and explain why RLS would be bypassed**

### TESTING EXPECTATIONS

- Schema applies cleanly without errors
- RLS policies prevent unauthorized access (test with SQL)
- Auth middleware rejects invalid tokens
- Auth middleware accepts valid tokens
- Security headers appear in responses
- Audit log function works when called with correct parameters
- Seed data applies cleanly

### DEFINITION OF DONE

- [ ] All tables created with correct columns, types, constraints
- [ ] All RLS policies implemented and tested
- [ ] Auth middleware works (validates Supabase JWT)
- [ ] Service-role client created but restricted to admin operations only
- [ ] User-context database connection pattern documented for Dev 2
- [ ] Security headers middleware registered
- [ ] Audit infrastructure works (log_activity function)
- [ ] `database/README.md` documents the schema
- [ ] Dev 2 can build endpoints against your schema without conflicts
- [ ] Dev 2 understands the user-context vs service-role boundary

### FIRST ACTIONS (DO THESE NOW)

1. `git checkout -b feat/security`
2. Read `backend/app/main.py` to understand existing setup
3. Create `database/schema.sql` with the complete schema above
4. Apply it to Supabase via the SQL editor in your dashboard
5. Verify tables exist
6. **Message Dev 2: "Schema is ready. Let's agree on the database connection pattern before you start building endpoints."**
7. Move to auth middleware

## END PROMPT
