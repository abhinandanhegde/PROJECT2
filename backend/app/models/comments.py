"""
Comment request / response schemas.
"""

from pydantic import BaseModel, Field


class CommentCreate(BaseModel):
    body: str = Field(..., min_length=1)


class CommentUpdate(BaseModel):
    body: str = Field(..., min_length=1)


class CommentResponse(BaseModel):
    id: str
    bug_id: str
    author_id: str
    body: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}
