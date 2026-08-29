"""
Intelligence Router — Deterministic Bug Analysis Engine

Provides three core intelligence capabilities:
  1. Triage   — Rule-based severity/priority suggestion
  2. Duplicate Detection — pg_trgm trigram similarity matching
  3. Risk Analysis — Multi-factor weighted risk scoring

Architecture:
  - Zero AI / LLM / external API dependency
  - Pure Python heuristic logic + PostgreSQL pg_trgm
  - Every endpoint enforces project-level authorization via existing RLS
  - Uses the same auth pattern as all other Dev 2 routers
"""

import re
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends

from app.dependencies import get_current_user_with_client
from app.exceptions import NotFoundError, ValidationError
from app.helpers import require_project_role
from app.models.intelligence import (
    DuplicateCandidate,
    DuplicateRequest,
    DuplicateResult,
    RiskFactor,
    RiskRequest,
    RiskResult,
    TriageRequest,
    TriageResult,
)

router = APIRouter(prefix="/api/intelligence", tags=["intelligence"])


# ═══════════════════════════════════════════════════════════════
#  § 1 — Keyword Lexicons (deterministic triage)
# ═══════════════════════════════════════════════════════════════

_SEVERITY_KEYWORDS: dict[str, list[str]] = {
    "BLOCKER": [
        "crash", "data loss", "corruption", "security vulnerability",
        "production down", "outage", "blocking", "cannot use",
        "complete failure", "system down", "service unavailable",
    ],
    "CRITICAL": [
        "critical", "urgent", "breaking", "severe", "major impact",
        "high priority", "workaround impossible", "no workaround",
        "affects all users", "widespread",
    ],
    "MAJOR": [
        "major", "significant", "regression", "degraded",
        "missing feature", "incorrect", "fails", "error",
        "broken", "exception",
    ],
    "NORMAL": [
        "should", "needs", "improvement", "enhancement",
        "update", "change", "would like",
    ],
    "MINOR": [
        "minor", "small", "cosmetic", "low impact",
        "edge case", "rare", "suggestion", "nice to have",
    ],
    "TRIVIAL": [
        "trivial", "nit", "nitpick", "whitespace",
        "formatting", "style", "typo",
    ],
}

_PRIORITY_KEYWORDS: dict[str, list[str]] = {
    "P1": [
        "blocker", "critical", "urgent", "production", "down",
        "security", "vulnerability", "data loss", "immediate",
    ],
    "P2": [
        "important", "high", "significant", "regression",
        "breaking", "affects many", "workaround difficult",
    ],
    "P3": [
        "normal", "standard", "regular", "improvement",
        "enhancement", "feature", "typical",
    ],
    "P4": [
        "minor", "low", "cosmetic", "nice to have",
        "suggestion", "minor improvement",
    ],
    "P5": [
        "trivial", "nit", "nitpick", "whitespace",
        "formatting", "cosmetic",
    ],
}

_SEVERITY_ORDER = ["TRIVIAL", "MINOR", "NORMAL", "MAJOR", "CRITICAL", "BLOCKER"]
_PRIORITY_ORDER = ["P5", "P4", "P3", "P2", "P1"]

_RISK_SEVERITY_MAP: dict[str, float] = {
    "BLOCKER": 1.0, "CRITICAL": 0.85, "MAJOR": 0.65,
    "NORMAL": 0.40, "MINOR": 0.20, "TRIVIAL": 0.05,
}

_RISK_PRIORITY_MAP: dict[str, float] = {
    "P1": 1.0, "P2": 0.80, "P3": 0.50, "P4": 0.25, "P5": 0.05,
}

_RISK_FACTOR_WEIGHTS = {
    "severity":           25,
    "priority":           15,
    "age_days":           15,
    "status_blockage":    15,
    "reopen_count":       15,
    "activity_staleness": 10,
    "no_assignee":         5,
}

_BLOCKING_STATUSES = frozenset({"NEW", "CONFIRMED", "REOPENED"})
_HIGH_RISK_STATUSES = frozenset({"REOPENED", "CONFIRMED"})


# ═══════════════════════════════════════════════════════════════
#  § 2 — Internal Helpers
# ═══════════════════════════════════════════════════════════════

def _count_keyword_matches(text: str, lexicon: dict[str, list[str]]) -> dict[str, int]:
    """Return {category: match_count} for every category with ≥1 hit."""
    lower = text.lower()
    return {
        cat: sum(1 for kw in kws if kw in lower)
        for cat, kws in lexicon.items()
        if any(kw in lower for kw in kws)
    }


def _best_category(matches: dict[str, int], ranked: list[str]) -> Optional[str]:
    """Walk *ranked* from highest to lowest; return first category with a match."""
    for cat in reversed(ranked):
        if cat in matches:
            return cat
    return None


def _parse_ts(raw: str) -> Optional[datetime]:
    """Best-effort ISO-timestamp parse."""
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return None


def _jaccard_similarity(a: str, b: str) -> float:
    """Jaccard index over whitespace-tokenized word sets."""
    if not a or not b:
        return 0.0
    tok_a, tok_b = set(re.findall(r"\w+", a.lower())), set(re.findall(r"\w+", b.lower()))
    if not tok_a or not tok_b:
        return 0.0
    return len(tok_a & tok_b) / len(tok_a | tok_b)


# ═══════════════════════════════════════════════════════════════
#  § 3 — POST /api/intelligence/projects/{id}/bugs/triage
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/projects/{project_id}/bugs/triage",
    response_model=TriageResult,
    summary="Deterministic bug triage",
    description=(
        "Analyzes title, description, and provided metadata to suggest "
        "severity and priority using a keyword-based heuristic engine. "
        "Returns a confidence score and human-readable reasoning chain."
    ),
)
async def triage_bug(
    project_id: str,
    body: TriageRequest,
    auth=Depends(get_current_user_with_client),
):
    db, user = auth["db"], auth["user"]
    require_project_role(db, project_id, user["id"])

    text = f"{body.title} {body.description or ''}"
    desc_len = len(body.description or "")

    reasons: list[str] = []
    signals: list[str] = []
    confidence_delta: list[float] = []

    # ── Severity ──────────────────────────────────────────
    sev_matches = _count_keyword_matches(text, _SEVERITY_KEYWORDS)
    suggested_severity = _best_category(sev_matches, _SEVERITY_ORDER)

    if suggested_severity:
        reasons.append(f"Keyword analysis suggests {suggested_severity}")
        confidence_delta.append(0.30)

    if body.severity:
        signals.append(f"Reporter-provided severity: {body.severity}")
        if suggested_severity:
            reporter_idx = _SEVERITY_ORDER.index(body.severity)
            engine_idx = _SEVERITY_ORDER.index(suggested_severity)
            if reporter_idx >= engine_idx:
                # Reporter sees it as worse (or equal) → trust the reporter
                suggested_severity = body.severity
                confidence_delta.append(0.20)
                reasons.append(
                    f"Reporter severity ({body.severity}) ≥ engine suggestion — using reporter value"
                )
            else:
                # Reporter sees it as less severe → keep engine suggestion, note the discrepancy
                confidence_delta.append(0.10)
                reasons.append(
                    f"Reporter severity ({body.severity}) is lower than engine suggestion ({suggested_severity})"
                )
        else:
            suggested_severity = body.severity
            reasons.append(f"No keyword signals — using reporter severity: {body.severity}")
    elif not suggested_severity:
        # Length-based fallback heuristic
        if desc_len > 500:
            suggested_severity = "MAJOR"
            reasons.append("Long description suggests significant issue")
            confidence_delta.append(0.10)
        elif desc_len > 200:
            suggested_severity = "NORMAL"
            reasons.append("Moderate description — defaulting to NORMAL")
        else:
            suggested_severity = "NORMAL"
            reasons.append("Insufficient signals — defaulting to NORMAL")

    # ── Priority ──────────────────────────────────────────
    pri_matches = _count_keyword_matches(text, _PRIORITY_KEYWORDS)
    suggested_priority = _best_category(pri_matches, _PRIORITY_ORDER)

    if suggested_priority:
        reasons.append(f"Keyword analysis suggests {suggested_priority}")
        confidence_delta.append(0.30)

    if body.priority:
        signals.append(f"Reporter-provided priority: {body.priority}")
        if suggested_priority:
            reporter_idx = _PRIORITY_ORDER.index(body.priority)
            engine_idx = _PRIORITY_ORDER.index(suggested_priority)
            if reporter_idx <= engine_idx:
                # Lower index = higher priority → trust the reporter
                suggested_priority = body.priority
                confidence_delta.append(0.20)
                reasons.append(
                    f"Reporter priority ({body.priority}) ≥ engine suggestion — using reporter value"
                )
            else:
                confidence_delta.append(0.10)
                reasons.append(
                    f"Reporter priority ({body.priority}) is lower than engine suggestion ({suggested_priority})"
                )
        else:
            suggested_priority = body.priority
            reasons.append(f"No keyword signals — using reporter priority: {body.priority}")
    elif not suggested_priority:
        suggested_priority = "P3"
        reasons.append("No strong priority signals — defaulting to P3")

    # ── Metadata signals ──────────────────────────────────
    if body.component:
        signals.append(f"Component: {body.component}")
    if body.status:
        signals.append(f"Current status: {body.status}")

    if desc_len == 0:
        signals.append("No description provided")
        reasons.append("Missing description may indicate incomplete report")
        confidence_delta.append(-0.10)
    elif desc_len > 100:
        signals.append("Detailed description provided")
        confidence_delta.append(0.10)

    if len(body.title) < 20:
        signals.append("Short title — may need more detail")
        confidence_delta.append(-0.05)

    confidence = min(1.0, max(0.0, 0.40 + sum(confidence_delta)))

    return TriageResult(
        suggested_severity=suggested_severity,
        suggested_priority=suggested_priority,
        confidence=round(confidence, 2),
        reasons=reasons,
        signals=signals,
    )


# ═══════════════════════════════════════════════════════════════
#  § 4 — POST /api/intelligence/projects/{id}/bugs/duplicates
# ═══════════════════════════════════════════════════════════════

_PGTRGM_RPC = "find_similar_bugs"


@router.post(
    "/projects/{project_id}/bugs/duplicates",
    response_model=DuplicateResult,
    summary="Detect potential duplicate bugs",
    description=(
        "Uses PostgreSQL pg_trgm trigram similarity on title and description "
        "to find bugs that may be duplicates. Falls back to Jaccard token "
        "similarity when pg_trgm RPC is unavailable."
    ),
)
async def detect_duplicates(
    project_id: str,
    body: DuplicateRequest,
    auth=Depends(get_current_user_with_client),
):
    db, user = auth["db"], auth["user"]
    require_project_role(db, project_id, user["id"])

    now = datetime.now(timezone.utc).isoformat()
    candidates: list[DuplicateCandidate] = []

    # ── Strategy A: pg_trgm RPC (preferred) ───────────────
    try:
        rpc = db.rpc(
            _PGTRGM_RPC,
            {
                "p_project_id": project_id,
                "p_title": body.title,
                "p_description": body.description or "",
                "p_threshold": body.threshold,
                "p_limit": body.limit,
            },
        ).execute()

        if rpc.data:
            for row in rpc.data:
                candidates.append(
                    DuplicateCandidate(
                        bug_id=row["bug_id"],
                        title=row["title"],
                        status=row["status"],
                        severity=row.get("severity"),
                        priority=row.get("priority"),
                        similarity=round(float(row["similarity"]), 4),
                        match_type=row.get("match_type", "title_trgm"),
                    )
                )
            return DuplicateResult(
                candidates=candidates,
                query_title=body.title,
                checked_at=now,
            )
    except Exception:
        pass  # RPC not deployed — fall through to fallback

    # ── Strategy B: Jaccard fallback (no pg_trgm) ─────────
    seen_ids: set[str] = set()

    # B1 — title search
    title_hits = (
        db.table("bugs")
        .select("id, title, status, severity, priority")
        .eq("project_id", project_id)
        .ilike("title", f"%{body.title}%")
        .limit(body.limit * 2)  # over-fetch for ranking
        .execute()
    )
    for row in (title_hits.data or []):
        sim = _jaccard_similarity(body.title, row["title"])
        if sim >= body.threshold and row["id"] not in seen_ids:
            candidates.append(
                DuplicateCandidate(
                    bug_id=row["id"],
                    title=row["title"],
                    status=row["status"],
                    severity=row.get("severity"),
                    priority=row.get("priority"),
                    similarity=round(sim, 4),
                    match_type="title_jaccard",
                )
            )
            seen_ids.add(row["id"])

    # B2 — description search (if provided)
    if body.description:
        snippet = body.description[:120]
        desc_hits = (
            db.table("bugs")
            .select("id, title, status, severity, priority")
            .eq("project_id", project_id)
            .ilike("description", f"%{snippet}%")
            .limit(body.limit * 2)
            .execute()
        )
        for row in (desc_hits.data or []):
            if row["id"] not in seen_ids:
                sim = _jaccard_similarity(body.description, row.get("title", ""))
                if sim >= body.threshold:
                    candidates.append(
                        DuplicateCandidate(
                            bug_id=row["id"],
                            title=row["title"],
                            status=row["status"],
                            severity=row.get("severity"),
                            priority=row.get("priority"),
                            similarity=round(sim, 4),
                            match_type="description_jaccard",
                        )
                    )
                    seen_ids.add(row["id"])

    candidates.sort(key=lambda c: c.similarity, reverse=True)
    candidates = candidates[: body.limit]

    return DuplicateResult(
        candidates=candidates,
        query_title=body.title,
        checked_at=now,
    )


# ═══════════════════════════════════════════════════════════════
#  § 5 — POST /api/intelligence/projects/{id}/bugs/risk
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/projects/{project_id}/bugs/risk",
    response_model=RiskResult,
    summary="Deterministic risk analysis",
    description=(
        "Computes a weighted risk score (0-100) from seven orthogonal signals: "
        "severity, priority, age, status blockage, reopen count, activity "
        "staleness, and assignment status. Returns a risk level and factor breakdown."
    ),
)
async def analyze_risk(
    project_id: str,
    body: RiskRequest,
    auth=Depends(get_current_user_with_client),
):
    db, user = auth["db"], auth["user"]
    require_project_role(db, project_id, user["id"])

    bug_result = (
        db.table("bugs")
        .select("*")
        .eq("id", body.bug_id)
        .eq("project_id", project_id)
        .execute()
    )
    if not bug_result.data:
        raise NotFoundError("Bug not found")

    bug = bug_result.data[0]
    factors: list[RiskFactor] = []
    score = 0.0
    notes: list[str] = []

    # ── F1: Severity ──────────────────────────────────────
    sev = bug.get("severity", "NORMAL")
    w = _RISK_FACTOR_WEIGHTS["severity"]
    contrib = _RISK_SEVERITY_MAP.get(sev, 0.40) * w
    score += contrib
    factors.append(RiskFactor(name="severity", weight=w, score=round(contrib, 1),
                              description=f"Severity {sev}"))
    if sev in ("BLOCKER", "CRITICAL"):
        notes.append(f"High severity ({sev})")

    # ── F2: Priority ──────────────────────────────────────
    pri = bug.get("priority", "P3")
    w = _RISK_FACTOR_WEIGHTS["priority"]
    contrib = _RISK_PRIORITY_MAP.get(pri, 0.50) * w
    score += contrib
    factors.append(RiskFactor(name="priority", weight=w, score=round(contrib, 1),
                              description=f"Priority {pri}"))
    if pri in ("P1", "P2"):
        notes.append(f"High priority ({pri})")

    # ── F3: Age ───────────────────────────────────────────
    created_dt = _parse_ts(bug.get("created_at", ""))
    age_days = (datetime.now(timezone.utc) - created_dt).days if created_dt else 0
    w = _RISK_FACTOR_WEIGHTS["age_days"]
    contrib = min(1.0, age_days / 30.0) * w
    score += contrib
    factors.append(RiskFactor(name="age_days", weight=w, score=round(contrib, 1),
                              description=f"{age_days} days since creation"))
    if age_days > 14:
        notes.append(f"Age {age_days}d — aging increases risk")

    # ── F4: Status blockage ───────────────────────────────
    status = bug.get("status", "NEW")
    w = _RISK_FACTOR_WEIGHTS["status_blockage"]
    if status in _BLOCKING_STATUSES:
        contrib = float(w)
    elif status == "IN_PROGRESS":
        contrib = w * 0.50
    else:
        contrib = 0.0
    score += contrib
    factors.append(RiskFactor(name="status_blockage", weight=w, score=round(contrib, 1),
                              description=f"Status {status}"))
    if status in _HIGH_RISK_STATUSES:
        notes.append(f"Status '{status}' indicates unresolved work")

    # ── F5: Reopen count ──────────────────────────────────
    reopen_count = 0
    try:
        act = (
            db.table("activity_log")
            .select("id")
            .eq("bug_id", body.bug_id)
            .eq("action", "BUG_REOPENED")
            .execute()
        )
        reopen_count = len(act.data or [])
    except Exception:
        pass
    w = _RISK_FACTOR_WEIGHTS["reopen_count"]
    contrib = min(1.0, reopen_count / 3.0) * w
    score += contrib
    factors.append(RiskFactor(name="reopen_count", weight=w, score=round(contrib, 1),
                              description=f"Reopened {reopen_count}x"))
    if reopen_count > 0:
        notes.append(f"Reopened {reopen_count} time(s)")

    # ── F6: Activity staleness ────────────────────────────
    updated_dt = _parse_ts(bug.get("updated_at", ""))
    stale_days = (datetime.now(timezone.utc) - updated_dt).days if updated_dt else 0
    w = _RISK_FACTOR_WEIGHTS["activity_staleness"]
    contrib = min(1.0, stale_days / 14.0) * w
    score += contrib
    factors.append(RiskFactor(name="activity_staleness", weight=w, score=round(contrib, 1),
                              description=f"Last update {stale_days}d ago"))
    if stale_days > 7:
        notes.append(f"No activity for {stale_days}d")

    # ── F7: Assignment ────────────────────────────────────
    has_assignee = bool(bug.get("assignee_id"))
    w = _RISK_FACTOR_WEIGHTS["no_assignee"]
    contrib = 0.0 if has_assignee else float(w)
    score += contrib
    factors.append(RiskFactor(name="no_assignee", weight=w, score=round(contrib, 1),
                              description="Assigned" if has_assignee else "Unassigned"))
    if not has_assignee:
        notes.append("No assignee — may be untracked")

    # ── Aggregate ─────────────────────────────────────────
    if score >= 70:
        level = "CRITICAL"
    elif score >= 50:
        level = "HIGH"
    elif score >= 30:
        level = "MEDIUM"
    elif score >= 15:
        level = "LOW"
    else:
        level = "MINIMAL"

    return RiskResult(
        risk_level=level,
        risk_score=round(score, 1),
        factors=factors,
        explanation="; ".join(notes) if notes else "Low risk based on available signals",
        bug_id=body.bug_id,
    )


# ═══════════════════════════════════════════════════════════════
#  § 6 — GET /api/intelligence/projects/{id}/triage/suggestions
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/projects/{project_id}/triage/suggestions",
    summary="Triage suggestion list",
    description=(
        "Returns a ranked list of bugs that need attention, scored by"
        " deterministic signals: unassigned, stale, blocking, high-severity."
    ),
)
async def triage_suggestions(
    project_id: str,
    auth=Depends(get_current_user_with_client),
):
    db, user = auth["db"], auth["user"]
    require_project_role(db, project_id, user["id"])

    now = datetime.now(timezone.utc)

    # Fetch all open bugs in the project
    bug_result = (
        db.table("bugs")
        .select("*")
        .eq("project_id", project_id)
        .in_("status", ["NEW", "CONFIRMED", "IN_PROGRESS", "REOPENED"])
        .execute()
    )
    bugs = bug_result.data or []

    # Fetch relationships to find blocking bugs
    rel_result = (
        db.table("relationships")
        .select("source_bug_id, relationship_type")
        .eq("relationship_type", "blocks")
        .execute()
    )
    blocking_ids = {r["source_bug_id"] for r in (rel_result.data or [])}

    suggestions = []
    for bug in bugs:
        score = 0
        reasons = []

        # Unassigned + high severity
        if not bug.get("assignee_id") and bug.get("severity") in ("BLOCKER", "CRITICAL"):
            score += 30
            reasons.append(f"Unassigned {bug['severity']} bug")
        elif not bug.get("assignee_id"):
            score += 15
            reasons.append("Unassigned")

        # Age > 7 days
        created_dt = _parse_ts(bug.get("created_at", ""))
        if created_dt:
            age_days = (now - created_dt).days
            if age_days > 14:
                score += 20
                reasons.append(f"Open for {age_days} days")
            elif age_days > 7:
                score += 10
                reasons.append(f"Open for {age_days} days")

        # Blocking other bugs
        if bug["id"] in blocking_ids:
            score += 25
            reasons.append("Blocking other issues")

        # High severity
        if bug.get("severity") in ("BLOCKER", "CRITICAL"):
            score += 15
            reasons.append(f"Severity {bug['severity']}")

        # Reopened
        if bug.get("status") == "REOPENED":
            score += 10
            reasons.append("Reopened — previously resolved")

        # Stale (no update > 7 days)
        updated_dt = _parse_ts(bug.get("updated_at", ""))
        if updated_dt:
            stale_days = (now - updated_dt).days
            if stale_days > 7:
                score += 10
                reasons.append(f"No activity for {stale_days}d")

        if score > 0:
            suggestions.append({
                "bug_id": bug["id"],
                "title": bug["title"],
                "status": bug["status"],
                "severity": bug.get("severity", "NORMAL"),
                "priority": bug.get("priority", "P3"),
                "score": score,
                "reasons": reasons,
            })

    # Sort by score descending
    suggestions.sort(key=lambda s: s["score"], reverse=True)

    # Summary stats
    critical_unassigned = sum(
        1 for s in suggestions
        if s["severity"] in ("BLOCKER", "CRITICAL") and "Unassigned" in " ".join(s["reasons"])
    )
    blocking = sum(1 for s in suggestions if "Blocking" in " ".join(s["reasons"]))
    stale = sum(1 for s in suggestions if "No activity" in " ".join(s["reasons"]))

    return {
        "suggestions": suggestions[:20],
        "summary": {
            "total_needing_attention": len(suggestions),
            "critical_unassigned": critical_unassigned,
            "blocking_other_issues": blocking,
            "stale_bugs": stale,
        },
    }


# ═══════════════════════════════════════════════════════════════
#  § 7 — GET /api/intelligence/projects/{id}/risk-analysis
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/projects/{project_id}/risk-analysis",
    summary="Project-level risk analysis",
    description=(
        "Computes a project-wide risk score based on open bugs,"
        " blocking dependencies, stale issues, and severity distribution."
    ),
)
async def project_risk_analysis(
    project_id: str,
    auth=Depends(get_current_user_with_client),
):
    db, user = auth["db"], auth["user"]
    require_project_role(db, project_id, user["id"])

    now = datetime.now(timezone.utc)

    # Fetch all bugs
    bug_result = (
        db.table("bugs")
        .select("*")
        .eq("project_id", project_id)
        .execute()
    )
    bugs = bug_result.data or []

    open_bugs = [b for b in bugs if b.get("status") not in ("RESOLVED", "VERIFIED", "CLOSED")]

    # Fetch blocking relationships (via bug IDs in this project)
    bug_ids = [b["id"] for b in bugs]
    blocking_count = 0
    if bug_ids:
        rel_result = (
            db.table("relationships")
            .select("source_bug_id, relationship_type")
            .eq("relationship_type", "blocks")
            .in_("source_bug_id", bug_ids)
            .execute()
        )
        blocking_count = len(rel_result.data or [])

    factors = []
    total_score = 0.0

    # F1: Open P1 bugs (weight: 10 each)
    p1_count = sum(1 for b in open_bugs if b.get("priority") == "P1")
    w = 10
    contrib = min(float(w * 3), p1_count * w) if p1_count > 0 else 0.0
    total_score += contrib
    factors.append({"factor": "Open P1 issues", "count": p1_count, "weight": contrib,
                    "description": f"{p1_count} P1 bugs still open"})

    # F2: Critical/Blocker bugs (weight: 5 each)
    crit_count = sum(1 for b in open_bugs if b.get("severity") in ("BLOCKER", "CRITICAL"))
    w = 5
    contrib = min(float(w * 4), crit_count * w) if crit_count > 0 else 0.0
    total_score += contrib
    factors.append({"factor": "Critical/Blocker bugs", "count": crit_count, "weight": contrib,
                    "description": f"{crit_count} high-severity open bugs"})

    # F3: Unassigned high-severity (weight: 8 each)
    unassigned_crit = sum(
        1 for b in open_bugs
        if not b.get("assignee_id") and b.get("severity") in ("BLOCKER", "CRITICAL", "MAJOR")
    )
    w = 8
    contrib = min(float(w * 3), unassigned_crit * w) if unassigned_crit > 0 else 0.0
    total_score += contrib
    factors.append({"factor": "Unassigned critical bugs", "count": unassigned_crit, "weight": contrib,
                    "description": f"{unassigned_crit} high-severity bugs with no assignee"})

    # F4: Blocking dependencies (weight: 7 each)
    w = 7
    contrib = min(float(w * 4), blocking_count * w) if blocking_count > 0 else 0.0
    total_score += contrib
    factors.append({"factor": "Blocking dependencies", "count": blocking_count, "weight": contrib,
                    "description": f"{blocking_count} bugs are blocking other issues"})

    # F5: Stale bugs >14 days (weight: 3 each)
    stale_count = 0
    for b in open_bugs:
        created_dt = _parse_ts(b.get("created_at", ""))
        if created_dt and (now - created_dt).days > 14:
            stale_count += 1
    w = 3
    contrib = min(float(w * 5), stale_count * w) if stale_count > 0 else 0.0
    total_score += contrib
    factors.append({"factor": "Stale bugs (>14 days)", "count": stale_count, "weight": contrib,
                    "description": f"{stale_count} bugs open for over 2 weeks"})

    # F6: Total open bugs (weight: 1 each)
    w = 1
    contrib = min(float(w * 10), len(open_bugs) * w)
    total_score += contrib
    factors.append({"factor": "Total open bugs", "count": len(open_bugs), "weight": contrib,
                    "description": f"{len(open_bugs)} total open bugs"})

    # Risk level
    if total_score >= 81:
        level = "CRITICAL"
    elif total_score >= 51:
        level = "HIGH"
    elif total_score >= 21:
        level = "MEDIUM"
    else:
        level = "LOW"

    # Recommendations
    recommendations = []
    if unassigned_crit > 0:
        recommendations.append(f"Assign the {unassigned_crit} unassigned critical bugs immediately")
    if p1_count > 0:
        recommendations.append(f"Review {p1_count} P1 issues for progress")
    if blocking_count > 0:
        recommendations.append(f"Resolve blocking dependencies to unblock {blocking_count} downstream bugs")
    if stale_count > 0:
        recommendations.append(f"Triage {stale_count} stale bugs that haven't been updated in 14+ days")

    return {
        "project_id": project_id,
        "risk_score": round(total_score, 1),
        "risk_level": level,
        "factors": factors,
        "recommendations": recommendations,
        "total_bugs": len(bugs),
        "open_bugs": len(open_bugs),
    }
