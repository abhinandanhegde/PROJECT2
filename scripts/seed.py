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
  - Idempotent: uses stable UUIDs + upsert so re-running is safe.
  - Non-destructive: never truncates or drops existing data.
  - Service-role only: never copies this pattern into user-facing routes.
"""

from __future__ import annotations

import os
import sys
import uuid as _uuidlib
from datetime import datetime, timedelta, timezone

# Tolerate non-UTF-8 consoles (cp1252 etc.) when printing the banner
if sys.stdout and sys.stdout.encoding and sys.stdout.encoding.lower() not in ("utf-8", "utf8"):
    try:
        sys.stdout.reconfigure(errors="replace")
    except Exception:
        pass

# ── bootstrap ────────────────────────────────────────────────
_root = os.path.join(os.path.dirname(__file__), "..")
sys.path.insert(0, _root)

from dotenv import load_dotenv
load_dotenv(os.path.join(_root, ".env"))

DRY_RUN = "--dry-run" in sys.argv

_SEED = int(os.environ.get("T2_SEED", "42"))


def _log(msg: str) -> None:
    print(f"  {'[DRY] ' if DRY_RUN else ''}{msg}")


def _uid(*parts: str) -> str:
    """Deterministic UUID from parts — keeps the seed idempotent."""
    return str(_uuidlib.uuid5(_uuidlib.NAMESPACE_URL, ":".join(parts)))


def _dhash(s: str) -> int:
    """Deterministic integer hash (Python's built-in hash() is salted)."""
    return int(_uuidlib.uuid5(_uuidlib.NAMESPACE_URL, s).hex, 16)


def _hours_ago(h: float) -> str:
    return (datetime.now(timezone.utc) - timedelta(hours=h)).isoformat()


# ═══════════════════════════════════════════════════════════════
#  Seed Data
# ═══════════════════════════════════════════════════════════════

USERS = [
    {"id": "a0000000-0000-0000-0000-000000000001", "email": "alice@example.com",   "display_name": "Alice Chen"},
    {"id": "a0000000-0000-0000-0000-000000000002", "email": "bob@example.com",     "display_name": "Bob Martinez"},
    {"id": "a0000000-0000-0000-0000-000000000003", "email": "carol@example.com",   "display_name": "Carol Johnson"},
    {"id": "a0000000-0000-0000-0000-000000000004", "email": "dave@example.com",    "display_name": "Dave Kim"},
    {"id": "a0000000-0000-0000-0000-000000000005", "email": "eve@example.com",     "display_name": "Eve Nakamura"},
    {"id": "a0000000-0000-0000-0000-000000000006", "email": "frank@example.com",   "display_name": "Frank Alvarez"},
    {"id": "a0000000-0000-0000-0000-000000000007", "email": "grace@example.com",   "display_name": "Grace Liu"},
    {"id": "a0000000-0000-0000-0000-000000000008", "email": "henry@example.com",   "display_name": "Henry Osei"},
]

PROJECTS = [
    {"id": "b0000000-0000-0000-0000-000000000001", "name": "T2 Bug Tracker",    "description": "Core bug tracking platform"},
    {"id": "b0000000-0000-0000-0000-000000000002", "name": "T2 Mobile App",     "description": "iOS / Android companion app"},
    {"id": "b0000000-0000-0000-0000-000000000003", "name": "T2 API Gateway",    "description": "Public API gateway and rate-limiter"},
    {"id": "b0000000-0000-0000-0000-000000000004", "name": "T2 Design System",   "description": "Shared UI components and tokens"},
]

ROLES = ["ADMIN", "DEVELOPER", "QA", "REPORTER"]

# Component names are shared across projects; each project gets its own rows.
COMPONENTS_PER_PROJECT = [
    "Frontend", "Backend", "Database", "DevOps", "Mobile", "API",
]

# ──────────────────────────────────────────────────────────────
# Bug templates: (title, description, severity, priority, status, resolution)
# Covers every status/severity/priority value so graphs & reports are full.
# ──────────────────────────────────────────────────────────────
BUG_TEMPLATES = [
    # NEW — freshly filed
    (
        "Application crashes on login",
        "The application throws an unhandled exception and terminates when a user attempts to log in with special characters in the password field. Stack trace points to the authentication middleware. Affects all browsers.",
        "BLOCKER", "P1", "NEW", None,
    ),
    (
        "Bug count in project stats is incorrect",
        "The project statistics page shows 47 open bugs but the actual list returns 52. The count query appears to exclude REOPENED status.",
        "MAJOR", "P2", "NEW", None,
    ),
    (
        "Comments render markdown inconsistently",
        "Bold text (**word**) renders correctly in the comment preview but shows raw asterisks after saving.",
        "NORMAL", "P3", "NEW", None,
    ),
    (
        "Component library update breaks TypeScript imports",
        "After upgrading the shared component library to v3.2, all TypeScript imports fail with 'Cannot find module'. The v3.x release changed the export map.",
        "CRITICAL", "P1", "NEW", None,
    ),
    (
        "Export to CSV fails for large datasets",
        "Exporting 10,000+ bugs causes the process to run out of memory and return a 500 error.",
        "MAJOR", "P2", "NEW", None,
    ),
    (
        "Dark mode toggle reverts after page reload",
        "The theme choice is stored in memory only; reloading the page resets to the system preference.",
        "MINOR", "P4", "NEW", None,
    ),
    (
        "Onboarding wizard skips the project setup step",
        "When onboarding a new team, the 'create your first project' step is skipped entirely if the user presses Enter too fast.",
        "MINOR", "P4", "NEW", None,
    ),

    # CONFIRMED — reproduced
    (
        "Security: JWT tokens not invalidated on logout",
        "After logout, previously issued JWT tokens remain valid until expiry. An attacker with a stolen token can continue accessing protected resources. This is a security vulnerability requiring immediate attention.",
        "CRITICAL", "P1", "CONFIRMED", None,
    ),
    (
        "Dashboard load time exceeds 8 seconds",
        "The main dashboard takes 8-12 seconds to render on projects with more than 200 bugs. Network waterfall shows the statistics endpoint is the bottleneck.",
        "MAJOR", "P2", "CONFIRMED", None,
    ),
    (
        "Color contrast fails WCAG AA on status badges",
        "The status badge colors (light green for RESOLVED, light yellow for IN_PROGRESS) do not meet the 4.5:1 contrast ratio required by WCAG AA.",
        "MINOR", "P4", "CONFIRMED", None,
    ),
    (
        "Keyboard navigation skips comment form",
        "Tab navigation on the bug detail page jumps from the description to the submit button, bypassing the comment textarea entirely.",
        "MAJOR", "P2", "CONFIRMED", None,
    ),
    (
        "Timezone offset computed incorrectly for UTC+5:30",
        "Issues created close to midnight report the previous day's date for users in IST.",
        "NORMAL", "P3", "CONFIRMED", None,
    ),

    # IN_PROGRESS — being fixed
    (
        "Data loss on concurrent profile updates",
        "When two browser tabs update the user profile simultaneously, the second write silently overwrites the first without warning. Users lose data without any indication.",
        "CRITICAL", "P1", "IN_PROGRESS", None,
    ),
    (
        "Search returns duplicate results",
        "Using the global search with terms that match both title and description causes the same bug to appear twice in results.",
        "NORMAL", "P3", "IN_PROGRESS", None,
    ),
    (
        "Payload size limit too low for bulk import",
        "Bulk import rejects valid payloads above 1 MB. Raising the limit and switching to streaming.",
        "MAJOR", "P2", "IN_PROGRESS", None,
    ),
    (
        "Webhook retries never fire on 429 responses",
        "Delivery attempts stop after the first rate-limit response; retry count is not incremented.",
        "NORMAL", "P3", "IN_PROGRESS", None,
    ),

    # RESOLVED — fixed / declined (carries a resolution)
    (
        "No notification sent when bug is assigned",
        "When a developer is assigned to a bug, they receive no email or in-app notification. They only discover the assignment by checking their dashboard.",
        "NORMAL", "P3", "RESOLVED", "FIXED",
    ),
    (
        "Database connection pool exhaustion under load",
        "Max connections reached during peak hour benchmarks. Pool size and idle timeout were tuned.",
        "CRITICAL", "P1", "RESOLVED", "FIXED",
    ),
    (
        "Animated background causes GPU fan spin on laptops",
        "The parallax hero animation pinned the GPU at 100%. Removed animation from reduced-motion users and idle tabs.",
        "TRIVIAL", "P5", "RESOLVED", "WONT_FIX",
    ),
    (
        "Duplicate issue reports about missing pagination",
        "Several reports describe the same missing pagination on the audit log. Same root cause.",
        "MINOR", "P4", "RESOLVED", "DUPLICATE",
    ),
    (
        "Reports page renders zero for empty components",
        "A component with no bugs displayed 0/open/0 split instead of a blank state. Behavior is intended, not a bug.",
        "MINOR", "P4", "RESOLVED", "INVALID",
    ),

    # VERIFIED — QA confirmed the fix
    (
        "Mobile: buttons misaligned on small screens",
        "On screens narrower than 375px, the action buttons on the bug detail page overlap and are not tappable.",
        "MINOR", "P4", "VERIFIED", "FIXED",
    ),
    (
        "Login session survives browser crash unexpectedly",
        "After a hard browser kill, the session cookie kept the user signed in for days. Now capped at 8 hours.",
        "MAJOR", "P2", "VERIFIED", "FIXED",
    ),
    (
        "Stale cache returned after quick re-navigation",
        "Navigating back to the issue list within 5 seconds showed seconds-old data. Cache invalidation confirmed working.",
        "NORMAL", "P3", "VERIFIED", "FIXED",
    ),

    # CLOSED — done
    (
        "Typo in 404 error message",
        "The 404 page displays 'Resourse not found' instead of 'Resource not found'.",
        "TRIVIAL", "P5", "CLOSED", "FIXED",
    ),
    (
        "Signup form allows duplicate emails",
        "The email field accepted duplicate addresses, leading to duplicate user records on double-submit.",
        "MAJOR", "P2", "CLOSED", "FIXED",
    ),
    (
        "Milestone progress bar always shows 100%",
        "Milestones with any closed issue rendered a full progress bar due to an off-by-one in the total calculation.",
        "NORMAL", "P3", "CLOSED", "FIXED",
    ),

    # REOPENED — regressions / came back
    (
        "API rate limiter allows burst of 500 requests",
        "The rate limiter is configured for 100 req/min but a burst of 500 requests in 10 seconds went through without being throttled.",
        "MAJOR", "P2", "REOPENED", None,
    ),
    (
        "Recovered notification bug reappears after deploy",
        "Fix for assignment notifications worked in staging but the emails stopped again after the v3.0.1 deploy.",
        "NORMAL", "P3", "REOPENED", None,
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
    "The fix needs a database migration. Scheduling for the next maintenance window.",
    "Re-tested after the fix — all 12 test cases pass.",
    "This is a duplicate of an existing ticket. Linking the two.",
    "Escalating to P1 based on customer impact report received today.",
    "Regression confirmed after the v3.0.1 deploy. Reopening.",
    "Confirms our instrumentation — the 95th percentile p95 latency is now under 400ms.",
]

RELATIONSHIP_TYPES = ["blocks", "depends_on", "related_to"]

ACTIVITY_ACTIONS = [
    "BUG_CREATED",
    "BUG_ASSIGNED",
    "BUG_STATUS_CHANGED",
    "BUG_SEVERITY_CHANGED",
    "BUG_PRIORITY_CHANGED",
    "BUG_RESOLVED",
    "BUG_REOPENED",
    "COMMENT_CREATED",
]


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
    """Insert one bug per template, spread across components/users/time."""
    _log(f"  Seeding {len(BUG_TEMPLATES)} bugs …")
    created = []
    n = len(user_ids)
    for i, (title, desc, sev, pri, status, resolution) in enumerate(BUG_TEMPLATES):
        bug_id = _uid("bug", project_id, title)
        reporter = user_ids[i % n]
        # Every 4th bug stays unassigned (feeds the triage queue / unassigned stats)
        assignee = user_ids[(i + 1) % n] if i % 4 != 0 else None
        comp = components[i % len(components)] if components else None

        # Realistic timestamps: ~1 day … ~3 months ago, newer bugs toward the front
        hours_ago = 24 + (i * 53) % (90 * 24)
        created_at = _hours_ago(hours_ago)
        updated_at = _hours_ago(max(0, hours_ago - 6 - (i % 24)))

        bug = {
            "id": bug_id,
            "project_id": project_id,
            "component_id": comp["id"] if comp else None,
            "title": title,
            "description": desc,
            "reporter_id": reporter,
            "assignee_id": assignee,
            "status": status,
            "severity": sev,
            "priority": pri,
            "created_at": created_at,
            "updated_at": updated_at,
        }
        if resolution:
            bug["resolution"] = resolution

        if DRY_RUN:
            _log(f"  [DRY] bug: {title[:50]}")
            continue
        row = _upsert(db, "bugs", bug, "id")
        if row:
            created.append(row)
    _log(f"  {len(created)} bugs upserted")
    return created


def feed_bug_history(db, project_id: str, bug: dict, user_ids: list[str]):
    """Emit a realistic activity trail for one bug, spread over its lifetime."""
    created = datetime.fromisoformat(bug.get("created_at") or _hours_ago(24))
    now = datetime.now(timezone.utc)
    lifespan = (now - created).total_seconds()
    status = bug.get("status")

    events: list[tuple[str, float, dict]] = [
        ("BUG_CREATED", 0.0, {"title": bug.get("title", "")}),
    ]
    if bug.get("assignee_id"):
        events.append(("BUG_ASSIGNED", 0.3, {"to": bug.get("assignee_id")}))
    if status in {"CONFIRMED", "IN_PROGRESS", "RESOLVED", "VERIFIED", "CLOSED", "REOPENED"}:
        events.append(("BUG_STATUS_CHANGED", 0.5, {"new_status": status}))
        if status in {"RESOLVED", "VERIFIED", "CLOSED"}:
            events.append(("BUG_RESOLVED", 0.75, {"resolution": bug.get("resolution") or "FIXED"}))
        if status == "REOPENED":
            events.append(("BUG_REOPENED", 0.9, {}))
    events.append(("COMMENT_CREATED", 0.6, {}))

    for action, frac, payload in events:
        when = (created + timedelta(seconds=lifespan * frac)).isoformat()
        _insert_activity(db, project_id, bug.get("id"), user_ids, action, when, payload)


def _insert_activity(db, project_id: str, bug_id: str, user_ids: list[str], action: str, when: str, payload: dict):
    if DRY_RUN:
        _log(f"  [DRY] activity: {action}")
        return
    # Deterministic event id keeps seeding idempotent
    event_id = _uid("activity", action, when)
    try:
        db.table("activity_log").upsert({
            "id": event_id,
            "project_id": project_id,
            "bug_id": bug_id,
            "actor_id": user_ids[_dhash(action) % len(user_ids)],
            "action": action,
            "entity_type": "BUG",
            "entity_id": bug_id,
            "new_value": payload,
            "created_at": when,
        }, on_conflict="id").execute()
    except Exception as exc:
        _log(f"  warn: activity insert failed — {exc}")


def seed_comments(db, bugs: list[dict], user_ids: list[str]):
    """1–3 deterministic comments per bug, timed after creation."""
    if DRY_RUN:
        _log(f"  [DRY] ~{len(bugs) * 2} comments")
        return
    count = 0
    for bug in bugs:
        comment_count = 1 + (_dhash(bug["id"]) % 3)
        for j in range(comment_count):
            body = COMMENTS[(_dhash(bug["id"]) + j) % len(COMMENTS)]
            comment_id = _uid("comment", bug["id"], body)
            try:
                db.table("comments").upsert({
                    "id": comment_id,
                    "bug_id": bug["id"],
                    "author_id": user_ids[(_dhash(bug["id"]) + j) % len(user_ids)],
                    "body": body,
                    "created_at": _hours_ago(6 + j * 5),
                }, on_conflict="id").execute()
                count += 1
            except Exception:
                pass
    _log(f"  {count} comments")


def seed_relationships(db, bugs: list[dict], user_ids: list[str]):
    """Create chains + cross-links so the dependency graph is populated."""
    if len(bugs) < 2 or DRY_RUN:
        _log(f"  [DRY] relationships (skipped)")
        return
    n = 0

    def _link(a, b, rtype):
        nonlocal n
        try:
            db.table("relationships").upsert({
                "source_bug_id": a["id"],
                "target_bug_id": b["id"],
                "relationship_type": rtype,
                "created_by": user_ids[0],
            }, on_conflict="source_bug_id,target_bug_id,relationship_type").execute()
            n += 1
        except Exception:
            pass

    for i in range(len(bugs) - 1):
        _link(bugs[i], bugs[i + 1], RELATIONSHIP_TYPES[i % len(RELATIONSHIP_TYPES)])
    # Extra cross-links (every 3rd pair) for a denser graph
    for i in range(0, len(bugs) - 2, 3):
        _link(bugs[i], bugs[i + 2], "related_to")
    _log(f"  {n} relationships")


def seed_activity(db, bugs: list[dict], project_id: str, user_ids: list[str]):
    if DRY_RUN:
        _log(f"  [DRY] activity logs (skipped)")
        return
    for bug in bugs:
        feed_bug_history(db, project_id, bug, user_ids)


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

    # Cross-project linkage so the graph page connects projects together
    if all_bugs:
        for k in range(1, len(all_bugs)):
            seed_relationships(db, all_bugs[k - 1 : k + 1], user_ids)

    print(f"\n{'═' * 60}")
    bugs_done = len(all_bugs) if not DRY_RUN else len(PROJECTS) * len(BUG_TEMPLATES)
    print(f"  Done — {len(USERS)} users, {len(projects) if projects else len(PROJECTS)} projects, {bugs_done} bugs")
    print(f"{'═' * 60}\n")


if __name__ == "__main__":
    main()