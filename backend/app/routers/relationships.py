"""
Bug relationships router — create, list, remove.
Table is 'relationships' with columns: source_bug_id, target_bug_id.
"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user_with_client
from app.models.relationships import RelationshipCreate, RelationshipResponse
from app.exceptions import NotFoundError, ConflictError, ValidationError
from app.helpers import log_activity, bug_number_map

router = APIRouter(prefix="/api", tags=["relationships"])

# Cap how many bugs the graph will draw. Keeps the force simulation smooth
# while still covering every bug in the seeded demo (4 projects).
GRAPH_BUG_LIMIT = 150


def compute_blocking_impact(
    node_ids: list[str],
    edges: list[dict],
) -> tuple[dict[str, int], dict[str, int], list[str]]:
    """Derive blocking impact from the semantic blocking relationships.

    Returns (blocks_count, blocked_by_count, critical_path) where:
      - blocks_count[b]    = distinct bugs reachable downstream of b (fixing b
                             unblocks these).
      - blocked_by_count[b]= distinct bugs upstream that reach b.
      - critical_path      = longest directed 'blocks' chain (ids, length >= 2),
                             tie-broken by the root that unblocks the most bugs.

    A 'blocks' edge follows source -> target. A 'depends_on' edge is its
    inverse (source depends on target, so target blocks source). `related_to`
    has no resolution impact. Edges are only followed between *visible* ids.
    Reach counts are cycle-safe. A critical path is only reported for an
    acyclic blocks graph, because a dependency cycle has no valid resolution
    order.
    """
    if not node_ids:
        return {}, {}, []

    visible = set(node_ids)
    adj: dict[str, set[str]] = {}
    rev: dict[str, set[str]] = {}
    for e in edges:
        relationship_type = e.get("relationship_type")
        if relationship_type == "blocks":
            s, t = e.get("source_bug_id"), e.get("target_bug_id")
        elif relationship_type == "depends_on":
            s, t = e.get("target_bug_id"), e.get("source_bug_id")
        else:
            continue
        if s in visible and t in visible and s != t:
            adj.setdefault(s, set()).add(t)
            rev.setdefault(t, set()).add(s)

    def _reach(graph: dict[str, set[str]]) -> dict[str, int]:
        counts = {}
        for start in sorted(node_ids):
            reached: set[str] = set()
            todo = list(graph.get(start, ()))
            while todo:
                current = todo.pop()
                if current == start or current in reached:
                    continue
                reached.add(current)
                todo.extend(graph.get(current, ()))
            counts[start] = len(reached)
        return counts

    blocks_count = _reach(adj)
    blocked_by_count = _reach(rev)

    indegree = {u: 0 for u in node_ids}
    for targets in adj.values():
        for target in targets:
            indegree[target] += 1
    ready = sorted(u for u, degree in indegree.items() if degree == 0)
    topo: list[str] = []
    while ready:
        u = ready.pop(0)
        topo.append(u)
        for v in sorted(adj.get(u, ())):
            indegree[v] -= 1
            if indegree[v] == 0:
                ready.append(v)
                ready.sort()

    # A cycle is a deadlock, not a resolution path; surface no misleading path.
    if len(topo) != len(node_ids):
        return blocks_count, blocked_by_count, []

    paths = {u: [u] for u in node_ids}
    for u in reversed(topo):
        choices = [[u] + paths[v] for v in sorted(adj.get(u, ()))]
        if choices:
            # `choices` is sorted, so equal-length paths retain a stable first
            # branch instead of depending on set iteration order.
            paths[u] = max(choices, key=len)

    critical = max(
        paths.values(),
        key=lambda path: (len(path), blocks_count.get(path[0], 0), tuple(path)),
    )
    if len(critical) < 2:
        critical = []

    return blocks_count, blocked_by_count, critical


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

    numbers = bug_number_map(db)
    title_map = {b["id"]: b["title"] for b in bugs}
    status_map = {b["id"]: b["status"] for b in bugs}
    blocks_count, blocked_by_count, critical_ids = compute_blocking_impact(bug_ids, edges)
    critical_path = [
        {
            "id": bid,
            "number": numbers.get(bid),
            "title": title_map.get(bid, ""),
            "status": status_map.get(bid, ""),
        }
        for bid in critical_ids
    ]
    nodes = [
        {
            "id": b["id"],
            "number": numbers.get(b["id"]),
            "title": b["title"],
            "status": b["status"],
            "severity": b["severity"],
            "project_id": b["project_id"],
            "project_name": project_names.get(b["project_id"], "Unknown project"),
            "blocks_count": blocks_count.get(b["id"], 0),
            "blocked_by_count": blocked_by_count.get(b["id"], 0),
        }
        for b in bugs
    ]
    return {
        "data": {
            "nodes": nodes,
            "edges": edges,
            "critical_path": critical_path,
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
