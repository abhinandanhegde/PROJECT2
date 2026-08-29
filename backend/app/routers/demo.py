"""
Demo Router — One-click demo account setup with seed data.
Uses service-role client (bypasses RLS) for all operations.
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
#  Seed Data
# ═══════════════════════════════════════════════════════════════

PROJECTS = [
    {"name": "T2 Bug Tracker", "desc": "Core bug tracking platform — the main product"},
    {"name": "T2 Mobile App", "desc": "iOS / Android companion app for on-the-go bug reporting"},
    {"name": "T2 API Gateway", "desc": "Public API gateway, rate-limiter, and developer portal"},
]

COMPONENTS = ["Frontend", "Backend", "Database", "DevOps", "Mobile", "API"]

BUGS = [
    ("Application crashes on login", "Unhandled exception when logging in with special characters in password. Stack trace points to auth middleware. Affects all browsers.", "BLOCKER", "P1", "NEW", None),
    ("Security: JWT tokens not invalidated on logout", "After logout, previously issued JWT tokens remain valid until expiry. Attacker with stolen token can continue accessing resources.", "CRITICAL", "P1", "CONFIRMED", None),
    ("Data loss on concurrent profile updates", "Two browser tabs updating profile simultaneously — second write silently overwrites first.", "CRITICAL", "P1", "IN_PROGRESS", None),
    ("Dashboard load time exceeds 8 seconds", "Dashboard takes 8-12s to render on projects with 200+ bugs. Statistics endpoint is the bottleneck.", "MAJOR", "P2", "CONFIRMED", None),
    ("Bug count in project stats is incorrect", "Project stats shows 47 open bugs but actual list returns 52. Count query excludes REOPENED status.", "MAJOR", "P2", "NEW", None),
    ("Search returns duplicate results", "Global search matching both title and description shows same bug twice in results.", "NORMAL", "P3", "IN_PROGRESS", None),
    ("No notification sent when bug is assigned", "Developer assigned to bug receives no email or in-app notification.", "NORMAL", "P3", "RESOLVED", "FIXED"),
    ("Mobile: buttons misaligned on small screens", "On screens narrower than 375px, action buttons on bug detail page overlap.", "MINOR", "P4", "VERIFIED", None),
    ("Typo in 404 error message", "404 page displays 'Resourse not found' instead of 'Resource not found'.", "TRIVIAL", "P5", "CLOSED", "FIXED"),
    ("Color contrast fails WCAG AA on status badges", "Status badge colors do not meet 4.5:1 contrast ratio required by WCAG AA.", "MINOR", "P4", "CONFIRMED", None),
    ("API rate limiter allows burst of 500 requests", "Rate limiter configured for 100 req/min but burst of 500 in 10s went through.", "MAJOR", "P2", "REOPENED", None),
    ("Component library update breaks TypeScript imports", "After upgrading shared component library to v3.2, all TypeScript imports fail.", "CRITICAL", "P1", "NEW", None),
    ("Comments render markdown inconsistently", "Bold text renders in preview but shows raw asterisks after saving.", "NORMAL", "P3", "NEW", None),
    ("Accessibility: keyboard navigation skips comment form", "Tab navigation jumps from description to submit button, bypassing comment textarea.", "MAJOR", "P2", "CONFIRMED", None),
    ("Export to CSV fails for large datasets", "Exporting 10,000+ bugs to CSV causes server OOM and returns 500.", "MAJOR", "P2", "NEW", None),
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


# ═══════════════════════════════════════════════════════════════
#  Endpoint
# ═══════════════════════════════════════════════════════════════

@router.post("/setup")
async def setup_demo_account(body: DemoSetupRequest):
    """Create demo user + seed realistic data. Always re-seeds on each call."""
    db = get_service_role_client()
    errors = []

    # Step 1: Find or create user
    user_id = None
    try:
        users = db.auth.admin.list_users()
        for u in (users.users or []):
            if u.email == body.email:
                user_id = u.id
                break
    except Exception as e:
        errors.append(f"list_users: {e}")

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
            raise HTTPException(status_code=400, detail=f"create_user failed: {e}")

    if not user_id:
        raise HTTPException(status_code=500, detail="No user_id")

    # Step 2: Upsert user row
    try:
        db.table("users").upsert({
            "id": user_id, "email": body.email, "display_name": body.display_name,
        }, on_conflict="id").execute()
    except Exception as e:
        errors.append(f"upsert user: {e}")

    # Step 3: Delete old seed data — just delete projects, CASCADE handles the rest
    try:
        old = db.table("projects").select("id").eq("created_by", user_id).execute()
        for p in (old.data or []):
            pid = p["id"]
            try: db.table("projects").delete().eq("id", pid).execute()
            except Exception as e: errors.append(f"delete project {pid}: {e}")
    except Exception as e:
        errors.append(f"wipe: {e}")

    # Step 4: Seed projects
    project_ids = []
    for p in PROJECTS:
        pid = str(uuid.uuid4())
        try:
            db.table("projects").insert({
                "id": pid, "name": p["name"], "description": p["desc"], "created_by": user_id,
            }).execute()
            project_ids.append(pid)
        except Exception as e:
            errors.append(f"project {p['name']}: {e}")

    if not project_ids:
        raise HTTPException(status_code=500, detail=f"No projects created. Errors: {errors}")

    # Step 5: Membership
    for pid in project_ids:
        try:
            db.table("project_members").insert({
                "id": str(uuid.uuid4()), "project_id": pid, "user_id": user_id, "role": "ADMIN",
            }).execute()
        except Exception as e:
            errors.append(f"membership: {e}")

    # Step 6: Components
    comps_per_proj = {}
    for pid in project_ids:
        comps = []
        for name in COMPONENTS:
            cid = str(uuid.uuid4())
            try:
                db.table("components").insert({
                    "id": cid, "project_id": pid, "name": name,
                }).execute()
                comps.append({"id": cid, "name": name})
            except Exception as e:
                errors.append(f"component {name}: {e}")
        comps_per_proj[pid] = comps

    # Step 7: Bugs (first project gets all, others get first 10)
    all_bugs = []
    for pi, pid in enumerate(project_ids):
        comps = comps_per_proj.get(pid, [])
        bug_list = BUGS if pi == 0 else BUGS[:10]
        for i, (title, desc, sev, pri, status, resolution) in enumerate(bug_list):
            bug_id = str(uuid.uuid4())
            comp = comps[i % len(comps)] if comps else None
            days_ago = (len(bug_list) - i) * 2
            created = (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()

            bug_data = {
                "id": bug_id, "project_id": pid,
                "title": title, "description": desc,
                "reporter_id": user_id,
                "assignee_id": user_id if i % 3 != 0 else None,
                "status": status, "severity": sev, "priority": pri,
                "component_id": comp["id"] if comp else None,
                "created_at": created, "updated_at": created,
            }
            if resolution:
                bug_data["resolution"] = resolution

            try:
                db.table("bugs").insert(bug_data).execute()
                all_bugs.append(bug_data)
            except Exception as e:
                errors.append(f"bug '{title}': {e}")

    # Step 8: Comments (2 per bug for first 2/3)
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
                errors.append(f"comment: {e}")

    # Step 9: Relationships (per project, first 5 bugs)
    rel_count = 0
    by_proj = {}
    for b in all_bugs:
        by_proj.setdefault(b["project_id"], []).append(b)
    for pid, pbugs in by_proj.items():
        for i in range(min(5, len(pbugs) - 1)):
            try:
                db.table("relationships").insert({
                    "id": str(uuid.uuid4()),
                    "source_bug_id": pbugs[i]["id"],
                    "target_bug_id": pbugs[i + 1]["id"],
                    "relationship_type": REL_TYPES[i % len(REL_TYPES)],
                    "created_by": user_id,
                }).execute()
                rel_count += 1
            except Exception as e:
                errors.append(f"relationship: {e}")

    # Step 10: Activity log
    act_count = 0
    for pid in project_ids:
        pbugs = by_proj.get(pid, [])[:8]
        for bug in pbugs:
            for action in ["BUG_CREATED", "BUG_STATUS_CHANGED"]:
                try:
                    db.table("activity_log").insert({
                        "id": str(uuid.uuid4()),
                        "project_id": pid,
                        "bug_id": bug["id"],
                        "actor_id": user_id,
                        "action": action,
                        "entity_type": "bug",
                        "entity_id": bug["id"],
                        "new_value": {"status": bug["status"]} if action == "BUG_STATUS_CHANGED" else {"title": bug["title"]},
                    }).execute()
                    act_count += 1
                except Exception as e:
                    errors.append(f"activity: {e}")

    # Step 11: Notifications
    notif_count = 0
    if project_ids:
        for bug in by_proj.get(project_ids[0], [])[:5]:
            try:
                db.table("notifications").insert({
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "project_id": project_ids[0],
                    "bug_id": bug["id"],
                    "title": f"Bug assigned: {bug['title'][:50]}",
                    "message": f"You have been assigned to {bug['title']}",
                    "read": False,
                }).execute()
                notif_count += 1
            except Exception as e:
                errors.append(f"notification: {e}")

    result = {
        "status": "seeded",
        "user_id": user_id,
        "projects": len(project_ids),
        "bugs": len(all_bugs),
        "comments": comment_count,
        "relationships": rel_count,
        "activity_entries": act_count,
        "notifications": notif_count,
        "message": f"Demo ready: {len(all_bugs)} bugs across {len(project_ids)} projects",
    }
    if errors:
        result["warnings"] = errors[:5]

    logger.info(f"Demo seeded: {result['bugs']} bugs, {result['comments']} comments, {result['activity_entries']} activity")
    return result
