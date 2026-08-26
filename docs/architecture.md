# T2 Bug Tracker — Architecture

## High-Level Overview

```
Browser
  ↓
Next.js (Frontend — Vercel)
  ↓  Authorization: Bearer <supabase_access_token>
FastAPI (Backend — Railway)
  ↓  JWT verification (Dev 1)
  ↓  User-context database client
Supabase PostgreSQL
  ↓  RLS policies enforce project-level access
Data
```

## Technology Stack

| Layer | Technology | Hosting | Purpose |
|-------|-----------|---------|---------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 | Vercel | User interface |
| Backend | Python 3.10+, FastAPI, Uvicorn, Pydantic v2 | Railway | API layer + business logic |
| Database | Supabase PostgreSQL | Supabase | Data storage + RLS |
| Auth | Supabase Auth | Supabase | Authentication + session management |

## Authentication Architecture

```
Login/Signup UI (Dev 3)
  ↓
Supabase Auth (browser client)
  ↓  returns access_token
Authorization: Bearer <token>
  ↓
FastAPI
  ↓  Dev 1's get_current_active_user() — JWT verification
Authenticated user context
  ↓
Dev 2's domain endpoints
  ↓
PostgreSQL (RLS enforced via user-context client)
```

**Critical rules:**
- Supabase Auth handles signup, login, logout, and session management from the frontend
- Dev 2 does NOT implement `/auth/signup`, `/auth/login`, or `/auth/logout`
- Dev 2 may expose `GET /auth/me` for backend profile data
- The frontend never directly queries PostgreSQL for domain data — all domain operations go through FastAPI
- The frontend may use Supabase Auth directly for authentication only

## Database Access Pattern

Two client types exist with different authorization contexts:

```
┌─────────────────────────────────────────────────────────┐
│ USER-CONTEXT CLIENT (normal API requests)               │
│                                                         │
│ Request JWT                                             │
│   ↓ extract + verify JWT → authenticated user ID       │
│   ↓ create Supabase client with user's JWT             │
│   ↓ DB request executes with that user's auth context  │
│   ↓ auth.uid() = authenticated user                    │
│   ↓ RLS evaluates project_members for access           │
└─────────────────────────────────────────────────────────┘

⚠️  Verify during implementation: does auth.uid() actually
    correspond to the caller during database operations?
    If not, RLS looks secure on paper but isn't enforcing
    the intended user identity.

┌─────────────────────────────────────────────────────────┐
│ SERVICE-ROLE CLIENT (admin/background operations ONLY)   │
│                                                         │
│ Seed scripts, migrations, administrative tasks          │
│   ↓ bypasses RLS                                        │
│   ↓ NEVER used for normal user requests                 │
│   ↓ NEVER exposed to the frontend                       │
└─────────────────────────────────────────────────────────┘
```

**If Dev 2 asks to use the service-role client for normal requests, refuse.** The user-context client is the only safe path for authenticated API requests.

## Authorization Invariant for Unscoped Endpoints

Some bug endpoints are not project-scoped in the URL (`GET/PATCH/DELETE /bugs/{id}`, all `/bugs/{bug_id}/...` sub-resources). This is fine **only if** the backend always resolves the bug's `project_id` from the database and enforces the same project-membership authorization as the project-scoped endpoints.

**Rule:** Resource IDs must never bypass project-level access control. A user from Project A must not be able to access a bug belonging to Project B by guessing or obtaining its UUID.

⚠️  Verify during implementation: can a user from Project A access a bug in Project B by guessing its UUID? If the answer is no, security is working as designed.

## Authorization Model (RBAC)

### System Roles

| Role | Description |
|------|-------------|
| REPORTER | Can report bugs, view own bugs |
| DEVELOPER | Can work on assigned bugs |
| QA | Can verify bugs, manage verification |
| ADMIN | Full project control, member management |

### Project Membership

Users belong to projects through `project_members`. Authorization is project-scoped — a user's permissions apply within each project they belong to.

### Project Creation

Project creation must **atomically** create:
1. The project row
2. The creator's `project_members` row with role = ADMIN

This prevents a project from existing without an admin.

## Bug Lifecycle State Machine

```
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

REOPENED → CONFIRMED or IN_PROGRESS
CLOSED → REOPENED (ADMIN only)
```

### Valid Transitions

| From | To |
|------|----|
| NEW | CONFIRMED |
| CONFIRMED | IN_PROGRESS, NEW |
| IN_PROGRESS | RESOLVED, CONFIRMED |
| RESOLVED | VERIFIED, REOPENED |
| VERIFIED | CLOSED, REOPENED |
| CLOSED | REOPENED (ADMIN only) |
| REOPENED | CONFIRMED, IN_PROGRESS |

### Resolution Rules

- When transitioning to `RESOLVED`: `resolution` is **required** (FIXED, WONT_FIX, DUPLICATE, or INVALID)
- When transitioning to any non-`RESOLVED` status: `resolution` must be **null**
- When transitioning away from `RESOLVED`: clear the stale resolution value

**Backend enforcement is authoritative.** The frontend may present valid actions, but the backend rejects invalid transitions with HTTP 422.

## Severity and Priority

**These are separate fields.** Do not merge them into one.

| Severity | Meaning |
|----------|---------|
| BLOCKER | System is unusable |
| CRITICAL | Major feature broken |
| MAJOR | Important feature affected |
| NORMAL | Default |
| MINOR | Cosmetic or minor issue |
| TRIVIAL | Nice to have |

| Priority | Meaning |
|----------|---------|
| P1 | Fix immediately |
| P2 | Fix soon |
| P3 | Normal |
| P4 | Low |
| P5 | When convenient |

## Audit Architecture

Audit events are **FastAPI-driven** (not trigger-based):

```
FastAPI endpoint
  ↓
authenticated user (actor_id from JWT)
  ↓
domain mutation (insert/update/delete)
  ↓
log_activity() function call
  ↓
activity_log table insert
```

### Event Vocabulary

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

All four developers must use these exact event names. Do not invent alternative names.

## Intelligence Layer (Dev 4)

The intelligence subsystem adds triage, duplicate detection, and risk analysis. It is **optional** — the product works without it.

```
           Intelligence
                 │
       ┌─────────┴─────────┐
       ↓                   ↓
 deterministic          optional LLM
    engine                  │
       └─────────┬─────────┘
                 ↓
           unified result
```

- **Deterministic-first:** All intelligence works without an LLM API key
- **pg_trgm** is required for duplicate detection (fail with clear error if unavailable)
- **Optional LLM:** enhances results but is never a dependency

## Anti-Overengineering Rules

This project does NOT use:
- Microservices
- Redis (unless demonstrated need)
- Celery (unless demonstrated need)
- WebSockets (stretch feature only after core works)
- pgvector (optional, never a core dependency)
- Multiple authentication systems
- Excessive state-management libraries
- ORM layers beyond what Supabase client provides

If a simpler implementation works, prefer it.

## Git Workflow

| Branch | Developer | Purpose |
|--------|-----------|---------|
| `main` | All | Stable, deployable base |
| `feat/security` | Dev 1 | Database, RLS, auth verification, RBAC, audit |
| `feat/backend` | Dev 2 | FastAPI endpoints, business logic |
| `feat/frontend` | Dev 3 | Next.js UI, auth UI, product UX |
| `feat/integration` | Dev 4 | Intelligence, seed data, CI, testing |

**Rules:**
- Nobody develops directly on `main`
- Pull/rebase from `main` before starting major work
- Open a PR before merging
- Each developer owns their subsystem exclusively
