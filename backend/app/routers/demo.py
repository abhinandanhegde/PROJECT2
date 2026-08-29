"""
Demo Router — Bulletproof one-click demo with fixed UUID.
Creates user with a deterministic UUID so we never lose track of it.
"""
import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.supabase_client import get_service_role_client

router = APIRouter(prefix="/api/demo", tags=["demo"])
logger = logging.getLogger(__name__)

DEMO_EMAIL = "demo@bugflow.app"
DEMO_PASS = "Demo1234!"
DEMO_NAME = "Demo User"
# Fixed UUID so we always find the demo user
DEMO_USER_ID = "a0000000-0000-4000-a000-000000000001"


class DemoSetupRequest(BaseModel):
    email: str = DEMO_EMAIL
    password: str = DEMO_PASS
    display_name: str = DEMO_NAME


PROJECTS = [
    {"name": "T2 Bug Tracker", "desc": "Core bug tracking platform — the main product"},
    {"name": "T2 Mobile App", "desc": "iOS / Android companion app for on-the-go bug reporting"},
    {"name": "T2 API Gateway", "desc": "Public API gateway, rate-limiter, and developer portal"},
]

COMPONENTS = ["Frontend", "Backend", "Database", "DevOps", "Mobile", "API"]

BUGS = [
    ("Application crashes on login", "Unhandled exception when logging in with special characters in password. Stack trace points to auth middleware.", "BLOCKER", "P1", "NEW", None),
    ("Security: JWT tokens not invalidated on logout", "After logout, previously issued JWT tokens remain valid until expiry.", "CRITICAL", "P1", "CONFIRMED", None),
    ("Data loss on concurrent profile updates", "Two browser tabs updating profile simultaneously — second write silently overwrites first.", "CRITICAL", "P1", "IN_PROGRESS", None),
    ("Dashboard load time exceeds 8 seconds", "Dashboard takes 8-12s to render on projects with 200+ bugs.", "MAJOR", "P2", "CONFIRMED", None),
    ("Bug count in project stats is incorrect", "Project stats shows 47 open bugs but actual list returns 52.", "MAJOR", "P2", "NEW", None),
    ("Search returns duplicate results", "Global search matching title and description shows same bug twice.", "NORMAL", "P3", "IN_PROGRESS", None),
    ("No notification sent when bug is assigned", "Developer assigned to bug receives no email or in-app notification.", "NORMAL", "P3", "RESOLVED", "FIXED"),
    ("Mobile: buttons misaligned on small screens", "On screens narrower than 375px, action buttons overlap.", "MINOR", "P4", "VERIFIED", None),
    ("Typo in 404 error message", "404 page displays 'Resourse not found' instead of 'Resource not found'.", "TRIVIAL", "P5", "CLOSED", "FIXED"),
    ("Color contrast fails WCAG AA", "Status badge colors do not meet 4.5:1 contrast ratio.", "MINOR", "P4", "CONFIRMED", None),
    ("API rate limiter allows burst of 500 requests", "Rate limiter configured for 100 req/min but burst of 500 in 10s went through.", "MAJOR", "P2", "REOPENED", None),
    ("Component library breaks TypeScript imports", "After upgrading shared component library to v3.2, all TypeScript imports fail.", "CRITICAL", "P1", "NEW", None),
    ("Comments render markdown inconsistently", "Bold text renders in preview but shows raw asterisks after saving.", "NORMAL", "P3", "NEW", None),
    ("Keyboard navigation skips comment form", "Tab navigation jumps from description to submit button.", "MAJOR", "P2", "CONFIRMED", None),
    ("Export to CSV fails for large datasets", "Exporting 10,000+ bugs causes server OOM and returns 500.", "MAJOR", "P2", "NEW", None),
]

COMMENTS = [
    "I can reproduce this consistently on Chrome 120 and Firefox 121.",
    "Introduced in v2.4 release — previous version worked correctly.",
    "Seems related to recent Supabase migration. Checking query plan.",
    "Adding stack trace from error logs for additional context.",
    "Affects all Pro plan users. Free tier unaffected.",
    "Workaround: clear browser cache and hard-reload.",
    "Assigned to backend team for root-cause investigation.",
    "Root cause identified — missing null check in parser. PR incoming.",
    "Ready for QA review. Fix on fix/login-crash branch.",
    "Verified in staging. Closing after 24h soak test.",
]

REL_TYPES = ["blocks", "depends_on", "related_to"]


def seed_data(db, user_id: str) -> dict:
    """Seed all demo data. Returns counts."""
    errors = []

    # Delete old data by deleting projects (CASCADE handles rest)
    try:
        old = db.table("projects").select("id").eq("created_by", user_id).execute()
        for p in (old.data or []):
            try:
                db.table("projects").delete().eq("id", p["id"]).execute()
            except Exception as e:
                errors.append(f"del project: {e}")
    except Exception as e:
        errors.append(f"list old projects: {e}")

    # Create projects
    project_ids = []
    for p in PROJECTS:
        pid = str(uuid.uuid4())
        try:
            db.table("projects").insert({
                "id": pid, "name": p["name"], "description": p["desc"], "created_by": user_id,
            }).execute()
            project_ids.append(pid)
        except Exception as e:
            errors.append(f"project: {e}")

    if not project_ids:
        return {"error": f"No projects created: {errors}"}

    # Membership
    for pid in project_ids:
        try:
            db.table("project_members").insert({
                "id": str(uuid.uuid4()), "project_id": pid, "user_id": user_id, "role": "ADMIN",
            }).execute()
        except Exception as e:
            errors.append(f"membership: {e}")

    # Components
    comps_map = {}
    for pid in project_ids:
        comps = []
        for name in COMPONENTS:
            cid = str(uuid.uuid4())
            try:
                db.table("components").insert({"id": cid, "project_id": pid, "name": name}).execute()
                comps.append({"id": cid, "name": name})
            except Exception as e:
                errors.append(f"comp: {e}")
        comps_map[pid] = comps

    # Bugs
    all_bugs = []
    for pi, pid in enumerate(project_ids):
        comps = comps_map.get(pid, [])
        bug_list = BUGS if pi == 0 else BUGS[:10]
        for i, (title, desc, sev, pri, status, resolution) in enumerate(bug_list):
            bug_id = str(uuid.uuid4())
            comp = comps[i % len(comps)] if comps else None
            created = (datetime.now(timezone.utc) - timedelta(days=(len(bug_list) - i) * 2)).isoformat()
            bug = {
                "id": bug_id, "project_id": pid, "title": title, "description": desc,
                "reporter_id": user_id, "assignee_id": user_id if i % 3 != 0 else None,
                "status": status, "severity": sev, "priority": pri,
                "component_id": comp["id"] if comp else None,
                "created_at": created, "updated_at": created,
            }
            if resolution:
                bug["resolution"] = resolution
            try:
                db.table("bugs").insert(bug).execute()
                all_bugs.append(bug)
            except Exception as e:
                errors.append(f"bug: {e}")

    # Comments
    ccount = 0
    for bug in all_bugs[:len(all_bugs) * 2 // 3]:
        for j in range(2):
            try:
                db.table("comments").insert({
                    "id": str(uuid.uuid4()), "bug_id": bug["id"], "author_id": user_id,
                    "body": COMMENTS[(hash(bug["id"]) + j) % len(COMMENTS)],
                }).execute()
                ccount += 1
            except Exception as e:
                errors.append(f"comment: {e}")

    # Relationships
    rcount = 0
    by_proj = {}
    for b in all_bugs:
        by_proj.setdefault(b["project_id"], []).append(b)
    for pid, pbugs in by_proj.items():
        for i in range(min(5, len(pbugs) - 1)):
            try:
                db.table("relationships").insert({
                    "id": str(uuid.uuid4()), "source_bug_id": pbugs[i]["id"],
                    "target_bug_id": pbugs[i + 1]["id"],
                    "relationship_type": REL_TYPES[i % len(REL_TYPES)], "created_by": user_id,
                }).execute()
                rcount += 1
            except Exception as e:
                errors.append(f"rel: {e}")

    # Activity log
    acount = 0
    for pid in project_ids:
        for bug in by_proj.get(pid, [])[:8]:
            for action in ["BUG_CREATED", "BUG_STATUS_CHANGED"]:
                try:
                    db.table("activity_log").insert({
                        "id": str(uuid.uuid4()), "project_id": pid, "bug_id": bug["id"],
                        "actor_id": user_id, "action": action, "entity_type": "bug",
                        "entity_id": bug["id"],
                        "new_value": {"status": bug["status"]} if action == "BUG_STATUS_CHANGED" else {"title": bug["title"]},
                    }).execute()
                    acount += 1
                except Exception as e:
                    errors.append(f"activity: {e}")

    # Notifications
    ncount = 0
    if project_ids:
        for bug in by_proj.get(project_ids[0], [])[:5]:
            try:
                db.table("notifications").insert({
                    "id": str(uuid.uuid4()), "user_id": user_id, "project_id": project_ids[0],
                    "bug_id": bug["id"], "title": f"Bug assigned: {bug['title'][:50]}",
                    "message": f"You have been assigned to {bug['title']}", "read": False,
                }).execute()
                ncount += 1
            except Exception as e:
                errors.append(f"notif: {e}")

    return {
        "projects": len(project_ids), "bugs": len(all_bugs), "comments": ccount,
        "relationships": rcount, "activity": acount, "notifications": ncount,
        "errors": errors[:3],
    }


@router.post("/setup")
async def setup_demo_account(body: DemoSetupRequest):
    """Bulletproof demo setup. Always works."""
    db = get_service_role_client()

    # Step 1: Find or create user
    user_id = None

    # Try creating with fixed UUID
    try:
        result = db.auth.admin.create_user({
            "email": body.email,
            "password": body.password,
            "email_confirm": True,
            "user_metadata": {"display_name": body.display_name},
            "id": DEMO_USER_ID,
        })
        user_id = result.user.id
        logger.info(f"Created demo user: {user_id}")
    except Exception as e:
        logger.info(f"create_user failed (probably exists): {e}")

    # If creation failed, the user already exists — find them
    if not user_id:
        try:
            # Try to get user directly by ID first
            try:
                u = db.auth.admin.get_user_by_id(DEMO_USER_ID)
                if u and u.user:
                    user_id = u.user.id
            except:
                pass

            # Fallback: list all users
            if not user_id:
                users = db.auth.admin.list_users()
                for u in (users.users or []):
                    if u.email == body.email:
                        user_id = u.id
                        break
        except Exception as e:
            logger.error(f"Cannot find user: {e}")

    if not user_id:
        raise HTTPException(status_code=500, detail="Cannot find or create demo user. Delete demo@bugflow.app from Supabase Auth > Users and try again.")

    # Step 2: Ensure user row exists
    try:
        db.table("users").upsert({
            "id": user_id, "email": body.email, "display_name": body.display_name,
        }, on_conflict="id").execute()
    except Exception as e:
        logger.warning(f"upsert user row failed: {e}")

    # Step 3: Check if already seeded
    try:
        existing = db.table("bugs").select("id", count="exact").eq("reporter_id", user_id).execute()
        count = existing.count or 0
        if count >= 10:
            return {
                "status": "already_seeded", "user_id": user_id, "bugs": count,
                "message": f"Demo already has {count} bugs. Ready to go!",
            }
    except Exception:
        pass

    # Step 4: Seed data
    result = seed_data(db, user_id)

    return {
        "status": "seeded", "user_id": user_id,
        "message": f"Demo ready: {result.get('bugs', 0)} bugs across {result.get('projects', 0)} projects",
        **result,
    }
