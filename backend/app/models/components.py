"""
Component request / response schemas.
"""

from typing import Optional
from pydantic import BaseModel, Field


class ComponentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None


class ComponentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None


class ComponentResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    created_at: str

    model_config = {"from_attributes": True}
