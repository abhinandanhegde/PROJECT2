"""
Components router — CRUD for project components.
"""

from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user_with_client
from app.models.components import ComponentCreate, ComponentUpdate, ComponentResponse
from app.exceptions import NotFoundError, ValidationError
from app.helpers import require_project_role, log_activity

router = APIRouter(prefix="/api", tags=["components"])


@router.post("/projects/{project_id}/components", response_model=ComponentResponse, status_code=201)
async def create_component(
    project_id: str, component: ComponentCreate,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    require_project_role(db, project_id, user["id"], min_role="DEVELOPER")

    result = db.table("components").insert({
        "project_id": project_id,
        "name": component.name,
        "description": component.description or "",
    }).execute()
    if not result.data:
        raise NotFoundError("Failed to create component")

    created = result.data[0]
    log_activity(db, project_id, user["id"], "COMPONENT_CREATED", "COMPONENT", created["id"],
                 {"name": component.name})
    return created


@router.get("/projects/{project_id}/components")
async def list_components(
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
        db.table("components").select("*")
        .eq("project_id", project_id)
        .order("name")
        .range(offset, offset + per_page - 1)
        .execute()
    )
    count_result = db.table("components").select("id", count="exact").eq("project_id", project_id).execute()
    return {
        "data": result.data,
        "total": count_result.count or len(result.data or []),
        "page": page,
        "per_page": per_page,
    }


@router.put("/projects/{project_id}/components/{component_id}", response_model=ComponentResponse)
async def update_component(
    project_id: str, component_id: str, component: ComponentUpdate,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"], min_role="ADMIN")
    updates = component.model_dump(exclude_none=True)
    if not updates:
        raise ValidationError("No fields to update")
    result = db.table("components").update(updates).eq("id", component_id).eq("project_id", project_id).execute()
    if not result.data:
        raise NotFoundError("Component not found")
    return result.data[0]


@router.delete("/projects/{project_id}/components/{component_id}", status_code=200)
async def delete_component(
    project_id: str, component_id: str,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    user = auth["user"]
    require_project_role(db, project_id, user["id"], min_role="ADMIN")
    result = db.table("components").delete().eq("id", component_id).eq("project_id", project_id).execute()
    if not result.data:
        raise NotFoundError("Component not found")
    return {"detail": "Component deleted"}
