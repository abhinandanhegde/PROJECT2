"""
Project request / response schemas.
"""

from typing import Optional, Dict
from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    created_by: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ProjectStats(BaseModel):
    total_bugs: int = 0
    open_bugs: int = 0
    closed_bugs: int = 0
    resolved_bugs: int = 0
    bugs_by_severity: Dict[str, int] = {}
    bugs_by_priority: Dict[str, int] = {}
    bugs_by_status: Dict[str, int] = {}
    recent_activity: int = 0
    member_count: int = 0
