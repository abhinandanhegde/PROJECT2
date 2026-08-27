"""
Bug-relationship request / response schemas.
"""

from enum import Enum
from pydantic import BaseModel


class RelationshipType(str, Enum):
    BLOCKS = "blocks"
    DEPENDS_ON = "depends_on"
    RELATED_TO = "related_to"


class RelationshipCreate(BaseModel):
    target_bug_id: str
    relationship_type: RelationshipType


class RelationshipResponse(BaseModel):
    id: str
    source_bug_id: str
    target_bug_id: str
    relationship_type: str
    created_by: str
    created_at: str

    model_config = {"from_attributes": True}
