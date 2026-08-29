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

from backend.app.seed_data import (
    USERS, PROJECTS, ROLES, COMPONENTS_PER_PROJECT,
    BUG_TEMPLATES, COMMENTS, RELATIONSHIP_TYPES, ACTIVITY_ACTIONS
)

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
    
    # First ensure they exist in auth.users
    if not DRY_RUN:
        try:
            existing_auth = db.auth.admin.list_users()
            existing_emails = {usr.email for usr in existing_auth}
        except Exception as e:
            _log(f"warn: list_users failed, will try creating anyway: {e}")
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
                    _log(f"  Auth user created: {u['email']}")
                except Exception as e:
                    _log(f"  Note: Auth user creation for {u['email']} - {e}")

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