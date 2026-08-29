"""
Demo Router — One-click demo account setup

Creates a Supabase Auth user and seeds realistic project data
so the demo UI looks populated with real bugs, comments, and activity.

This is an ADMIN operation — uses the service-role client.
"""

import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.supabase_client import get_service_role_client

router = APIRouter(prefix="/api/demo", tags=["demo"])

logger = logging.getLogger(__name__)


class DemoSetupRequest(BaseModel):
    email: str
    password: str
    display_name: str = "Demo User"


# ═══════════════════════════════════════════════════════════════
#  Seed Data Constants
# ═══════════════════════════════════════════════════════════════

PROJECTS = [
    {"name": "T2 Bug Tracker", "description": "Core bug tracking platform — the main product"},
    {"name": "T2 Mobile App", "description": "iOS / Android companion app for on-the-go bug reporting"},
    {"name": "T2 API Gateway", "description": "Public API gateway, rate-limiter, and developer portal"},
]

COMPONENTS = ["Frontend", "Backend", "Database", "DevOps", "Mobile", "API"]

BUG_TEMPLATES = [
    ("Application crashes on login",
     "The application throws an unhandled exception and terminates when a user attempts to log in with special characters in the password field. Stack trace points to the authentication middleware. Affects all browsers.",
     "BLOCKER", "P1", "NEW"),
    ("Security: JWT tokens not invalidated on logout",
     "After logout, previously issued JWT tokens remain valid until expiry. An attacker with a stolen token can continue accessing protected resources. This is a security vulnerability requiring immediate attention.",
     "CRITICAL", "P1", "CONFIRMED"),
    ("Data loss on concurrent profile updates",
     "When two browser tabs update the user profile simultaneously, the second write silently overwrites the first without warning. Users lose data without any indication.",
     "CRITICAL", "P1", "IN_PROGRESS"),
    ("Dashboard load time exceeds 8 seconds",
     "The main dashboard takes 8-12 seconds to render on projects with more than 200 bugs. Network waterfall shows the statistics endpoint is the bottleneck.",
     "MAJOR", "P2", "CONFIRMED"),
    ("Bug count in project stats is incorrect",
     "The project statistics page shows 47 open bugs but the actual list returns 52. The count query appears to exclude REOPENED status.",
     "MAJOR", "P2", "NEW"),
    ("Search returns duplicate results",
     "Using the global search with terms that match both title and description causes the same bug to appear twice in results.",
     "NORMAL", "P3", "IN_PROGRESS"),
    ("No notification sent when bug is assigned",
     "When a developer is assigned to a bug, they receive no email or in-app notification. They only discover the assignment by checking their dashboard.",
     "NORMAL", "P3", "RESOLVED"),
    ("Mobile: buttons misaligned on small screens",
     "On screens narrower than 375px, the action buttons on the bug detail page overlap and are not tappable.",
     "MINOR", "P4", "VERIFIED"),
    ("Typo in 404 error message",
     "The 404 page displays 'Resourse not found' instead of 'Resource not found'.",
     "TRIVIAL", "P5", "CLOSED"),
    ("Color contrast fails WCAG AA on status badges",
     "The status badge colors (light green for RESOLVED, light yellow for IN_PROGRESS) do not meet the 4.5:1 contrast ratio required by WCAG AA.",
     "MINOR", "P4", "CONFIRMED"),
    ("API rate limiter allows burst of 500 requests",
     "The rate limiter is configured for 100 req/min but a burst of 500 requests in 10 seconds went through without being throttled.",
     "MAJOR", "P2", "REOPENED"),
    ("Component library update breaks TypeScript imports",
     "After upgrading the shared component library to v3.2, all TypeScript imports fail with 'Cannot find module'. The v3.x release changed the export map.",
     "CRITICAL", "P1", "NEW"),
    ("Comments render markdown inconsistently",
     "Bold text (**word**) renders correctly in the comment preview but shows raw asterisks after saving.",
     "NORMAL", "P3", "NEW"),
    ("Accessibility: keyboard navigation skips comment form",
     "Tab navigation on the bug detail page jumps from the description to the submit button, bypassing the comment textarea entirely.",
     "MAJOR", "P2", "CONFIRMED"),
    ("Export to CSV fails for large datasets",
     "Exporting more than 10,000 bugs to CSV causes the server to run out of memory and return a 500 error. Need streaming export.",
     "MAJOR", "P2", "NEW"),
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
    "Confirmed this also affects the mobile app — filed as MOB-123.",
    "The fix needs a database migration. Scheduling for the next maintenance window.",
    "Re-tested after the fix — all 12 test cases pass.",
    "This is a duplicate of an earlier report. Linking the two tickets.",
    "Escalating to P1 based on customer impact report received today.",
]

RELATIONSHIP_TYPES = ["blocks", "depends_on", "related_to"]


# ═══════════════════════════════════════════════════════════════
#  Demo Setup Endpoint
# ═══════════════════════════════════════════════════════════════

@router.post("/setup")
async def setup_demo_account(body: DemoSetupRequest):
    """
    Creates a demo Supabase Auth user and seeds realistic project data.
    If the user already exists, skips creation and just returns success.
    """
    db = get_service_role_client()

    # ── Step 1: Check if demo user already exists in auth ─────
    user_id = None
    try:
        existing = db.auth.admin.list_users()
        for u in (existing.users or []):
            if u.email == body.email:
                user_id = u.id
                break
    except Exception as e:
        logger.warning(f"Could not list users: {e}")

    # ── Step 2: Create Supabase Auth user if needed ───────────
    if not user_id:
        try:
            result = db.auth.admin.create_user({
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
                "user_metadata": {"display_name": body.display_name},
            })
            user_id = result.user.id
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not create demo user: {str(e)}")

    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to get or create demo user")

    # ── Step 3: Ensure user exists in public.users table ──────
    try:
        db.table("users").upsert({
            "id": user_id,
            "email": body.email,
            "display_name": body.display_name,
        }, on_conflict="id").execute()
    except Exception as e:
        logger.warning(f"Could not upsert user: {e}")

    # ── Step 4: Check if data already seeded for this user ────
    try:
        existing_projects = db.table("projects").select("id").eq("created_by", user_id).execute()
        if existing_projects.data and len(existing_projects.data) > 0:
            return {
                "status": "already_seeded",
                "user_id": user_id,
                "message": "Demo account already has data",
            }
    except Exception as e:
        logger.warning(f"Could not check existing projects: {e}")

    # ── Step 5: Seed projects ─────────────────────────────────
    project_ids = []
    for p in PROJECTS:
        proj_id = str(uuid.uuid4())
        try:
            db.table("projects").insert({
                "id": proj_id,
                "name": p["name"],
                "description": p["description"],
                "created_by": user_id,
            }).execute()
            project_ids.append(proj_id)
            logger.info(f"Created project: {p['name']}")
        except Exception as e:
            logger.error(f"Failed to create project {p['name']}: {e}")

    if not project_ids:
        raise HTTPException(status_code=500, detail="Failed to create any projects")

    # ── Step 6: Seed memberships (demo user is ADMIN on all) ──
    for proj_id in project_ids:
        try:
            db.table("project_members").upsert({
                "project_id": proj_id,
                "user_id": user_id,
                "role": "ADMIN",
            }, on_conflict="project_id,user_id").execute()
        except Exception as e:
            logger.error(f"Failed to create membership: {e}")

    # ── Step 7: Seed components per project ───────────────────
    components_per_project = {}
    for proj_id in project_ids:
        comps = []
        for name in COMPONENTS:
            comp_id = str(uuid.uuid4())
            try:
                db.table("components").insert({
                    "id": comp_id,
                    "project_id": proj_id,
                    "name": name,
                }).execute()
                comps.append({"id": comp_id, "name": name})
            except Exception as e:
                logger.error(f"Failed to create component {name}: {e}")
        components_per_project[proj_id] = comps

    # ── Step 8: Seed bugs (proper UUIDs, unique per project) ──
    all_bugs = []
    for proj_id in project_ids:
        comps = components_per_project.get(proj_id, [])
        for i, (title, desc, sev, pri, status) in enumerate(BUG_TEMPLATES):
            bug_id = str(uuid.uuid4())  # Proper UUID, unique every time
            comp = comps[i % len(comps)] if comps else None
            days_ago = (len(BUG_TEMPLATES) - i) * 2
            created = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()

            bug_data = {
                "id": bug_id,
                "project_id": proj_id,
                "title": title,
                "description": desc,
                "reporter_id": user_id,
                "assignee_id": user_id if i % 3 != 0 else None,
                "status": status,
                "severity": sev,
                "priority": pri,
                "component_id": comp["id"] if comp else None,
                "created_at": created,
                "updated_at": created,
            }
            if status in ("RESOLVED", "CLOSED"):
                bug_data["resolution"] = "FIXED"

            try:
                db.table("bugs").upsert(bug_data, on_conflict="id").execute()
                all_bugs.append(bug_data)
            except Exception as e:
                logger.error(f"Failed to create bug '{title}': {e}")

    logger.info(f"Seeded {len(all_bugs)} bugs across {len(project_ids)} projects")

    # ── Step 9: Seed comments ─────────────────────────────────
    comment_count = 0
    for bug in all_bugs[:len(all_bugs) * 2 // 3]:
        for j in range(2):
            try:
                db.table("comments").insert({
                    "id": str(uuid.uuid4()),
                    "bug_id": bug["id"],
                    "author_id": user_id,
                    "body": COMMENTS[(hash(bug["id"]) + j) % len(COMMENTS)],
                }).execute()
                comment_count += 1
            except Exception as e:
                logger.error(f"Failed to create comment: {e}")

    # ── Step 10: Seed relationships ───────────────────────────
    rel_count = 0
    bugs_by_project = {}
    for bug in all_bugs:
        pid = bug["project_id"]
        if pid not in bugs_by_project:
            bugs_by_project[pid] = []
        bugs_by_project[pid].append(bug)

    for proj_id, proj_bugs in bugs_by_project.items():
        for i in range(min(5, len(proj_bugs) - 1)):
            try:
                db.table("relationships").upsert({
                    "id": str(uuid.uuid4()),
                    "source_bug_id": proj_bugs[i]["id"],
                    "target_bug_id": proj_bugs[i + 1]["id"],
                    "relationship_type": RELATIONSHIP_TYPES[i % len(RELATIONSHIP_TYPES)],
                    "created_by": user_id,
                }, on_conflict="source_bug_id,target_bug_id,relationship_type").execute()
                rel_count += 1
            except Exception as e:
                logger.error(f"Failed to create relationship: {e}")

    # ── Step 11: Seed activity log ────────────────────────────
    activity_count = 0
    for proj_id in project_ids:
        proj_bugs = bugs_by_project.get(proj_id, [])
        for bug in proj_bugs[:8]:
            for action in ["BUG_CREATED", "BUG_STATUS_CHANGED"]:
                try:
                    db.table("activity_log").insert({
                        "id": str(uuid.uuid4()),
                        "project_id": proj_id,
                        "bug_id": bug["id"],
                        "actor_id": user_id,
                        "action": action,
                        "entity_type": "bug",
                        "entity_id": bug["id"],
                        "new_value": {"status": bug["status"]} if action == "BUG_STATUS_CHANGED" else {"title": bug["title"]},
                    }).execute()
                    activity_count += 1
                except Exception as e:
                    logger.error(f"Failed to create activity: {e}")

    # ── Step 12: Seed notifications ───────────────────────────
    notif_count = 0
    for proj_id in project_ids[:1]:
        proj_bugs = bugs_by_project.get(proj_id, [])[:5]
        for bug in proj_bugs:
            try:
                db.table("notifications").insert({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "project_id": proj_id,
                    "bug_id": bug["id"],
                    "title": f"Bug assigned: {bug['title'][:50]}",
                    "message": f"You have been assigned to {bug['title']}",
                    "read": False,
                }).execute()
                notif_count += 1
            except Exception as e:
                logger.error(f"Failed to create notification: {e}")

    return {
        "status": "seeded",
        "user_id": user_id,
        "projects": len(project_ids),
        "bugs": len(all_bugs),
        "comments": comment_count,
        "relationships": rel_count,
        "activity_entries": activity_count,
        "notifications": notif_count,
        "message": f"Demo account ready with {len(all_bugs)} bugs across {len(project_ids)} projects",
    }
