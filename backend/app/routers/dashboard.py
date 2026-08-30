"""
Dashboard router — user-level stats, recent activity, assigned bugs.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user_with_client

router = APIRouter(prefix="/api", tags=["dashboard"])

# Number of days included in the dashboard "this week" activity window. This
# is the single definition used by BOTH the "Activity This Week" stat and the
# breakdown, so the two always describe exactly the same records.
ACTIVITY_WINDOW_DAYS = 7

# Map raw activity actions onto human-readable breakdown categories. Actions
# not listed keep their raw name (normalized) so members/comments/relationship
# events still show up rather than being dropped.
ACTIVITY_CATEGORY_LABELS = {
    "BUG_CREATED": "Bug Created",
    "BUG_STATUS_CHANGED": "Status Changed",
    "BUG_RESOLVED": "Status Changed",
    "BUG_REOPENED": "Status Changed",
    "BUG_ASSIGNED": "Assigned",
    "BUG_PRIORITY_CHANGED": "Priority Changed",
    "BUG_SEVERITY_CHANGED": "Severity Changed",
    "BUG_UPDATED": "Bug Updated",
    "COMMENT_CREATED": "Commented",
    "COMMENT_DELETED": "Comment Deleted",
    "RELATIONSHIP_CREATED": "Relationship Added",
    "RELATIONSHIP_REMOVED": "Relationship Removed",
    "MEMBER_ADDED": "Member Added",
    "MEMBER_REMOVED": "Member Removed",
    "MEMBER_ROLE_CHANGED": "Role Changed",
    "COMPONENT_CREATED": "Component Created",
    "COMPONENT_UPDATED": "Component Updated",
    "PROJECT_CREATED": "Project Created",
    "PROJECT_UPDATED": "Project Updated",
    "NOTIFICATION_SENT": "Notification Sent",
}


def _activity_window() -> str:
    """ISO timestamp marking the start of the current activity window."""
    return (datetime.now(timezone.utc) - timedelta(days=ACTIVITY_WINDOW_DAYS)).isoformat()


def _week_activity_rows(db, project_ids):
    """All activity records in the current window for the user's projects.

    Used by dashboard_stats (count) and dashboard_activity_breakdown (groupby)
    so the totals are guaranteed identical — both derive from this one query.
    """
    if not project_ids:
        return []
    result = (
        db.table("activity_log")
        .select("action")
        .in_("project_id", project_ids)
        .gte("created_at", _activity_window())
        .execute()
    )
    return result.data or []


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

    unassigned = 0
    if project_ids:
        unassigned_resp = (
            db.table("bugs")
            .select("id")
            .in_("project_id", project_ids)
            .in_("status", list(open_statuses))
            .is_("assignee_id", "null")
            .execute()
        )
        unassigned = len(unassigned_resp.data or [])

    recent_activity_count = len(_week_activity_rows(db, project_ids))

    return {
        "total_projects": len(project_ids),
        "total_bugs_reported": len(reported.data or []),
        "total_bugs_assigned": len(assigned_bugs),
        "open_assigned": open_assigned,
        "bugs_by_severity": bugs_by_severity,
        "unassigned": unassigned,
        "recent_activity_count": recent_activity_count,
    }


@router.get("/dashboard/activity-breakdown")
async def dashboard_activity_breakdown(auth=Depends(get_current_user_with_client)):
    """Activity events in the current window, grouped by category.

    Uses the exact same query as the "Activity This Week" stat
    (dashboard_stats.recent_activity_count), so the per-category counts always
    sum to that headline number.
    """
    user = auth["user"]
    db = auth["db"]

    memberships = db.table("project_members").select("project_id").eq("user_id", user["id"]).execute()
    project_ids = [m["project_id"] for m in (memberships.data or [])]

    rows = _week_activity_rows(db, project_ids)

    by_category: dict[str, int] = {}
    for r in rows:
        raw = r.get("action") or "OTHER"
        label = ACTIVITY_CATEGORY_LABELS.get(raw, raw.replace("_", " ").title())
        by_category[label] = by_category.get(label, 0) + 1

    breakdown = [
        {"label": label, "count": count}
        for label, count in sorted(by_category.items(), key=lambda kv: kv[1], reverse=True)
    ]

    return {
        "total": len(rows),
        "since": _activity_window(),
        "window_days": ACTIVITY_WINDOW_DAYS,
        "breakdown": breakdown,
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
    result = db.table("activity_log").select("*, actor:actor_id(display_name)").in_("project_id", project_ids).order("created_at", desc=True).limit(limit).execute()
    entries = result.data or []
    for e in entries:
        actor = e.pop("actor", None)
        e["actor_name"] = actor.get("display_name") if isinstance(actor, dict) else actor
    return {"data": entries}


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
    count_query = db.table("bugs").select("id").eq("assignee_id", user["id"])
    if status:
        count_query = count_query.eq("status", status)
    count_resp = count_query.execute()
    total = len(count_resp.data or [])

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


@router.get("/dashboard/intelligence")
async def dashboard_intelligence(auth=Depends(get_current_user_with_client)):
    """Intelligence summary for the dashboard — visible without clicks."""
    user = auth["user"]
    db = auth["db"]

    memberships = db.table("project_members").select("project_id").eq("user_id", user["id"]).execute()
    project_ids = [m["project_id"] for m in (memberships.data or [])]
    if not project_ids:
        return {"triaged_count": 0, "avg_risk_score": 0, "blocking_edges": 0, "critical_bugs": 0}

    # All open bugs across user's projects
    bugs_result = (
        db.table("bugs")
        .select("id, status, severity, priority, assignee_id, created_at, updated_at")
        .in_("project_id", project_ids)
        .in_("status", ["NEW", "CONFIRMED", "IN_PROGRESS", "REOPENED"])
        .execute()
    )
    bugs = bugs_result.data or []

    # Count bugs that have moved past NEW (triaged = someone touched them)
    triaged = sum(1 for b in bugs if b["status"] != "NEW")

    # Quick risk estimate: count high-severity unassigned bugs
    critical_bugs = sum(
        1 for b in bugs
        if b.get("severity") in ("BLOCKER", "CRITICAL") and not b.get("assignee_id")
    )

    # Blocking relationships
    bug_ids = [b["id"] for b in bugs]
    blocking_edges = 0
    if bug_ids:
        rels = (
            db.table("relationships")
            .select("id")
            .eq("relationship_type", "blocks")
            .in_("source_bug_id", bug_ids)
            .execute()
        )
        blocking_edges = len(rels.data or [])

    # Average risk score (simplified: based on severity + assignment)
    from app.routers.intelligence import _RISK_SEVERITY_MAP, _RISK_PRIORITY_MAP
    total_score = 0.0
    for b in bugs:
        sev_score = _RISK_SEVERITY_MAP.get(b.get("severity", "NORMAL"), 0.4) * 25
        pri_score = _RISK_PRIORITY_MAP.get(b.get("priority", "P3"), 0.5) * 15
        assign_score = 5 if not b.get("assignee_id") else 0
        total_score += sev_score + pri_score + assign_score
    avg_risk = round(total_score / len(bugs), 1) if bugs else 0

    return {
        "triaged_count": triaged,
        "total_open": len(bugs),
        "avg_risk_score": avg_risk,
        "blocking_edges": blocking_edges,
        "critical_bugs": critical_bugs,
    }
