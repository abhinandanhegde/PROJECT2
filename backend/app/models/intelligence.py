"""
Intelligence Schemas — Request / Response models for the analysis engine.

Triage, duplicate detection, and risk analysis share no mutable state;
each endpoint is pure-function in → pure-struct out.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


# ═══════════════════════════════════════════════════════════════
#  Triage
# ═══════════════════════════════════════════════════════════════


class TriageRequest(BaseModel):
    """Input for deterministic bug triage."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Bug title — primary signal for keyword analysis",
        examples=["Application crashes on login"],
    )
    description: str | None = Field(
        None,
        description="Optional description — secondary signal for keyword analysis",
        examples=["The app crashes when users enter special characters in the password field"],
    )
    severity: str | None = Field(
        None,
        description="Reporter-provided severity (BLOCKER/CRITICAL/MAJOR/NORMAL/MINOR/TRIVIAL)",
        examples=["CRITICAL"],
    )
    priority: str | None = Field(
        None,
        description="Reporter-provided priority (P1–P5)",
        examples=["P1"],
    )
    component: str | None = Field(
        None,
        description="Optional component name for context",
        examples=["Backend"],
    )
    status: str | None = Field(
        None,
        description="Current bug status for context",
        examples=["NEW"],
    )


class TriageResult(BaseModel):
    """Deterministic triage output with reasoning chain."""

    suggested_severity: str = Field(
        ...,
        description="Engine-suggested severity level",
        examples=["CRITICAL"],
    )
    suggested_priority: str = Field(
        ...,
        description="Engine-suggested priority level",
        examples=["P1"],
    )
    confidence: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Confidence score (0.0 = no signal, 1.0 = high certainty)",
        examples=[0.72],
    )
    reasons: list[str] = Field(
        ...,
        description="Human-readable reasoning chain explaining the suggestion",
        examples=[["Keyword analysis suggests CRITICAL", "Reporter severity aligns with suggestion"]],
    )
    signals: list[str] = Field(
        ...,
        description="Raw signals extracted from the input",
        examples=[["Reporter-provided severity: CRITICAL", "Detailed description provided"]],
    )


# ═══════════════════════════════════════════════════════════════
#  Duplicate Detection
# ═══════════════════════════════════════════════════════════════


class DuplicateRequest(BaseModel):
    """Input for pg_trgm duplicate detection."""

    title: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="Bug title to search for duplicates against",
        examples=["Application crashes on login"],
    )
    description: str | None = Field(
        None,
        description="Optional description to improve matching accuracy",
    )
    threshold: float = Field(
        0.3,
        ge=0.0,
        le=1.0,
        description="Minimum similarity score to include a candidate (0.0–1.0)",
        examples=[0.3],
    )
    limit: int = Field(
        5,
        ge=1,
        le=20,
        description="Maximum number of duplicate candidates to return",
        examples=[5],
    )


class DuplicateCandidate(BaseModel):
    """A single potential duplicate bug."""

    bug_id: str = Field(..., description="Unique bug identifier")
    title: str = Field(..., description="Bug title")
    status: str = Field(..., description="Current bug status")
    severity: str | None = Field(None, description="Bug severity")
    priority: str | None = Field(None, description="Bug priority")
    similarity: float = Field(
        ...,
        ge=0.0,
        le=1.0,
        description="Trigram / Jaccard similarity score",
    )
    match_type: str = Field(
        ...,
        description="Which matching strategy found this candidate (title_trgm, title_jaccard, etc.)",
    )


class DuplicateResult(BaseModel):
    """Duplicate detection output."""

    candidates: list[DuplicateCandidate] = Field(
        ...,
        description="Ranked list of potential duplicates",
    )
    query_title: str = Field(..., description="The title that was searched")
    checked_at: str = Field(..., description="ISO-8601 UTC timestamp of the check")


# ═══════════════════════════════════════════════════════════════
#  Risk Analysis
# ═══════════════════════════════════════════════════════════════


class RiskRequest(BaseModel):
    """Input for risk analysis."""

    bug_id: str = Field(
        ...,
        description="UUID of the bug to analyze",
    )


class RiskFactor(BaseModel):
    """One weighted signal contributing to the overall risk score."""

    name: str = Field(
        ...,
        description="Factor identifier (severity, priority, age_days, …)",
    )
    weight: float = Field(
        ...,
        description="Maximum points this factor can contribute",
    )
    score: float = Field(
        ...,
        description="Actual points contributed (0–weight)",
    )
    description: str = Field(
        ...,
        description="Human-readable summary of this factor's value",
    )


class RiskResult(BaseModel):
    """Risk analysis output with full factor breakdown."""

    risk_level: str = Field(
        ...,
        description="Risk classification (CRITICAL / HIGH / MEDIUM / LOW / MINIMAL)",
        examples=["HIGH"],
    )
    risk_score: float = Field(
        ...,
        ge=0.0,
        le=100.0,
        description="Composite risk score (0–100)",
        examples=[62.5],
    )
    factors: list[RiskFactor] = Field(
        ...,
        description="Individual factor breakdown",
    )
    explanation: str = Field(
        ...,
        description="Semi-structured explanation of the top risk drivers",
        examples=["High severity (BLOCKER); Reopened 2 time(s); No assignee — may be untracked"],
    )
    bug_id: str = Field(..., description="The analyzed bug's UUID")
