"""
Bug request / response schemas and enums.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class BugStatus(str, Enum):
    NEW = "NEW"
    CONFIRMED = "CONFIRMED"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"
    VERIFIED = "VERIFIED"
    CLOSED = "CLOSED"
    REOPENED = "REOPENED"


class BugSeverity(str, Enum):
    BLOCKER = "BLOCKER"
    CRITICAL = "CRITICAL"
    MAJOR = "MAJOR"
    NORMAL = "NORMAL"
    MINOR = "MINOR"
    TRIVIAL = "TRIVIAL"


class BugPriority(str, Enum):
    P1 = "P1"
    P2 = "P2"
    P3 = "P3"
    P4 = "P4"
    P5 = "P5"


class Resolution(str, Enum):
    FIXED = "FIXED"
    INVALID = "INVALID"
    WONT_FIX = "WONT_FIX"
    DUPLICATE = "DUPLICATE"


VALID_TRANSITIONS: dict[str, list[str]] = {
    "NEW":         ["CONFIRMED"],
    "CONFIRMED":   ["IN_PROGRESS", "NEW"],
    "IN_PROGRESS": ["RESOLVED", "CONFIRMED"],
    "RESOLVED":    ["VERIFIED", "REOPENED"],
    "VERIFIED":    ["CLOSED", "REOPENED"],
    "REOPENED":    ["CONFIRMED", "IN_PROGRESS"],
    "CLOSED":      ["REOPENED"],
}


class BugCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    severity: BugSeverity = BugSeverity.NORMAL
    priority: BugPriority = BugPriority.P3
    component_id: Optional[str] = None
    assignee_id: Optional[str] = None


class BugUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = None
    severity: Optional[BugSeverity] = None
    priority: Optional[BugPriority] = None
    component_id: Optional[str] = None
    assignee_id: Optional[str] = None


class StatusChangeRequest(BaseModel):
    status: BugStatus
    resolution: Optional[Resolution] = None


class AssignRequest(BaseModel):
    assignee_id: str


class BugResponse(BaseModel):
    id: str
    number: Optional[int] = None
    project_id: str
    title: str
    description: Optional[str] = None
    status: str
    severity: str
    priority: str
    component_id: Optional[str] = None
    assignee_id: Optional[str] = None
    reporter_id: str
    reporter_name: Optional[str] = None
    assignee_name: Optional[str] = None
    resolution: Optional[str] = None
    duplicate_of: Optional[str] = None
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}
