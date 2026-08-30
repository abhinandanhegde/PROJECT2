"""
Shared helper utilities used across routers.

Provides role checking, activity logging, and common query patterns.
"""

from typing import Optional
from app.exceptions import AuthorizationError
from app.supabase_client import get_service_role_client


# Roles ordered from least to most privileged.
ROLE_HIERARCHY = ["REPORTER", "DEVELOPER", "QA", "ADMIN"]


def get_user_project_role(db, project_id: str, user_id: str) -> Optional[str]:
    """
    Look up the user's role in a project.
    Returns the role string (e.g. "ADMIN") or None if not a member.
    """
    result = (
        db.table("project_members")
        .select("role")
        .eq("project_id", project_id)
        .eq("user_id", user_id)
        .execute()
    )
    if result.data:
        return result.data[0]["role"]
    return None


def require_project_role(
    db, project_id: str, user_id: str, min_role: str = "REPORTER"
) -> str:
    """
    Assert that the user is a member of the project with at least *min_role*.
    Returns the actual role string.
    Raises AuthorizationError if the user is not a member or lacks the role.
    """
    role = get_user_project_role(db, project_id, user_id)
    if role is None:
        raise AuthorizationError("You are not a member of this project")
    if ROLE_HIERARCHY.index(role) < ROLE_HIERARCHY.index(min_role):
        raise AuthorizationError(f"Requires {min_role} role or higher")
    return role


def require_project_role_any(
    db, project_id: str, user_id: str, roles: set[str]
) -> str:
    """
    Assert that the user is a member of the project with one of the *roles*.

    Mirrors the explicit role sets enforced by the database RLS policies
    (which don't have an implicit "QA outranks DEVELOPER" ordering), so the
    API never lets a request through the app check that the DB then rejects.
    """
    role = get_user_project_role(db, project_id, user_id)
    if role is None:
        raise AuthorizationError("You are not a member of this project")
    if role not in roles:
        raise AuthorizationError(
            f"Requires one of these roles: {', '.join(sorted(roles))}"
        )
    return role


def bug_number_map(db) -> dict[str, int]:
    """
    Stable display numbers for bugs (#1, #2, ...). Numbering is global,
    derived once from the full bug set ordered by created_at (then id as a
    tiebreak), so a bug keeps the same number on every page — lists, detail,
    search, graph — regardless of filters. No schema column required.
    """
    result = db.table("bugs").select("id, created_at").order("created_at").execute()
    rows = result.data or []
    rows.sort(key=lambda b: (b.get("created_at") or "", b["id"]))
    return {b["id"]: i + 1 for i, b in enumerate(rows)}


def log_activity(
    db,
    project_id: str,
    actor_id: str,
    action: str,
    entity_type: str,
    entity_id: str,
    details: Optional[dict] = None,
    old_value: Optional[dict] = None,
) -> None:
    """
    Insert an entry into the activity_log table.

    Uses the service-role client so audit rows are written even though there
    is no user-context INSERT policy on activity_log.
    """
    try:
        db = get_service_role_client()
        db.table("activity_log").insert({
            "project_id": project_id,
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type.upper(),
            "entity_id": entity_id,
            "bug_id": entity_id if entity_type.upper() == "BUG" else None,
            "new_value": details,
            "old_value": old_value,
        }).execute()
    except Exception as e:
        print(f"Log activity failed: {e}")
