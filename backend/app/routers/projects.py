"""
Projects router — CRUD and aggregate stats.
"""

from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user_with_client
from app.models.projects import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectStats,
)
from app.exceptions import NotFoundError, AuthorizationError, ValidationError
from app.helpers import require_project_role, log_activity

router = APIRouter(prefix="/api", tags=["projects"])


@router.post("/projects", response_model=ProjectResponse, status_code=201)
async def create_project(
    project: ProjectCreate,
    auth=Depends(get_current_user_with_client),
):
    import uuid
    user = auth["user"]
    db = auth["db"]

    project_id = str(uuid.uuid4())

    # Insert project
    result = db.table("projects").insert({
        "id": project_id,
        "name": project.name,
        "description": project.description or "",
        "created_by": user["id"],
    }).execute()

    if not result.data:
        raise ValidationError("Failed to create project")

    # Add creator as ADMIN member
    db.table("project_members").insert({
        "project_id": project_id,
        "user_id": user["id"],
        "role": "ADMIN",
    }).execute()

    created = result.data[0]

    log_activity(
        db, project_id=project_id, actor_id=user["id"],
        action="PROJECT_CREATED", entity_type="PROJECT",
        entity_id=project_id, details={"name": project.name},
    )

    return created


@router.get("/projects")
async def list_projects(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]

    memberships = (
        db.table("project_members")
        .select("project_id")
        .eq("user_id", user["id"])
        .execute()
    )
    project_ids = [m["project_id"] for m in memberships.data]

    if not project_ids:
        return {"data": [], "total": 0, "page": page, "per_page": per_page}

    offset = (page - 1) * per_page
    result = (
        db.table("projects")
        .select("*")
        .in_("id", project_ids)
        .order("created_at", desc=True)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    count_result = db.table("projects").select("id", count="exact").in_("id", project_ids).execute()

    return {
        "data": result.data,
        "total": count_result.count or len(result.data or []),
        "page": page,
        "per_page": per_page,
    }

@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"])
    result = db.table("projects").select("*").eq("id", project_id).execute()
    if not result.data:
        raise NotFoundError("Project not found")
    return result.data[0]


@router.put("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project: ProjectUpdate,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"], min_role="ADMIN")
    updates = project.model_dump(exclude_none=True)
    if not updates:
        raise ValidationError("No fields to update")
    result = db.table("projects").update(updates).eq("id", project_id).execute()
    if not result.data:
        raise NotFoundError("Project not found")
    return result.data[0]


@router.delete("/projects/{project_id}", status_code=200)
async def delete_project(
    project_id: str,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"], min_role="ADMIN")
    result = db.table("projects").delete().eq("id", project_id).execute()
    if not result.data:
        raise NotFoundError("Project not found")
    return {"detail": "Project deleted"}


@router.get("/projects/{project_id}/stats", response_model=ProjectStats)
async def get_project_stats(
    project_id: str,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"])

    bugs_result = (
        db.table("bugs")
        .select("status, severity, priority")
        .eq("project_id", project_id)
        .execute()
    )
    bugs = bugs_result.data or []

    open_statuses = {"NEW", "CONFIRMED", "IN_PROGRESS", "REOPENED"}
    bugs_by_status = {}
    bugs_by_severity = {}
    bugs_by_priority = {}
    open_bugs = closed_bugs = resolved_bugs = 0

    for b in bugs:
        st = b["status"]
        bugs_by_status[st] = bugs_by_status.get(st, 0) + 1
        bugs_by_severity[b["severity"]] = bugs_by_severity.get(b["severity"], 0) + 1
        bugs_by_priority[b["priority"]] = bugs_by_priority.get(b["priority"], 0) + 1
        if st in open_statuses:
            open_bugs += 1
        elif st == "CLOSED":
            closed_bugs += 1
        elif st == "RESOLVED":
            resolved_bugs += 1

    members_result = (
        db.table("project_members")
        .select("id")
        .eq("project_id", project_id)
        .execute()
    )

    from datetime import datetime, timedelta, timezone
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    activity_result = (
        db.table("activity_log")
        .select("id")
        .eq("project_id", project_id)
        .gte("created_at", week_ago)
        .execute()
    )

    return ProjectStats(
        total_bugs=len(bugs),
        open_bugs=open_bugs,
        closed_bugs=closed_bugs,
        resolved_bugs=resolved_bugs,
        bugs_by_severity=bugs_by_severity,
        bugs_by_priority=bugs_by_priority,
        bugs_by_status=bugs_by_status,
        recent_activity=len(activity_result.data or []),
        member_count=len(members_result.data or []),
    )
