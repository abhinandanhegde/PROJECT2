"""
Demo Router — Bulletproof one-click demo.
Handles every edge case: user exists, user doesn't exist, partial seed, etc.
"""
import os
import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.supabase_client import get_service_role_client

router = APIRouter(prefix="/api/demo", tags=["demo"])
logger = logging.getLogger(__name__)

# Overridable in backend/.env (DEMO_EMAIL, DEMO_PASSWORD, DEMO_NAME)
DEMO_EMAIL = os.getenv("DEMO_EMAIL", "demo@bugflow.app")
DEMO_PASS = os.getenv("DEMO_PASSWORD", "Demo1234!")
DEMO_NAME = os.getenv("DEMO_NAME", "Demo User")


class DemoSetupRequest(BaseModel):
    email: str = DEMO_EMAIL
    password: str = DEMO_PASS
    display_name: str = DEMO_NAME


from app.seed_data import (
    USERS, PROJECTS, ROLES, COMPONENTS_PER_PROJECT,
    BUG_TEMPLATES, COMMENTS, RELATIONSHIP_TYPES
)

def _uid(*parts: str) -> str:
    """Deterministic UUID from parts — keeps the seed idempotent."""
    return str(uuid.uuid5(uuid.NAMESPACE_URL, ":".join(parts)))


def _find_demo_user(db, email: str) -> str | None:
    """Find demo user by email from the auth user list. Returns user_id or None."""
    try:
        users = db.auth.admin.list_users()
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

    # Step 1: Ensure all seed users exist in auth.users and public.users
    try:
        existing_auth = db.auth.admin.list_users()
        existing_emails = {usr.email for usr in existing_auth}
    except Exception as e:
        err.append(f"list_users:{e}")
        existing_emails = set()

    for u in USERS:
        if u["email"] not in existing_emails:
            try:
                db.auth.admin.create_user({
                    "id": u["id"],
                    "email": u["email"],
                    "password": "Password123!",
                    "email_confirm": True,
                    "user_metadata": {"display_name": u["display_name"]},
                })
            except Exception as e:
                err.append(f"create_user_{u['email']}:{e}")
        
        try:
            db.table("users").upsert(u, on_conflict="id").execute()
        except Exception as e:
            err.append(f"upsert_user_{u['email']}:{e}")

    # Step 2: Delete old seeded projects (CASCADE deletes everything else)
    for p in PROJECTS:
        try:
            db.table("projects").delete().eq("id", p["id"]).execute()
        except Exception as e:
            err.append(f"del_proj_{p['name']}:{e}")

    # Step 3: Insert projects
    for p in PROJECTS:
        try:
            db.table("projects").insert({
                "id": p["id"],
                "name": p["name"],
                "description": p["description"],
                "created_by": "a0000000-0000-0000-0000-000000000001",  # Alice
            }).execute()
        except Exception as e:
            err.append(f"insert_proj_{p['name']}:{e}")

    # Step 4: Memberships (including demo user as ADMIN on all projects)
    user_ids = [user_id] + [u["id"] for u in USERS]
    for p in PROJECTS:
        for i, uid in enumerate(user_ids):
            try:
                db.table("project_members").insert({
                    "id": _uid("member", p["id"], uid),
                    "project_id": p["id"],
                    "user_id": uid,
                    "role": "ADMIN" if uid == user_id else ROLES[i % len(ROLES)],
                }).execute()
            except Exception as e:
                err.append(f"mem_{uid}:{e}")

    # Step 5: Components
    for p in PROJECTS:
        for name in COMPONENTS_PER_PROJECT:
            try:
                db.table("components").insert({
                    "id": _uid("component", p["id"], name),
                    "project_id": p["id"],
                    "name": name,
                }).execute()
            except Exception as e:
                err.append(f"comp_{name}:{e}")

    # Fetch component maps
    components_by_proj = {}
    for p in PROJECTS:
        try:
            c_res = db.table("components").select("id, name").eq("project_id", p["id"]).execute()
            components_by_proj[p["id"]] = c_res.data or []
        except:
            components_by_proj[p["id"]] = []

    # Step 6: Bugs
    all_bugs = []
    n_users = len(user_ids)
    for pi, p in enumerate(PROJECTS):
        comps = components_by_proj.get(p["id"], [])
        # Project 0 gets all bugs, others get first 15
        blist = BUG_TEMPLATES if pi == 0 else BUG_TEMPLATES[:15]
        for i, (title, desc, sev, pri, status, resolution) in enumerate(blist):
            bug_id = _uid("bug", p["id"], title)
            reporter = user_ids[i % n_users]
            # Assingee is demo user or other users
            assignee = user_ids[(i + 1) % n_users] if i % 4 != 0 else None
            comp = comps[i % len(comps)] if comps else None

            hours_ago = 24 + (i * 53) % (90 * 24)
            created_at = (datetime.now(timezone.utc) - timedelta(hours=hours_ago)).isoformat()
            updated_at = (datetime.now(timezone.utc) - timedelta(hours=max(0, hours_ago - 6 - (i % 24)))).isoformat()

            bug = {
                "id": bug_id,
                "project_id": p["id"],
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

            try:
                db.table("bugs").insert(bug).execute()
                all_bugs.append(bug)
            except Exception as e:
                err.append(f"bug_{title[:20]}:{e}")

    # Step 7: Comments
    cc = 0
    for bug in all_bugs[:len(all_bugs) * 2 // 3]:
        bug_hash = int(uuid.uuid5(uuid.NAMESPACE_URL, bug["id"]).hex, 16)
        comment_count = 1 + (bug_hash % 3)
        for j in range(comment_count):
            body = COMMENTS[(bug_hash + j) % len(COMMENTS)]
            comment_id = _uid("comment", bug["id"], body)
            try:
                db.table("comments").insert({
                    "id": comment_id,
                    "bug_id": bug["id"],
                    "author_id": user_ids[(bug_hash + j) % len(user_ids)],
                    "body": body,
                    "created_at": (datetime.now(timezone.utc) - timedelta(hours=6 + j * 5)).isoformat(),
                }).execute()
                cc += 1
            except:
                pass

    # Step 8: Relationships
    rc = 0
    def _link(a, b, rtype):
        nonlocal rc
        try:
            db.table("relationships").insert({
                "id": _uid("rel", a["id"], b["id"], rtype),
                "source_bug_id": a["id"],
                "target_bug_id": b["id"],
                "relationship_type": rtype,
                "created_by": user_ids[0],
            }).execute()
            rc += 1
        except:
            pass

    byp = {}
    for b in all_bugs:
        byp.setdefault(b["project_id"], []).append(b)
    for pid, pb in byp.items():
        for i in range(min(5, len(pb) - 1)):
            _link(pb[i], pb[i + 1], RELATIONSHIP_TYPES[i % len(RELATIONSHIP_TYPES)])

    # Step 9: Activity
    ac = 0
    for pid in byp.keys():
        for b in byp.get(pid, [])[:8]:
            for action in ["BUG_CREATED", "BUG_STATUS_CHANGED"]:
                try:
                    db.table("activity_log").insert({
                        "id": _uid("act", b["id"], action),
                        "project_id": pid,
                        "bug_id": b["id"],
                        "actor_id": user_ids[int(uuid.uuid5(uuid.NAMESPACE_URL, action).hex, 16) % len(user_ids)],
                        "action": action,
                        "entity_type": "BUG",
                        "entity_id": b["id"],
                        "new_value": {"status": b["status"]} if action == "BUG_STATUS_CHANGED" else {"title": b["title"]},
                    }).execute()
                    ac += 1
                except:
                    pass

    # Step 10: Notifications for the demo user
    nc = 0
    if PROJECTS:
        demo_bugs = byp.get(PROJECTS[0]["id"], [])
        for b in demo_bugs[:5]:
            try:
                db.table("notifications").insert({
                    "id": _uid("notif", user_id, b["id"]),
                    "user_id": user_id,
                    "project_id": PROJECTS[0]["id"],
                    "bug_id": b["id"],
                    "title": f"Bug assigned: {b['title'][:50]}",
                    "message": f"You have been assigned to {b['title']}",
                    "read": False,
                }).execute()
                nc += 1
            except:
                pass

    return {
        "projects": len(PROJECTS),
        "bugs": len(all_bugs),
        "comments": cc,
        "relationships": rc,
        "activity": ac,
        "notifications": nc,
        "errors": err[:3]
    }


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

    # Step 4: Seed everything
    result = _seed_all(db, user_id)
    return {"status": "seeded", "user_id": user_id, **result,
            "message": f"Demo ready: {result.get('bugs', 0)} bugs across {result.get('projects', 0)} projects"}


@router.get("/verify")
async def verify_demo():
    """
    Read-only check of whether the demo account is fully seeded.

    Returns the demo user's membership count plus counts of projects,
    reported bugs, assigned bugs, and activity. The frontend calls this
    to confirm the demo actually works before redirecting.
    """
    db = get_service_role_client()
    user_id = _find_demo_user(db, DEMO_EMAIL)

    if not user_id:
        return {
            "status": "missing",
            "ready": False,
            "user_id": None,
            "projects": 0,
            "reported_bugs": 0,
            "assigned_bugs": 0,
            "activity": 0,
            "memberships": 0,
        }

    try:
        memberships = db.table("project_members").select("*").eq("user_id", user_id).execute()
        reported = db.table("bugs").select("id").eq("reporter_id", user_id).execute()
        assigned = db.table("bugs").select("id").eq("assignee_id", user_id).execute()
        activity = db.table("activity_log").select("id").eq("actor_id", user_id).execute()
        projects = db.table("projects").select("id").execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cannot verify demo data: {e}")

    mem_count = len(memberships.data or [])
    rep_count = len(reported.data or [])
    assigned_count = len(assigned.data or [])
    act_count = len(activity.data or [])
    proj_count = len(projects.data or [])

    ready = proj_count > 0 and rep_count > 0 and assigned_count > 0

    return {
        "status": "ready" if ready else "incomplete",
        "ready": ready,
        "user_id": user_id,
        "projects": proj_count,
        "reported_bugs": rep_count,
        "assigned_bugs": assigned_count,
        "activity": act_count,
        "memberships": mem_count,
    }

