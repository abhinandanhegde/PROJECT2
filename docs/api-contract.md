# T2 Bug Tracker — API Contract

> All domain endpoints are owned by Dev 2. Intelligence endpoints are owned by Dev 4.
> The frontend (Dev 3) consumes these endpoints. Dev 1 provides auth and database infrastructure.

## Base URL

```
http://localhost:8000
```

## Authentication

All protected endpoints require:

```
Authorization: Bearer <supabase_access_token>
```

The token is obtained from Supabase Auth (frontend handles this directly). FastAPI verifies the JWT via Dev 1's `get_current_active_user()` dependency.

**You do NOT call `/auth/login` or `/auth/signup` from the backend.** Supabase Auth handles those from the frontend.

---

## Health Check

### `GET /health`

**Response:**

```json
{
  "status": "ok"
}
```

---

## Auth

### `GET /auth/me`

Returns the current authenticated user's profile from the `users` table.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Jane Doe",
  "avatar_url": "https://...",
  "created_at": "2026-08-26T10:00:00Z"
}
```

**Status codes:**

| Code | Meaning |
|------|---------|
| 200 | Success |
| 401 | Not authenticated |

---

## Users

### `GET /users/{id}`

Get a specific user's profile.

**Response (200):**

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "display_name": "Jane Doe",
  "avatar_url": "https://...",
  "created_at": "2026-08-26T10:00:00Z"
}
```

> For assignment dropdowns, use `GET /projects/{id}/members` instead — it returns project-scoped members with roles.

---

## Projects

### `POST /projects`

Create a new project. The creator automatically becomes ADMIN.

**⚠️ Must use Dev 1's atomic project-creation transaction/RPC.** Project + creator's ADMIN membership are created together. Do NOT implement as independent inserts.

**Request body:**

```json
{
  "name": "My Project",
  "description": "A bug tracker for..."
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "name": "My Project",
  "description": "A bug tracker for...",
  "created_at": "2026-08-26T10:00:00Z",
  "created_by": "uuid"
}
```

### `GET /projects`

List projects the current user belongs to.

**Response (200):**

```json
{
  "items": [
    {
      "id": "uuid",
      "name": "My Project",
      "description": "...",
      "created_at": "2026-08-26T10:00:00Z",
      "created_by": "uuid",
      "bug_count": 12,
      "my_role": "ADMIN"
    }
  ]
}
```

### `GET /projects/{id}`

Get project details.

### `PATCH /projects/{id}`

Update project (ADMIN only).

### `DELETE /projects/{id}`

Delete project (ADMIN only).

---

## Project Members

### `POST /projects/{id}/members`

Add a member to a project (ADMIN only).

**Request body:**

```json
{
  "user_id": "uuid",
  "role": "DEVELOPER"
}
```

### `GET /projects/{id}/members`

List project members with their roles.

**Response (200):**

```json
{
  "items": [
    {
      "user_id": "uuid",
      "display_name": "Jane Doe",
      "role": "ADMIN",
      "joined_at": "2026-08-26T10:00:00Z"
    }
  ]
}
```

### `PATCH /projects/{id}/members/{user_id}`

Change member role (ADMIN only).

### `DELETE /projects/{id}/members/{user_id}`

Remove member (ADMIN only).

---

## Components

### `POST /projects/{project_id}/components`

Create a component within a project.

**Request body:**

```json
{
  "name": "Authentication",
  "description": "Login, signup, session management"
}
```

### `GET /projects/{project_id}/components`

List components for a project.

### `PATCH /components/{id}`

Update a component.

### `DELETE /components/{id}`

Delete a component.

---

## Bugs

**⚠️ Authorization invariant:** Endpoints like `GET/PATCH/DELETE /bugs/{id}` and all `/bugs/{bug_id}/...` sub-resources are **not** project-scoped in the URL. The backend **must** resolve the bug's `project_id` from the database and enforce the same project-membership/RLS rules as the project-scoped endpoints (`/projects/{project_id}/bugs`). Never allow a bug UUID alone to bypass project authorization.

### `POST /projects/{project_id}/bugs`

Create a bug in a project.

**Request body:**

```json
{
  "title": "Login button not responding on mobile",
  "description": "On iOS Safari, the login button doesn't respond to taps.",
  "component_id": "uuid",
  "assignee_id": "uuid",
  "severity": "MAJOR",
  "priority": "P2"
}
```

**Response (201):**

```json
{
  "id": "uuid",
  "project_id": "uuid",
  "component_id": "uuid",
  "title": "Login button not responding on mobile",
  "description": "On iOS Safari...",
  "reporter_id": "uuid",
  "assignee_id": "uuid",
  "status": "NEW",
  "resolution": null,
  "severity": "MAJOR",
  "priority": "P2",
  "created_at": "2026-08-26T10:00:00Z",
  "updated_at": "2026-08-26T10:00:00Z"
}
```

### `GET /projects/{project_id}/bugs`

List bugs with filtering, sorting, and pagination.

**Query parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `severity` | string | Filter by severity |
| `priority` | string | Filter by priority |
| `assignee_id` | uuid | Filter by assignee |
| `reporter_id` | uuid | Filter by reporter |
| `component_id` | uuid | Filter by component |
| `search` | string | Text search on title + description (pg_trgm) |
| `sort_by` | string | `created_at`, `updated_at`, `severity`, `priority`, `status` |
| `sort_order` | string | `asc` or `desc` |
| `page` | int | Page number (default 1) |
| `page_size` | int | Results per page (default 20, max 100) |

**Response (200):**

```json
{
  "items": [
    {
      "id": "uuid",
      "title": "...",
      "status": "NEW",
      "severity": "MAJOR",
      "priority": "P2",
      "assignee_name": "Jane Doe",
      "reporter_name": "John Smith",
      "comment_count": 3,
      "created_at": "2026-08-26T10:00:00Z",
      "updated_at": "2026-08-26T10:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

### `GET /bugs/{id}`

Get full bug detail including comments and relationships.

### `PATCH /bugs/{id}`

Update a bug. **Enforces lifecycle transitions.**

**Request body (example — status change):**

```json
{
  "status": "IN_PROGRESS"
}
```

**Request body (example — resolve):**

```json
{
  "status": "RESOLVED",
  "resolution": "FIXED"
}
```

**Resolution rules:**
- `status = RESOLVED` → `resolution` **required** (FIXED, WONT_FIX, DUPLICATE, INVALID)
- `status != RESOLVED` → `resolution` must be **null**
- Violations return **HTTP 422**

**Lifecycle transitions:**

| From | To |
|------|----|
| NEW | CONFIRMED |
| CONFIRMED | IN_PROGRESS, NEW |
| IN_PROGRESS | RESOLVED, CONFIRMED |
| RESOLVED | VERIFIED, REOPENED |
| VERIFIED | CLOSED, REOPENED |
| CLOSED | REOPENED (ADMIN only) |
| REOPENED | CONFIRMED, IN_PROGRESS |

Invalid transitions return **HTTP 422** with a message explaining valid transitions.

### `DELETE /bugs/{id}`

Delete a bug (ADMIN only).

---

## Comments

### `POST /bugs/{bug_id}/comments`

Add a comment to a bug.

**Request body:**

```json
{
  "body": "I can reproduce this on Chrome 120 as well."
}
```

### `GET /bugs/{bug_id}/comments`

List comments for a bug.

### `PATCH /comments/{id}`

Update a comment (author only).

### `DELETE /comments/{id}`

Delete a comment (author or ADMIN).

---

## Relationships

### `POST /bugs/{bug_id}/relationships`

Create a relationship between bugs.

**Request body:**

```json
{
  "target_bug_id": "uuid",
  "relationship_type": "blocks"
}
```

**Relationship types:**

| Type | Meaning |
|------|---------|
| `blocks` | This bug blocks the target |
| `depends_on` | This bug depends on the target |
| `related_to` | General relationship |

### `GET /bugs/{bug_id}/relationships`

List relationships for a bug.

### `DELETE /relationships/{id}`

Remove a relationship.

---

## Dashboard Stats

### `GET /projects/{project_id}/stats`

Get bug statistics for a project.

**Response (200):**

```json
{
  "total_bugs": 42,
  "by_status": {
    "NEW": 10,
    "CONFIRMED": 5,
    "IN_PROGRESS": 12,
    "RESOLVED": 8,
    "VERIFIED": 4,
    "CLOSED": 3
  },
  "by_severity": {
    "BLOCKER": 1,
    "CRITICAL": 3,
    "MAJOR": 8,
    "NORMAL": 20,
    "MINOR": 7,
    "TRIVIAL": 3
  },
  "recent_activity": [
    {
      "action": "BUG_STATUS_CHANGED",
      "bug_title": "Login fails on Safari",
      "actor_name": "Jane Doe",
      "created_at": "2026-08-26T09:30:00Z"
    }
  ]
}
```

---

## Notifications (P2 — cut if schedule is tight)

### `GET /notifications`

List current user's notifications.

### `PATCH /notifications/{id}/read`

Mark notification as read.

### `POST /notifications/read-all`

Mark all notifications as read.

---

## Saved Searches (P2 — cut if schedule is tight)

### `POST /saved-searches`

Save a search query.

### `GET /saved-searches`

List saved searches.

### `DELETE /saved-searches/{id}`

Delete a saved search.

---

## Intelligence Endpoints (Dev 4)

These endpoints live in `backend/app/routers/intelligence.py`. They use the shared database access pattern (NOT a separate connection).

### `GET /projects/{project_id}/triage/suggestions`

Get triage suggestions for unassigned or recently created bugs.

**Response (200):**

```json
{
  "suggestions": [
    {
      "bug_id": "uuid",
      "bug_title": "...",
      "suggested_severity": "CRITICAL",
      "suggested_priority": "P1",
      "suggested_assignee": "uuid",
      "confidence": 0.85,
      "reasoning": "Bug mentions 'production outage' and has 3 dependent issues"
    }
  ]
}
```

### `POST /bugs/{bug_id}/check-duplicates`

Check if a bug has possible duplicates using pg_trgm similarity.

**Response (200):**

```json
{
  "possible_duplicates": [
    {
      "bug_id": "uuid",
      "title": "...",
      "similarity_score": 0.82,
      "status": "CONFIRMED"
    }
  ],
  "message": "2 possible duplicates found"
}
```

**pg_trgm is required.** If unavailable, fail with a clear configuration error. Do NOT silently fall back to LIKE queries.

### `GET /projects/{project_id}/risk-analysis`

Analyze project risk based on bug metrics.

**Response (200):**

```json
{
  "risk_level": "HIGH",
  "risk_score": 65,
  "factors": [
    "3 P1 issues open",
    "2 critical issues unassigned",
    "1 blocking dependency",
    "4 issues older than 14 days"
  ],
  "recommendations": [
    "Prioritize assignment of critical issues",
    "Review blocking dependencies"
  ]
}
```

**Risk thresholds (deterministic):**

| Score | Level |
|-------|-------|
| 0–20 | LOW |
| 21–50 | MEDIUM |
| 51–80 | HIGH |
| 81+ | CRITICAL |

The same inputs must always produce the same score and risk level.

### `POST /bugs/suggest-classification`

Suggest severity/priority classification for a bug.

**Request body:**

```json
{
  "title": "...",
  "description": "..."
}
```

**Response (200):**

```json
{
  "suggested_severity": "MAJOR",
  "suggested_priority": "P2",
  "confidence": 0.78,
  "method": "deterministic"
}
```

**Architecture:** Deterministic engine first → optional LLM enhancement. If no LLM API key is configured, the endpoint still works. If the LLM fails, deterministic results are returned.

---

## Activity Log Events

These events are logged by the backend during domain mutations. All four developers must use these exact event names.

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

---

## Error Responses

All endpoints use consistent error format:

```json
{
  "detail": "Human-readable error message"
}
```

| Status Code | When |
|-------------|------|
| 400 | Bad request / validation error |
| 401 | Not authenticated |
| 403 | Authenticated but not authorized |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate membership) |
| 422 | Invalid lifecycle transition or business rule violation |
| 500 | Server error |

---

## Interactive Documentation

Swagger UI is available at: `http://localhost:8000/docs`
