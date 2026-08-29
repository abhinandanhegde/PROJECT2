"""
Bugs router — CRUD, lifecycle state machine, assignment, global search.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user_with_client
from app.models.bugs import (
    BugCreate, BugUpdate, BugResponse,
    StatusChangeRequest, AssignRequest, VALID_TRANSITIONS,
)
from app.exceptions import NotFoundError, AuthorizationError, ValidationError
from app.helpers import require_project_role, log_activity, ROLE_HIERARCHY

router = APIRouter(prefix="/api", tags=["bugs"])


@router.post("/projects/{project_id}/bugs", response_model=BugResponse, status_code=201)
async def create_bug(
    project_id: str, bug: BugCreate,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    require_project_role(db, project_id, user["id"])

    if bug.assignee_id:
        _validate_assignee(db, project_id, bug.assignee_id)

    insert_data = {
        "project_id": project_id,
        "title": bug.title,
        "description": bug.description or "",
        "status": "NEW",
        "severity": bug.severity.value,
        "priority": bug.priority.value,
        "reporter_id": user["id"],
    }
    if bug.component_id:
        insert_data["component_id"] = bug.component_id
    if bug.assignee_id:
        insert_data["assignee_id"] = bug.assignee_id

    result = db.table("bugs").insert(insert_data).execute()
    if not result.data:
        raise ValidationError("Failed to create bug")

    created = result.data[0]
    log_activity(db, project_id, user["id"], "BUG_CREATED", "BUG", created["id"],
                 {"title": bug.title})

    if bug.assignee_id:
        log_activity(db, project_id, user["id"], "BUG_ASSIGNED", "BUG", created["id"],
                     {"assignee_id": bug.assignee_id})

    return created


@router.get("/projects/{project_id}/bugs")
async def list_bugs(
    project_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    severity: Optional[str] = None,
    priority: Optional[str] = None,
    assignee_id: Optional[str] = None,
    component_id: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"])

    query = db.table("bugs").select("*").eq("project_id", project_id)

    if status:
        query = query.eq("status", status)
    if severity:
        query = query.eq("severity", severity)
    if priority:
        query = query.eq("priority", priority)
    if assignee_id:
        query = query.eq("assignee_id", assignee_id)
    if component_id:
        query = query.eq("component_id", component_id)
    if search:
        query = query.or_(f"title.ilike.%{search}%,description.ilike.%{search}%")

    query = query.order(sort_by, desc=(sort_order == "desc"))
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)
    result = query.execute()

    # Get total count (separate query, no joins)
    count_result = db.table("bugs").select("id").eq("project_id", project_id)
    if status:
        count_result = count_result.eq("status", status)
    if severity:
        count_result = count_result.eq("severity", severity)
    if priority:
        count_result = count_result.eq("priority", priority)
    if assignee_id:
        count_result = count_result.eq("assignee_id", assignee_id)
    if component_id:
        count_result = count_result.eq("component_id", component_id)
    if search:
        count_result = count_result.or_(f"title.ilike.%{search}%,description.ilike.%{search}%")
    count_resp = count_result.execute()

    return {
        "data": result.data or [],
        "total": len(count_resp.data or []),
        "page": page,
        "per_page": per_page,
    }


@router.get("/projects/{project_id}/bugs/{bug_id}", response_model=BugResponse)
async def get_bug(
    project_id: str, bug_id: str,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"])
    result = db.table("bugs").select("*, reporter:reporter_id(display_name), assignee:assignee_id(display_name)").eq("id", bug_id).eq("project_id", project_id).execute()
    if not result.data:
        raise NotFoundError("Bug not found")
    return result.data[0]


@router.put("/projects/{project_id}/bugs/{bug_id}", response_model=BugResponse)
async def update_bug(
    project_id: str, bug_id: str, bug: BugUpdate,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    require_project_role(db, project_id, user["id"])

    existing = db.table("bugs").select("*").eq("id", bug_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise NotFoundError("Bug not found")

    current = existing.data[0]
    updates = bug.model_dump(exclude_none=True)
    if not updates:
        raise ValidationError("No fields to update")

    for key in ("severity", "priority"):
        if key in updates and hasattr(updates[key], "value"):
            updates[key] = updates[key].value

    if "assignee_id" in updates and updates["assignee_id"]:
        _validate_assignee(db, project_id, updates["assignee_id"])

    result = db.table("bugs").update(updates).eq("id", bug_id).eq("project_id", project_id).execute()
    if not result.data:
        raise NotFoundError("Bug not found")

    if "severity" in updates and updates["severity"] != current.get("severity"):
        log_activity(db, project_id, user["id"], "BUG_SEVERITY_CHANGED", "BUG", bug_id,
                     {"old": current.get("severity"), "new": updates["severity"]})
    if "priority" in updates and updates["priority"] != current.get("priority"):
        log_activity(db, project_id, user["id"], "BUG_PRIORITY_CHANGED", "BUG", bug_id,
                     {"old": current.get("priority"), "new": updates["priority"]})
    if "assignee_id" in updates and updates["assignee_id"] != current.get("assignee_id"):
        log_activity(db, project_id, user["id"], "BUG_ASSIGNED", "BUG", bug_id,
                     {"old": current.get("assignee_id"), "new": updates["assignee_id"]})

    other_fields = set(updates.keys()) - {"severity", "priority", "assignee_id"}
    if other_fields:
        log_activity(db, project_id, user["id"], "BUG_UPDATED", "BUG", bug_id,
                     {"fields": list(other_fields)})

    return result.data[0]


@router.patch("/projects/{project_id}/bugs/{bug_id}/status", response_model=BugResponse)
async def change_bug_status(
    project_id: str, bug_id: str, body: StatusChangeRequest,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    role = require_project_role(db, project_id, user["id"])

    existing = db.table("bugs").select("*").eq("id", bug_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise NotFoundError("Bug not found")

    current = existing.data[0]
    current_status = current["status"]
    new_status = body.status.value

    allowed = VALID_TRANSITIONS.get(current_status, [])
    if new_status not in allowed:
        raise ValidationError(
            f"Cannot transition from {current_status} to {new_status}. "
            f"Allowed: {', '.join(allowed) if allowed else 'none'}"
        )

    if current_status == "CLOSED" and new_status == "REOPENED":
        if ROLE_HIERARCHY.index(role) < ROLE_HIERARCHY.index("ADMIN"):
            raise AuthorizationError("Only ADMIN can reopen a closed bug")

    if new_status == "RESOLVED" and not body.resolution:
        raise ValidationError("Resolution is required when setting status to RESOLVED")

    update_data = {"status": new_status}
    if new_status == "RESOLVED":
        update_data["resolution"] = body.resolution.value
    elif new_status == "REOPENED":
        update_data["resolution"] = None

    result = db.table("bugs").update(update_data).eq("id", bug_id).eq("project_id", project_id).execute()
    if not result.data:
        raise NotFoundError("Bug not found")

    action = "BUG_RESOLVED" if new_status == "RESOLVED" else ("BUG_REOPENED" if new_status == "REOPENED" else "BUG_STATUS_CHANGED")
    log_activity(db, project_id, user["id"], action, "BUG", bug_id,
                 {"old_status": current_status, "new_status": new_status,
                  "resolution": body.resolution.value if body.resolution else None})

    return result.data[0]


@router.patch("/projects/{project_id}/bugs/{bug_id}/assign", response_model=BugResponse)
async def assign_bug(
    project_id: str, bug_id: str, body: AssignRequest,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    require_project_role(db, project_id, user["id"], min_role="DEVELOPER")
    _validate_assignee(db, project_id, body.assignee_id)

    existing = db.table("bugs").select("assignee_id").eq("id", bug_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise NotFoundError("Bug not found")

    result = db.table("bugs").update({"assignee_id": body.assignee_id}).eq("id", bug_id).eq("project_id", project_id).execute()
    if not result.data:
        raise NotFoundError("Bug not found")

    log_activity(db, project_id, user["id"], "BUG_ASSIGNED", "BUG", bug_id,
                 {"old": existing.data[0].get("assignee_id"), "new": body.assignee_id})
    return result.data[0]


@router.get("/bugs/search")
async def search_bugs(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    offset = (page - 1) * per_page
    result = (
        db.table("bugs")
        .select("*")
        .or_(f"title.ilike.%{q}%,description.ilike.%{q}%")
        .order("updated_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    return {
        "data": result.data or [],
        "total": len(result.data or []),
        "page": page,
        "per_page": per_page,
    }


def _validate_assignee(db, project_id: str, assignee_id: str) -> None:
    membership = (
        db.table("project_members").select("role")
        .eq("project_id", project_id).eq("user_id", assignee_id).execute()
    )
    if not membership.data:
        raise ValidationError("Assignee is not a member of this project")
