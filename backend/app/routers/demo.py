"""
Demo Router — Bulletproof one-click demo.
Handles every edge case: user exists, user doesn't exist, partial seed, etc.
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


def _find_demo_user(db, email: str) -> str | None:
    """Find demo user by email from the auth user list. Returns user_id or None."""
    try:
        users = db.auth.admin.list_users()
        # supabase-py returns a plain list
        user_list = users if isinstance(users, list) else list(users)
        for u in user_list:
            if hasattr(u, 'email') and u.email == email:
                return u.id
    except Exception as e:
        logger.error(f"list_users failed: {e}")
    return None


def _seed_all(db, user_id: str) -> dict:
    """Seed projects, bugs, comments, relationships, activity, notifications."""
    err = []

    # Delete old projects (CASCADE deletes everything else)
    try:
        old = db.table("projects").select("id").eq("created_by", user_id).execute()
        for p in (old.data or []):
            try:
                db.table("projects").delete().eq("id", p["id"]).execute()
            except Exception as e:
                err.append(f"del:{e}")
    except Exception as e:
        err.append(f"old_projects:{e}")

    # Projects
    pids = []
    for p in PROJECTS:
        pid = str(uuid.uuid4())
        try:
            db.table("projects").insert({
                "id": pid, "name": p["name"], "description": p["desc"], "created_by": user_id,
            }).execute()
            pids.append(pid)
        except Exception as e:
            err.append(f"proj:{e}")

    if not pids:
        return {"error": "; ".join(err), "projects": 0, "bugs": 0}

    # Memberships
    for pid in pids:
        try:
            db.table("project_members").insert({
                "id": str(uuid.uuid4()), "project_id": pid, "user_id": user_id, "role": "ADMIN",
            }).execute()
        except Exception as e:
            err.append(f"mem:{e}")

    # Components
    cmap = {}
    for pid in pids:
        cs = []
        for name in COMPONENTS:
            cid = str(uuid.uuid4())
            try:
                db.table("components").insert({"id": cid, "project_id": pid, "name": name}).execute()
                cs.append({"id": cid})
            except:
                pass
        cmap[pid] = cs

    # Bugs
    bugs = []
    for pi, pid in enumerate(pids):
        cs = cmap.get(pid, [])
        blist = BUGS if pi == 0 else BUGS[:10]
        for i, (title, desc, sev, pri, status, res) in enumerate(blist):
            bid = str(uuid.uuid4())
            comp = cs[i % len(cs)] if cs else None
            created = (datetime.now(timezone.utc) - timedelta(days=(len(blist) - i) * 2)).isoformat()
            bd = {
                "id": bid, "project_id": pid, "title": title, "description": desc,
                "reporter_id": user_id, "assignee_id": user_id if i % 3 != 0 else None,
                "status": status, "severity": sev, "priority": pri,
                "component_id": comp["id"] if comp else None,
                "created_at": created, "updated_at": created,
            }
            if res:
                bd["resolution"] = res
            try:
                db.table("bugs").insert(bd).execute()
                bugs.append(bd)
            except Exception as e:
                err.append(f"bug:{e}")

    # Comments
    cc = 0
    for b in bugs[:len(bugs) * 2 // 3]:
        for j in range(2):
            try:
                db.table("comments").insert({
                    "id": str(uuid.uuid4()), "bug_id": b["id"], "author_id": user_id,
                    "body": COMMENTS[(hash(b["id"]) + j) % len(COMMENTS)],
                }).execute()
                cc += 1
            except:
                pass

    # Relationships
    rc = 0
    byp = {}
    for b in bugs:
        byp.setdefault(b["project_id"], []).append(b)
    for pid, pb in byp.items():
        for i in range(min(5, len(pb) - 1)):
            try:
                db.table("relationships").insert({
                    "id": str(uuid.uuid4()), "source_bug_id": pb[i]["id"],
                    "target_bug_id": pb[i + 1]["id"],
                    "relationship_type": REL_TYPES[i % len(REL_TYPES)], "created_by": user_id,
                }).execute()
                rc += 1
            except:
                pass

    # Activity
    ac = 0
    for pid in pids:
        for b in byp.get(pid, [])[:8]:
            for action in ["BUG_CREATED", "BUG_STATUS_CHANGED"]:
                try:
                    db.table("activity_log").insert({
                        "id": str(uuid.uuid4()), "project_id": pid, "bug_id": b["id"],
                        "actor_id": user_id, "action": action, "entity_type": "BUG",
                        "entity_id": b["id"],
                        "new_value": {"status": b["status"]} if action == "BUG_STATUS_CHANGED" else {"title": b["title"]},
                    }).execute()
                    ac += 1
                except:
                    pass

    # Notifications
    nc = 0
    if pids:
        for b in byp.get(pids[0], [])[:5]:
            try:
                db.table("notifications").insert({
                    "id": str(uuid.uuid4()), "user_id": user_id, "project_id": pids[0],
                    "bug_id": b["id"], "title": f"Bug assigned: {b['title'][:50]}",
                    "message": f"You have been assigned to {b['title']}", "read": False,
                }).execute()
                nc += 1
            except:
                pass

    return {"projects": len(pids), "bugs": len(bugs), "comments": cc,
            "relationships": rc, "activity": ac, "notifications": nc, "errors": err[:3]}


@router.post("/setup")
async def setup_demo_account(body: DemoSetupRequest):
    """One-click demo. Handles every edge case."""
    db = get_service_role_client()
    user_id = None

    # Step 1: Try to find existing demo user
    user_id = _find_demo_user(db, body.email)

    # Step 2: Create if not found
    if not user_id:
        try:
            result = db.auth.admin.create_user({
                "email": body.email,
                "password": body.password,
                "email_confirm": True,
                "user_metadata": {"display_name": body.display_name},
            })
            user_id = result.user.id
            logger.info(f"Created new demo user: {user_id}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Cannot create demo user: {e}")

    if not user_id:
        raise HTTPException(status_code=500, detail="No user_id obtained")

    # Step 3: Ensure public.users row exists
    try:
        db.table("users").upsert({
            "id": user_id, "email": body.email, "display_name": body.display_name,
        }, on_conflict="id").execute()
    except Exception as e:
        logger.warning(f"users upsert failed: {e}")

    # Step 4: Check if already has enough bugs
    try:
        existing = db.table("bugs").select("id").eq("reporter_id", user_id).execute()
        if len(existing.data or []) >= 10:
            return {"status": "ok", "user_id": user_id, "bugs": len(existing.data),
                    "message": f"Demo ready ({len(existing.data)} bugs already seeded)"}
    except:
        pass

    # Step 5: Seed everything
    result = _seed_all(db, user_id)
    return {"status": "seeded", "user_id": user_id, **result,
            "message": f"Demo ready: {result.get('bugs', 0)} bugs across {result.get('projects', 0)} projects"}
