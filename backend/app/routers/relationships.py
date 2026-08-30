"""
Bug relationships router — create, list, remove.
Table is 'relationships' with columns: source_bug_id, target_bug_id.
"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user_with_client
from app.models.relationships import RelationshipCreate, RelationshipResponse
from app.exceptions import NotFoundError, ConflictError, ValidationError
from app.helpers import log_activity

router = APIRouter(prefix="/api", tags=["relationships"])

# Cap how many bugs the graph will draw. Keeps the force simulation smooth
# while still covering every bug in the seeded demo (4 projects).
GRAPH_BUG_LIMIT = 150


@router.get("/graph")
async def bug_graph(auth=Depends(get_current_user_with_client)):
    """Return bugs + relationships in ONE round trip for the graph page.

    Previously the frontend issued one request per project plus one per bug
    (N+1). This endpoint collapses all of that into a single call that reads
    every relationship touching the visible bugs in two bulk queries.
    """
    user = auth["user"]
    db = auth["db"]

    memberships = db.table("project_members").select("project_id").eq("user_id", user["id"]).execute()
    project_ids = [m["project_id"] for m in (memberships.data or [])]
    if not project_ids:
        return {"data": {"nodes": [], "edges": []}}

    member_projects = db.table("projects").select("id, name").in_("id", project_ids).execute()
    project_names = {p["id"]: p["name"] for p in (member_projects.data or [])}

    bug_res = (
        db.table("bugs")
        .select("id, title, status, severity, project_id")
        .in_("project_id", project_ids)
        .order("created_at", desc=True)
        .limit(GRAPH_BUG_LIMIT)
        .execute()
    )
    bugs = bug_res.data or []
    bug_ids = [b["id"] for b in bugs]
    if not bug_ids:
        return {"data": {"nodes": [], "edges": []}}

    outgoing = (
        db.table("relationships")
        .select("source_bug_id, target_bug_id, relationship_type")
        .in_("source_bug_id", bug_ids)
        .execute()
    )
    incoming = (
        db.table("relationships")
        .select("source_bug_id, target_bug_id, relationship_type")
        .in_("target_bug_id", bug_ids)
        .execute()
    )

    edges = []
    seen = set()
    for r in (outgoing.data or []) + (incoming.data or []):
        key = (r["source_bug_id"], r["target_bug_id"], r["relationship_type"])
        if key in seen:
            continue
        seen.add(key)
        edges.append({
            "source_bug_id": r["source_bug_id"],
            "target_bug_id": r["target_bug_id"],
            "relationship_type": r["relationship_type"],
        })

    nodes = [
        {
            "id": b["id"],
            "title": b["title"],
            "status": b["status"],
            "severity": b["severity"],
            "project_id": b["project_id"],
            "project_name": project_names.get(b["project_id"], "Unknown project"),
        }
        for b in bugs
    ]
    return {
        "data": {
            "nodes": nodes,
            "edges": edges,
            "projects": [{"id": pid, "name": name} for pid, name in project_names.items()],
        }
    }


def _get_bug_project_id(db, bug_id: str) -> str:
    result = db.table("bugs").select("project_id").eq("id", bug_id).execute()
    if not result.data:
        raise NotFoundError("Bug not found")
    return result.data[0]["project_id"]


@router.post("/bugs/{bug_id}/relationships", response_model=RelationshipResponse, status_code=201)
async def create_relationship(
    bug_id: str, rel: RelationshipCreate,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]

    if bug_id == rel.target_bug_id:
        raise ValidationError("A bug cannot be related to itself")

    project_id = _get_bug_project_id(db, bug_id)

    related = db.table("bugs").select("project_id").eq("id", rel.target_bug_id).execute()
    if not related.data:
        raise NotFoundError("Related bug not found")
    if related.data[0]["project_id"] != project_id:
        raise ValidationError("Related bug must belong to the same project")

    existing = (
        db.table("relationships").select("id")
        .eq("source_bug_id", bug_id)
        .eq("target_bug_id", rel.target_bug_id)
        .eq("relationship_type", rel.relationship_type.value)
        .execute()
    )
    if existing.data:
        raise ConflictError("This relationship already exists")

    result = db.table("relationships").insert({
        "source_bug_id": bug_id,
        "target_bug_id": rel.target_bug_id,
        "relationship_type": rel.relationship_type.value,
        "created_by": user["id"],
    }).execute()
    if not result.data:
        raise ValidationError("Failed to create relationship")

    created = result.data[0]
    log_activity(db, project_id, user["id"], "RELATIONSHIP_CREATED", "RELATIONSHIP", created["id"],
                 {"source_bug_id": bug_id, "target_bug_id": rel.target_bug_id,
                  "type": rel.relationship_type.value})
    return created


@router.get("/bugs/{bug_id}/relationships")
async def list_relationships(
    bug_id: str,
    auth=Depends(get_current_user_with_client),
):
    db = auth["db"]
    outgoing = db.table("relationships").select("*").eq("source_bug_id", bug_id).execute()
    incoming = db.table("relationships").select("*").eq("target_bug_id", bug_id).execute()
    # Merge into a flat list for the frontend (graph page expects res.data)
    all_rels = (outgoing.data or []) + (incoming.data or [])
    seen = set()
    unique = []
    for r in all_rels:
        key = (r["source_bug_id"], r["target_bug_id"], r["relationship_type"])
        if key not in seen:
            seen.add(key)
            unique.append(r)
    return {"data": unique, "outgoing": outgoing.data or [], "incoming": incoming.data or []}


@router.delete("/bugs/{bug_id}/relationships/{relationship_id}", status_code=200)
async def remove_relationship(
    bug_id: str, relationship_id: str,
    auth=Depends(get_current_user_with_client),
):
    user = auth["user"]
    db = auth["db"]
    project_id = _get_bug_project_id(db, bug_id)
    result = db.table("relationships").delete().eq("id", relationship_id).execute()
    if not result.data:
        raise NotFoundError("Relationship not found")
    log_activity(db, project_id, user["id"], "RELATIONSHIP_REMOVED", "RELATIONSHIP", relationship_id,
                 {"bug_id": bug_id})
    return {"detail": "Relationship removed"}
