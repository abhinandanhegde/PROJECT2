"""
Common response schemas shared across all routers.
"""

from typing import Generic, TypeVar, List
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Wrapper returned by every list endpoint."""
    data: List[T]
    total: int
    page: int
    per_page: int


class ErrorResponse(BaseModel):
    """Standard error body."""
    detail: str
