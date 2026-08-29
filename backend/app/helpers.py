"""
Shared helper utilities used across routers.

Provides role checking, activity logging, and common query patterns.
"""

from typing import Optional
from app.exceptions import AuthorizationError


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
    """
    try:
        db.table("activity_log").insert({
            "project_id": project_id,
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "bug_id": entity_id if entity_type == "BUG" else None,
            "new_value": details,
            "old_value": old_value,
        }).execute()
    except Exception as e:
        print(f"Log activity failed: {e}")
