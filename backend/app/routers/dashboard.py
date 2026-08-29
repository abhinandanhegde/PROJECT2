"""
Dashboard router — user-level stats, recent activity, assigned bugs.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user_with_client

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard/stats")
async def dashboard_stats(auth=Depends(get_current_user_with_client)):
    user = auth["user"]
    db = auth["db"]
    user_id = user["id"]

    memberships = db.table("project_members").select("project_id").eq("user_id", user_id).execute()
    project_ids = [m["project_id"] for m in (memberships.data or [])]

    reported = db.table("bugs").select("id").eq("reporter_id", user_id).execute()
    assigned = db.table("bugs").select("status, severity").eq("assignee_id", user_id).execute()
    assigned_bugs = assigned.data or []

    open_statuses = {"NEW", "CONFIRMED", "IN_PROGRESS", "REOPENED"}
    open_assigned = sum(1 for b in assigned_bugs if b["status"] in open_statuses)
    bugs_by_severity = {}
    for b in assigned_bugs:
        sev = b["severity"]
        bugs_by_severity[sev] = bugs_by_severity.get(sev, 0) + 1

    recent_activity_count = 0
    if project_ids:
        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        activity = db.table("activity_log").select("id").in_("project_id", project_ids).gte("created_at", week_ago).execute()
        recent_activity_count = len(activity.data or [])

    return {
        "total_projects": len(project_ids),
        "total_bugs_reported": len(reported.data or []),
        "total_bugs_assigned": len(assigned_bugs),
        "open_assigned": open_assigned,
        "bugs_by_severity": bugs_by_severity,
        "recent_activity_count": recent_activity_count,
    }


@router.get("/dashboard/recent")
async def dashboard_recent(
    limit: int = Query(20, ge=1, le=100),
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    memberships = db.table("project_members").select("project_id").eq("user_id", user["id"]).execute()
    project_ids = [m["project_id"] for m in (memberships.data or [])]
    if not project_ids:
        return {"data": []}
    result = db.table("activity_log").select("*").in_("project_id", project_ids).order("created_at", desc=True).limit(limit).execute()
    return {"data": result.data or []}


@router.get("/dashboard/assigned")
async def dashboard_assigned(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    offset = (page - 1) * per_page
    count_query = db.table("bugs").select("id", count="exact").eq("assignee_id", user["id"])
    if status:
        count_query = count_query.eq("status", status)
    count_result = count_query.execute()
    total = count_result.count or 0

    query = db.table("bugs").select("*").eq("assignee_id", user["id"])
    if status:
        query = query.eq("status", status)
    result = query.order("updated_at", desc=True).range(offset, offset + per_page - 1).execute()
    return {
        "data": result.data or [],
        "total": total,
        "page": page,
        "per_page": per_page,
    }
