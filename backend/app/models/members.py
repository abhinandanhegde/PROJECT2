"""
Member request / response schemas.
"""

from enum import Enum
from pydantic import BaseModel


class MemberRole(str, Enum):
    ADMIN = "ADMIN"
    DEVELOPER = "DEVELOPER"


class MemberAdd(BaseModel):
    user_id: str
    role: MemberRole = MemberRole.DEVELOPER


class MemberUpdate(BaseModel):
    role: MemberRole


class MemberResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    role: str
    created_at: str

    model_config = {"from_attributes": True}
