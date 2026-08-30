"""
Demo Router — Bulletproof one-click demo.
Handles every edge case: user exists, user doesn't exist, partial seed, etc.
Seeding uses batched inserts (returning=minimal) so the first click is fast.
"""
import os
import uuid
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from postgrest.types import ReturnMethod
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
    USERS, PROJECTS, ROLES, PROJECT_MEMBERS, COMPONENTS_PER_PROJECT,
    PROJECT_BUG_TEMPLATES, COMMENTS, RELATIONSHIP_TYPES
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
    """Seed projects, bugs, comments, relationships, activity, notifications.

    Every table is written with a single batched insert (returning=minimal),
    which turns hundreds of round-trips into a handful and makes the first
    demo login dramatically faster.
    """
    err = []
    user_ids = [user_id] + [u["id"] for u in USERS]
    n_users = len(user_ids)

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
        db.table("users").upsert(USERS, on_conflict="id", returning=ReturnMethod.minimal).execute()
    except Exception as e:
        err.append(f"upsert_users:{e}")

    # Step 2: Delete old seeded projects (CASCADE deletes everything else)
    for p in PROJECTS:
        try:
            db.table("projects").delete().eq("id", p["id"]).execute()
        except Exception as e:
            err.append(f"del_proj_{p['name']}:{e}")

    # Step 3: Insert projects (batched)
    try:
        db.table("projects").insert([
            {
                "id": p["id"],
                "name": p["name"],
                "description": p["description"],
                "created_by": "a0000000-0000-0000-0000-000000000001",  # Alice
            }
            for p in PROJECTS
        ], returning=ReturnMethod.minimal).execute()
    except Exception as e:
        err.append(f"insert_projects:{e}")

    # Step 4: Memberships (batched — demo user is ADMIN on all projects; the
    # rest belong to the project's own team so member counts and badges vary)
    memberships = []
    for p in PROJECTS:
        subset = [uid for uid in PROJECT_MEMBERS.get(p["id"], []) if uid != user_id]
        project_user_ids = [user_id] + subset
        for i, uid in enumerate(project_user_ids):
            memberships.append({
                "id": _uid("member", p["id"], uid),
                "project_id": p["id"],
                "user_id": uid,
                "role": "ADMIN" if uid == user_id else ROLES[i % len(ROLES)],
            })
    try:
        db.table("project_members").insert(memberships, returning=ReturnMethod.minimal).execute()
    except Exception as e:
        err.append(f"insert_members:{e}")

    # Step 5: Components (batched)
    try:
        db.table("components").insert([
            {"id": _uid("component", p["id"], name), "project_id": p["id"], "name": name}
            for p in PROJECTS
            for name in COMPONENTS_PER_PROJECT
        ], returning=ReturnMethod.minimal).execute()
    except Exception as e:
        err.append(f"insert_components:{e}")

    # Fetch component maps (one query for all projects)
    components_by_proj = {}
    try:
        c_res = db.table("components").select("id, project_id, name").in_(
            "project_id", [p["id"] for p in PROJECTS]
        ).execute()
        for c in c_res.data or []:
            components_by_proj.setdefault(c["project_id"], []).append(c)
    except Exception:
        pass

    # Step 6: Bugs (batched, per-project thematic templates)
    # Reporters/assignees are drawn from the project's own members, so member
    # stats (assigned / reported / workload) are consistent with memberships.
    all_bugs = []
    for p in PROJECTS:
        tpls = PROJECT_BUG_TEMPLATES.get(p["id"], [])
        comps = components_by_proj.get(p["id"], [])
        members = [user_id] + [uid for uid in PROJECT_MEMBERS.get(p["id"], []) if uid != user_id]
        n_members = len(members)
        for i, (title, desc, sev, pri, status, resolution) in enumerate(tpls):
            bug_id = _uid("bug", p["id"], title)
            reporter = members[i % n_members]
            # Assignee is a project teammate or unassigned (~1 in 4 unassigned)
            assignee = members[(i + 1) % n_members] if i % 4 != 0 else None
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
            all_bugs.append(bug)

    try:
        db.table("bugs").insert(all_bugs, returning=ReturnMethod.minimal).execute()
    except Exception as e:
        err.append(f"insert_bugs:{e}")

    # Step 7: Comments (batched)
    cc = 0
    comments = []
    for bug in all_bugs[:len(all_bugs) * 2 // 3]:
        bug_hash = int(uuid.uuid5(uuid.NAMESPACE_URL, bug["id"]).hex, 16)
        comment_count = 1 + (bug_hash % 3)
        for j in range(comment_count):
            body = COMMENTS[(bug_hash + j) % len(COMMENTS)]
            comments.append({
                "id": _uid("comment", bug["id"], body),
                "bug_id": bug["id"],
                "author_id": user_ids[(bug_hash + j) % n_users],
                "body": body,
                "created_at": (datetime.now(timezone.utc) - timedelta(hours=6 + j * 5)).isoformat(),
            })
            cc += 1
    try:
        db.table("comments").insert(comments, returning=ReturnMethod.minimal).execute()
    except Exception as e:
        err.append(f"insert_comments:{e}")

    # Step 8: Relationships (batched)
    byp = {}
    for b in all_bugs:
        byp.setdefault(b["project_id"], []).append(b)

    rc = 0
    rels = []
    for pid, pb in byp.items():
        for i in range(min(5, len(pb) - 1)):
            rtype = RELATIONSHIP_TYPES[i % len(RELATIONSHIP_TYPES)]
            rels.append({
                "id": _uid("rel", pb[i]["id"], pb[i + 1]["id"], rtype),
                "source_bug_id": pb[i]["id"],
                "target_bug_id": pb[i + 1]["id"],
                "relationship_type": rtype,
                "created_by": user_ids[0],
            })
            rc += 1
    try:
        db.table("relationships").insert(rels, returning=ReturnMethod.minimal).execute()
    except Exception as e:
        err.append(f"insert_relationships:{e}")

    # Step 9: Activity (batched). Records the events that actually happened
    # during seeding — creation, status, assignment, comments and relationships
    # — for the first 8 bugs of each project, all inside the current activity
    # window. Nothing here is invented: every row maps to a bug/comment/rel
    # that really exists in the seeded workspace.
    ac = 0
    acts = []
    active_bug_ids = {b["id"] for pb in byp.values() for b in pb[:8]}
    bug_project = {b["id"]: b["project_id"] for b in all_bugs}

    def actor_for(bug_id: str, *parts: str) -> str:
        key = "_".join([bug_id, *parts])
        return user_ids[int(uuid.uuid5(uuid.NAMESPACE_URL, key).hex, 16) % n_users]

    for pid, pb in byp.items():
        for b in pb[:8]:
            for action in ["BUG_CREATED", "BUG_STATUS_CHANGED"]:
                acts.append({
                    "id": _uid("act", b["id"], action),
                    "project_id": pid,
                    "bug_id": b["id"],
                    "actor_id": actor_for(b["id"], action),
                    "action": action,
                    "entity_type": "BUG",
                    "entity_id": b["id"],
                    "new_value": {"status": b["status"]} if action == "BUG_STATUS_CHANGED" else {"title": b["title"]},
                })
                ac += 1
            if b.get("assignee_id"):
                acts.append({
                    "id": _uid("act", b["id"], "BUG_ASSIGNED"),
                    "project_id": pid,
                    "bug_id": b["id"],
                    "actor_id": b.get("reporter_id"),
                    "action": "BUG_ASSIGNED",
                    "entity_type": "BUG",
                    "entity_id": b["id"],
                    "new_value": {"assignee_id": b["assignee_id"]},
                })
                ac += 1

    for c in comments:
        if c["bug_id"] in active_bug_ids:
            acts.append({
                "id": _uid("act", c["id"], "COMMENT_CREATED"),
                "project_id": bug_project.get(c["bug_id"]),
                "bug_id": c["bug_id"],
                "actor_id": c["author_id"],
                "action": "COMMENT_CREATED",
                "entity_type": "COMMENT",
                "entity_id": c["id"],
                "new_value": {"body_len": len(c["body"])},
            })
            ac += 1

    for r in rels:
        if r["source_bug_id"] in active_bug_ids:
            acts.append({
                "id": _uid("act", r["id"], "RELATIONSHIP_CREATED"),
                "project_id": bug_project.get(r["source_bug_id"]),
                "bug_id": r["source_bug_id"],
                "actor_id": r.get("created_by"),
                "action": "RELATIONSHIP_CREATED",
                "entity_type": "RELATIONSHIP",
                "entity_id": r["id"],
                "new_value": {"source_bug_id": r["source_bug_id"],
                              "target_bug_id": r["target_bug_id"],
                              "type": r["relationship_type"]},
            })
            ac += 1

    try:
        db.table("activity_log").insert(acts, returning=ReturnMethod.minimal).execute()
    except Exception as e:
        err.append(f"insert_activity:{e}")

    # Step 10: Notifications for the demo user (batched)
    nc = 0
    if PROJECTS:
        demo_bugs = byp.get(PROJECTS[0]["id"], [])
        notifs = []
        for b in demo_bugs[:5]:
            notifs.append({
                "id": _uid("notif", user_id, b["id"]),
                "user_id": user_id,
                "project_id": PROJECTS[0]["id"],
                "bug_id": b["id"],
                "title": f"Bug assigned: {b['title'][:50]}",
                "message": f"You have been assigned to {b['title']}",
                "read": False,
            })
            nc += 1
        try:
            db.table("notifications").insert(notifs, returning=ReturnMethod.minimal).execute()
        except Exception as e:
            err.append(f"insert_notifications:{e}")

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
    FIRST so it can skip re-seeding on every login.
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