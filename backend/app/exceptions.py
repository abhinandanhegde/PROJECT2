"""
T2 Bug Tracker — Custom Exceptions & Error Handlers

Provides consistent error response format across the API:
{
    "detail": "Human-readable error message"
}
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse


# ============================================================
# Custom Exception Classes
# ============================================================


class AuthenticationError(HTTPException):
    """401 — Not authenticated or invalid token."""

    def __init__(self, detail: str = "Not authenticated"):
        super().__init__(status_code=401, detail=detail)


class AuthorizationError(HTTPException):
    """403 — Authenticated but not authorized."""

    def __init__(self, detail: str = "Not authorized"):
        super().__init__(status_code=403, detail=detail)


class NotFoundError(HTTPException):
    """404 — Resource not found."""

    def __init__(self, detail: str = "Resource not found"):
        super().__init__(status_code=404, detail=detail)


class ConflictError(HTTPException):
    """409 — Conflict (e.g., duplicate membership)."""

    def __init__(self, detail: str = "Resource conflict"):
        super().__init__(status_code=409, detail=detail)


class ValidationError(HTTPException):
    """422 — Invalid lifecycle transition or business rule violation."""

    def __init__(self, detail: str = "Validation error"):
        super().__init__(status_code=422, detail=detail)


# ============================================================
# Exception Handlers
# ============================================================


def register_exception_handlers(app: FastAPI):
    """Register custom exception handlers on the FastAPI app."""

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError):
        return JSONResponse(
            status_code=400,
            content={"detail": str(exc)},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        # Log the full error in production
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
