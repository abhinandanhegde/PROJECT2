"""
Members router — manage project membership.
"""

from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user_with_client
from app.models.members import MemberAdd, MemberUpdate, MemberResponse
from app.exceptions import NotFoundError, ConflictError, ValidationError
from app.helpers import require_project_role, log_activity

router = APIRouter(prefix="/api", tags=["members"])


@router.post("/projects/{project_id}/members", response_model=MemberResponse, status_code=201)
async def add_member(
    project_id: str, member: MemberAdd,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    require_project_role(db, project_id, user["id"], min_role="ADMIN")

    existing = db.table("project_members").select("id").eq("project_id", project_id).eq("user_id", member.user_id).execute()
    if existing.data:
        raise ConflictError("User is already a member of this project")

    target_user = db.table("users").select("id").eq("id", member.user_id).execute()
    if not target_user.data:
        raise NotFoundError("User not found")

    result = db.table("project_members").insert({
        "project_id": project_id,
        "user_id": member.user_id,
        "role": member.role.value,
    }).execute()
    if not result.data:
        raise ValidationError("Failed to add member")

    created = result.data[0]
    log_activity(db, project_id, user["id"], "MEMBER_ADDED", "MEMBER", created["id"],
                 {"user_id": member.user_id, "role": member.role.value})
    return created


@router.get("/projects/{project_id}/members")
async def list_members(
    project_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"])
    offset = (page - 1) * per_page
    result = (
        db.table("project_members")
        .select("*, users(id, email, display_name)", count="exact")
        .eq("project_id", project_id)
        .order("created_at", desc=False)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    return {
        "data": result.data,
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.put("/projects/{project_id}/members/{member_id}", response_model=MemberResponse)
async def update_member_role(
    project_id: str, member_id: str, member: MemberUpdate,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"], min_role="ADMIN")
    result = db.table("project_members").update({"role": member.role.value}).eq("id", member_id).eq("project_id", project_id).execute()
    if not result.data:
        raise NotFoundError("Member not found")
    return result.data[0]


@router.delete("/projects/{project_id}/members/{member_id}", status_code=200)
async def remove_member(
    project_id: str, member_id: str,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"], min_role="ADMIN")

    existing = db.table("project_members").select("*").eq("id", member_id).eq("project_id", project_id).execute()
    if not existing.data:
        raise NotFoundError("Member not found")

    member_row = existing.data[0]
    if member_row["role"] == "ADMIN":
        admins = db.table("project_members").select("id", count="exact").eq("project_id", project_id).eq("role", "ADMIN").execute()
        if (admins.count or 0) <= 1:
            raise ConflictError("Cannot remove the last admin from a project")

    db.table("project_members").delete().eq("id", member_id).execute()
    log_activity(db, project_id, user["id"], "MEMBER_REMOVED", "MEMBER", member_id,
                 {"user_id": member_row["user_id"], "role": member_row["role"]})
    return {"detail": "Member removed"}
