# Database — T2 Bug Tracker

Supabase PostgreSQL with Row-Level Security (RLS) enforcing project-level access control.

## Setup Instructions

Apply SQL files in this order via the **Supabase SQL Editor** (Dashboard → SQL Editor):

```
1. schema.sql          — Tables, enums, indexes, triggers
2. rls.sql             — Row-Level Security policies
3. auth_trigger.sql    — Supabase Auth → users sync trigger
4. audit_function.sql  — log_activity() function for audit trail
5. project_creation.sql — Atomic project + admin membership creation
6. fix_rls_policies.sql — RLS policy fixes (comments UPDATE, activity_log INSERT, notifications)
```

> **Note:** `fix_rls_policies.sql` supersedes the older `fix_rls_inserts.sql`.
> The older file's `notifications` policy (`WITH CHECK (true)`) is insecure and the
> `activity_log` policy lacked a project-membership check — do not apply it.

**⚠️ Order matters.** RLS depends on tables existing. Auth trigger depends on the `users` table.

## Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles (synced from Supabase Auth) |
| `projects` | Projects/bug trackers |
| `project_members` | Project membership + RBAC roles |
| `components` | Subdivisions within a project |
| `bugs` | Core bug entities |
| `comments` | Bug comments |
| `attachments` | File attachments on bugs |
| `relationships` | Links between bugs (blocks, depends_on, related_to) |
| `activity_log` | Audit trail for all mutations |
| `notifications` | User notifications |
| `saved_searches` | User-saved search filters |

## Enums

| Enum | Values |
|------|--------|
| `bug_status` | NEW, CONFIRMED, IN_PROGRESS, RESOLVED, VERIFIED, CLOSED, REOPENED |
| `bug_resolution` | FIXED, WONT_FIX, DUPLICATE, INVALID |
| `bug_severity` | BLOCKER, CRITICAL, MAJOR, NORMAL, MINOR, TRIVIAL |
| `bug_priority` | P1, P2, P3, P4, P5 |
| `project_role` | REPORTER, DEVELOPER, QA, ADMIN |

## Key Functions

### `log_activity()`
Called by FastAPI endpoints to log audit events. SECURITY DEFINER — validates `actor_id` matches `auth.uid()`.

```sql
SELECT public.log_activity(
  p_project_id := '...',
  p_bug_id := '...',        -- nullable
  p_actor_id := '...',
  p_action := 'BUG_CREATED',
  p_entity_type := 'bug',
  p_entity_id := '...',
  p_old_value := NULL,       -- nullable JSONB
  p_new_value := '...'::JSONB
);
```

### `create_project()`
Atomically creates a project + the creator's ADMIN membership.

```sql
SELECT public.create_project('My Project', 'Description here');
```

### `is_project_member()`
Check if a user belongs to a project. Used in RLS policies.

### `get_project_role()`
Get a user's role within a project. Used in RLS policies.

## RLS Summary

| Table | Read | Create | Update | Delete |
|-------|------|--------|--------|--------|
| users | All authenticated | — | Own profile only | — |
| projects | Members only | Any authenticated | ADMIN only | ADMIN only |
| project_members | Members only | ADMIN only | ADMIN only | ADMIN or self |
| components | Members only | ADMIN, DEVELOPER | ADMIN, DEVELOPER | ADMIN, DEVELOPER |
| bugs | Members only | REPORTER, DEVELOPER, ADMIN | Role-based (see below) | ADMIN only |
| comments | Project members | Project members | — | Author or ADMIN |
| attachments | Project members | Project members | — | Uploader or ADMIN |
| relationships | Project members | Project members | — | Creator or ADMIN |
| activity_log | Project members | via log_activity() | — | — |
| notifications | Own only | — | Own only | — |
| saved_searches | Own only | Own only | Own only | Own only |

### Bug Update Rules (RLS + App Layer)
- **REPORTER**: Can update own bugs (title, description, severity, priority, component)
- **DEVELOPER**: Can update any bug in project (status, assignee, resolution, priority, severity)
- **ADMIN**: Full control over any bug

## Database Connection Pattern (Critical for Dev 2)

```
┌─────────────────────────────────────────────────────────┐
│ USER-CONTEXT CLIENT (normal API requests)               │
│                                                         │
│ Request JWT → extract + verify → authenticated user     │
│   ↓ create Supabase client with user's JWT              │
│   ↓ DB request with that user's auth context            │
│   ↓ auth.uid() = authenticated user                     │
│   ↓ RLS enforces project access                        │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ SERVICE-ROLE CLIENT (admin/background ONLY)             │
│                                                         │
│ Seed scripts, migrations, admin tasks                   │
│   ↓ bypasses RLS                                        │
│   ↓ NEVER for normal user requests                      │
│   ↓ NEVER exposed to frontend                           │
└─────────────────────────────────────────────────────────┘
```

## Activity Log Events

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

## Bug Lifecycle State Machine

```
NEW → CONFIRMED → IN_PROGRESS → RESOLVED → VERIFIED → CLOSED

REOPENED → CONFIRMED, IN_PROGRESS
CLOSED → REOPENED (ADMIN only)
```

Resolution is required when status = RESOLVED. Resolution must be NULL for all other statuses.
