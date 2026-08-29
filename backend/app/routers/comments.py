"""
Comments router — CRUD for bug comments with audit trail.
"""

from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user_with_client
from app.models.comments import CommentCreate, CommentUpdate, CommentResponse
from app.exceptions import NotFoundError, AuthorizationError
from app.helpers import log_activity, require_project_role

router = APIRouter(prefix="/api", tags=["comments"])


def _get_bug_project_id(db, bug_id: str) -> str:
    result = db.table("bugs").select("project_id").eq("id", bug_id).execute()
    if not result.data:
        raise NotFoundError("Bug not found")
    return result.data[0]["project_id"]


@router.post("/bugs/{bug_id}/comments", response_model=CommentResponse, status_code=201)
async def create_comment(
    bug_id: str, comment: CommentCreate,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    project_id = _get_bug_project_id(db, bug_id)

    result = db.table("comments").insert({
        "bug_id": bug_id,
        "author_id": user["id"],
        "body": comment.body,
    }).execute()

    if not result.data:
        raise NotFoundError("Failed to create comment")

    created = result.data[0]
    log_activity(db, project_id, user["id"], "COMMENT_CREATED", "COMMENT", created["id"],
                 {"bug_id": bug_id})
    return created


@router.get("/bugs/{bug_id}/comments")
async def list_comments(
    bug_id: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    offset = (page - 1) * per_page
    result = (
        db.table("comments").select("*, users:author_id(display_name, email)")
        .eq("bug_id", bug_id)
        .order("created_at", desc=False)
        .range(offset, offset + per_page - 1)
        .execute()
    )
    # Get total count without join
    count_result = db.table("comments").select("id", count="exact").eq("bug_id", bug_id).execute()
    return {
        "data": result.data,
        "total": count_result.count or len(result.data or []),
        "page": page,
        "per_page": per_page,
    }


@router.put("/bugs/{bug_id}/comments/{comment_id}", response_model=CommentResponse)
async def update_comment(
    bug_id: str, comment_id: str, comment: CommentUpdate,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]

    existing = db.table("comments").select("*").eq("id", comment_id).eq("bug_id", bug_id).execute()
    if not existing.data:
        raise NotFoundError("Comment not found")
    if existing.data[0]["author_id"] != user["id"]:
        raise AuthorizationError("Only the author can edit this comment")

    result = db.table("comments").update({"body": comment.body}).eq("id", comment_id).execute()
    if not result.data:
        raise NotFoundError("Comment not found")
    return result.data[0]


@router.delete("/bugs/{bug_id}/comments/{comment_id}", status_code=200)
async def delete_comment(
    bug_id: str, comment_id: str,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]

    existing = db.table("comments").select("*").eq("id", comment_id).eq("bug_id", bug_id).execute()
    if not existing.data:
        raise NotFoundError("Comment not found")

    comment_row = existing.data[0]
    project_id = _get_bug_project_id(db, bug_id)

    if comment_row["author_id"] != user["id"]:
        require_project_role(db, project_id, user["id"], min_role="ADMIN")

    db.table("comments").delete().eq("id", comment_id).execute()
    log_activity(db, project_id, user["id"], "COMMENT_DELETED", "COMMENT", comment_id,
                 {"bug_id": bug_id})
    return {"detail": "Comment deleted"}
