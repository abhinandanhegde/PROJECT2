"""
T2 Bug Tracker — Database Seed Script

Seeds realistic development data for local/testing environments.
Uses the service-role Supabase client (admin operations only).

Usage
-----
    python -m scripts.seed              # normal seed
    python -m scripts.seed --dry-run    # preview without writing

Safety
------
  - Idempotent: uses upsert so re-running is safe.
  - Non-destructive: never truncates or drops existing data.
  - Service-role only: never copies this pattern into user-facing routes.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime, timedelta, timezone

# ── bootstrap ────────────────────────────────────────────────
_root = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, _root)

from dotenv import load_dotenv
load_dotenv(os.path.join(_root, ".env"))

DRY_RUN = "--dry-run" in sys.argv


def _log(msg: str) -> None:
    print(f"  {'[DRY] ' if DRY_RUN else ''}{msg}")


# ═══════════════════════════════════════════════════════════════
#  Seed Data
# ═══════════════════════════════════════════════════════════════

USERS = [
    {"id": "a0000000-0000-0000-0000-000000000001", "email": "alice@example.com",   "display_name": "Alice Chen"},
    {"id": "a0000000-0000-0000-0000-000000000002", "email": "bob@example.com",     "display_name": "Bob Martinez"},
    {"id": "a0000000-0000-0000-0000-000000000003", "email": "carol@example.com",   "display_name": "Carol Johnson"},
    {"id": "a0000000-0000-0000-0000-000000000004", "email": "dave@example.com",    "display_name": "Dave Kim"},
    {"id": "a0000000-0000-0000-0000-000000000005", "email": "eve@example.com",     "display_name": "Eve Nakamura"},
]

PROJECTS = [
    {"id": "b0000000-0000-0000-0000-000000000001", "name": "T2 Bug Tracker",    "description": "Core bug tracking platform"},
    {"id": "b0000000-0000-0000-0000-000000000002", "name": "T2 Mobile App",     "description": "iOS / Android companion app"},
    {"id": "b0000000-0000-0000-0000-000000000003", "name": "T2 API Gateway",    "description": "Public API gateway and rate-limiter"},
]

ROLES = ["ADMIN", "DEVELOPER", "QA", "REPORTER"]

COMPONENTS_PER_PROJECT = ["Frontend", "Backend", "Database", "DevOps", "Mobile", "API"]

BUG_TEMPLATES = [
    # (title, description, severity, priority, status)
    (
        "Application crashes on login",
        "The application throws an unhandled exception and terminates when a user attempts to log in with special characters in the password field. Stack trace points to the authentication middleware. Affects all browsers.",
        "BLOCKER", "P1", "NEW",
    ),
    (
        "Security: JWT tokens not invalidated on logout",
        "After logout, previously issued JWT tokens remain valid until expiry. An attacker with a stolen token can continue accessing protected resources. This is a security vulnerability requiring immediate attention.",
        "CRITICAL", "P1", "CONFIRMED",
    ),
    (
        "Data loss on concurrent profile updates",
        "When two browser tabs update the user profile simultaneously, the second write silently overwrites the first without warning. Users lose data without any indication.",
        "CRITICAL", "P1", "IN_PROGRESS",
    ),
    (
        "Dashboard load time exceeds 8 seconds",
        "The main dashboard takes 8-12 seconds to render on projects with more than 200 bugs. Network waterfall shows the statistics endpoint is the bottleneck.",
        "MAJOR", "P2", "CONFIRMED",
    ),
    (
        "Bug count in project stats is incorrect",
        "The project statistics page shows 47 open bugs but the actual list returns 52. The count query appears to exclude REOPENED status.",
        "MAJOR", "P2", "NEW",
    ),
    (
        "Search returns duplicate results",
        "Using the global search with terms that match both title and description causes the same bug to appear twice in results.",
        "NORMAL", "P3", "IN_PROGRESS",
    ),
    (
        "No notification sent when bug is assigned",
        "When a developer is assigned to a bug, they receive no email or in-app notification. They only discover the assignment by checking their dashboard.",
        "NORMAL", "P3", "RESOLVED",
    ),
    (
        "Mobile: buttons misaligned on small screens",
        "On screens narrower than 375px, the action buttons on the bug detail page overlap and are not tappable.",
        "MINOR", "P4", "VERIFIED",
    ),
    (
        "Typo in 404 error message",
        "The 404 page displays 'Resourse not found' instead of 'Resource not found'.",
        "TRIVIAL", "P5", "CLOSED",
    ),
    (
        "Color contrast fails WCAG AA on status badges",
        "The status badge colors (light green for RESOLVED, light yellow for IN_PROGRESS) do not meet the 4.5:1 contrast ratio required by WCAG AA.",
        "MINOR", "P4", "CONFIRMED",
    ),
    (
        "API rate limiter allows burst of 500 requests",
        "The rate limiter is configured for 100 req/min but a burst of 500 requests in 10 seconds went through without being throttled.",
        "MAJOR", "P2", "REOPENED",
    ),
    (
        "Component library update breaks TypeScript imports",
        "After upgrading the shared component library to v3.2, all TypeScript imports fail with 'Cannot find module'. The v3.x release changed the export map.",
        "CRITICAL", "P1", "NEW",
    ),
    (
        "Comments render markdown inconsistently",
        "Bold text (**word**) renders correctly in the comment preview but shows raw asterisks after saving.",
        "NORMAL", "P3", "NEW",
    ),
    (
        "Accessibility: keyboard navigation skips comment form",
        "Tab navigation on the bug detail page jumps from the description to the submit button, bypassing the comment textarea entirely.",
        "MAJOR", "P2", "CONFIRMED",
    ),
]

COMMENTS = [
    "I can reproduce this issue consistently on Chrome 120 and Firefox 121.",
    "This was introduced in the v2.4 release — the previous version worked correctly.",
    "Seems related to the recent Supabase migration. Checking the query plan now.",
    "Adding stack trace from the error logs for additional context.",
    "This affects all users on the Pro plan. Free tier appears unaffected.",
    "Workaround: clear browser cache and hard-reload the page.",
    "Assigned to the backend team for root-cause investigation.",
    "Root cause identified — a missing null check in the parser. PR incoming.",
    "Ready for QA review. Fix is on the `fix/login-crash` branch.",
    "Verified fix in the staging environment. Closing after 24h soak test.",
    "Confirmed this also affects the mobile app —同步 filed as MOB-123.",
    "The fix needs a database migration. Scheduling for the next maintenance window.",
    "Re-tested after the fix — all 12 test cases pass.",
    "This is a duplicate of BUG-042. Linking the two tickets.",
    "Escalating to P1 based on customer impact report received today.",
]

RELATIONSHIP_TYPES = ["blocks", "depends_on", "related_to"]


# ═══════════════════════════════════════════════════════════════
#  Seed Functions
# ═══════════════════════════════════════════════════════════════

def _upsert(db, table: str, data: dict, conflict_cols: str):
    """Upsert a single row; skip on error."""
    if DRY_RUN:
        _log(f"upsert → {table}")
        return None
    try:
        r = db.table(table).upsert(data, on_conflict=conflict_cols).execute()
        return r.data[0] if r.data else None
    except Exception as exc:
        _log(f"warn: {table} upsert failed — {exc}")
        return None


def seed_users(db) -> list[dict]:
    _log("Seeding users …")
    out = []
    for u in USERS:
        row = _upsert(db, "users", u, "id")
        if row:
            out.append(row)
            _log(f"  + {u['display_name']}")
    return out


def seed_projects(db, creator_id: str) -> list[dict]:
    _log("Seeding projects …")
    out = []
    for p in PROJECTS:
        row = _upsert(db, "projects", {**p, "created_by": creator_id}, "id")
        if row:
            out.append(row)
            _log(f"  + {p['name']}")
    return out


def seed_memberships(db, project_id: str, user_ids: list[str]):
    _log(f"  Memberships for {project_id[:8]}…")
    for i, uid in enumerate(user_ids):
        _upsert(db, "project_members", {
            "project_id": project_id,
            "user_id": uid,
            "role": ROLES[i % len(ROLES)],
        }, "project_id,user_id")


def seed_components(db, project_id: str) -> list[dict]:
    out = []
    for name in COMPONENTS_PER_PROJECT:
        row = _upsert(db, "components", {"project_id": project_id, "name": name}, "project_id,name")
        if row:
            out.append(row)
    _log(f"  {len(out)} components")
    return out


def seed_bugs(db, project_id: str, user_ids: list[str], components: list[dict]) -> list[dict]:
    _log(f"  Seeding {len(BUG_TEMPLATES)} bugs …")
    created = []
    for i, (title, desc, sev, pri, status) in enumerate(BUG_TEMPLATES):
        reporter = user_ids[i % 2]
        assignee = user_ids[1 + (i % (len(user_ids) - 1))] if i % 4 != 0 else None
        comp = components[i % len(components)] if components else None
        days_ago = (len(BUG_TEMPLATES) - i) * 3

        bug = {
            "project_id": project_id,
            "title": title,
            "description": desc,
            "reporter_id": reporter,
            "assignee_id": assignee,
            "status": status,
            "severity": sev,
            "priority": pri,
            "component_id": comp["id"] if comp else None,
        }
        if status == "RESOLVED":
            bug["resolution"] = "FIXED"
        elif status == "CLOSED":
            bug["resolution"] = "FIXED"

        if DRY_RUN:
            _log(f"  [DRY] bug: {title[:50]}")
            continue
        try:
            r = db.table("bugs").insert(bug).execute()
            if r.data:
                created.append(r.data[0])
        except Exception as exc:
            _log(f"  warn: bug insert failed — {exc}")
    _log(f"  {len(created)} bugs created")
    return created


def seed_comments(db, bugs: list[dict], user_ids: list[str]):
    if DRY_RUN:
        _log(f"  [DRY] ~{len(bugs) * 2} comments")
        return
    count = 0
    for bug in bugs[: len(bugs) * 2 // 3]:
        for j in range(min(2, len(COMMENTS))):
            try:
                db.table("comments").insert({
                    "bug_id": bug["id"],
                    "author_id": user_ids[j % len(user_ids)],
                    "body": COMMENTS[(hash(bug["id"]) + j) % len(COMMENTS)],
                }).execute()
                count += 1
            except Exception:
                pass
    _log(f"  {count} comments")


def seed_relationships(db, bugs: list[dict], user_ids: list[str]):
    if len(bugs) < 2 or DRY_RUN:
        _log(f"  [DRY] relationships (skipped)")
        return
    n = 0
    for i in range(min(6, len(bugs) - 1)):
        try:
            db.table("relationships").upsert({
                "source_bug_id": bugs[i]["id"],
                "target_bug_id": bugs[i + 1]["id"],
                "relationship_type": RELATIONSHIP_TYPES[i % len(RELATIONSHIP_TYPES)],
                "created_by": user_ids[0],
            }, on_conflict="source_bug_id,target_bug_id,relationship_type").execute()
            n += 1
        except Exception:
            pass
    _log(f"  {n} relationships")


def seed_activity(db, bugs: list[dict], project_id: str, user_ids: list[str]):
    if DRY_RUN:
        _log(f"  [DRY] activity logs (skipped)")
        return
    for bug in bugs:
        for action, details in [
            ("BUG_CREATED", {"title": bug.get("title", "")}),
            ("BUG_STATUS_CHANGED", {"new_status": bug.get("status", "NEW")}),
        ]:
            try:
                db.rpc("log_activity", {
                    "p_project_id": project_id,
                    "p_actor_id": user_ids[0],
                    "p_action": action,
                    "p_entity_type": "BUG",
                    "p_entity_id": bug["id"],
                    "p_bug_id": bug["id"],
                    "p_new_value": details,
                }).execute()
            except Exception:
                pass


# ═══════════════════════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════════════════════

def main():
    banner = "T2 Bug Tracker — Seed Script"
    print(f"\n{'═' * 60}\n  {banner}\n{'═' * 60}\n")

    if not os.getenv("SUPABASE_SERVICE_ROLE_KEY") and not DRY_RUN:
        print("ERROR: SUPABASE_SERVICE_ROLE_KEY not set. Run with --dry-run or set the env var.")
        sys.exit(1)

    from backend.app.supabase_client import get_service_role_client
    db = get_service_role_client() if not DRY_RUN else None

    users = seed_users(db)
    user_ids = [u["id"] for u in USERS]

    projects = seed_projects(db, user_ids[0])

    all_bugs: list[dict] = []
    for proj in projects:
        seed_memberships(db, proj["id"], user_ids)
        comps = seed_components(db, proj["id"])
        bugs = seed_bugs(db, proj["id"], user_ids, comps)
        all_bugs.extend(bugs)
        seed_comments(db, bugs, user_ids)
        seed_relationships(db, bugs, user_ids)
        seed_activity(db, bugs, proj["id"], user_ids)

    print(f"\n{'═' * 60}")
    print(f"  Done — {len(USERS)} users, {len(projects)} projects, {len(all_bugs)} bugs")
    print(f"{'═' * 60}\n")


if __name__ == "__main__":
    main()
