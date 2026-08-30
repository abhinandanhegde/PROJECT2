"""
T2 Bug Tracker — Custom Exceptions & Error Handlers

Provides consistent error response format across the API:
{
    "detail": "Human-readable error message"
}
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError


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

    @app.exception_handler(APIError)
    async def api_error_handler(request: Request, exc: APIError):
        # PostgREST/Supabase errors surface as APIError with a SQLSTATE-style
        # code. Map them to meaningful HTTP statuses instead of a generic 500.
        code = (exc.code or "").upper()
        status_by_code = {
            "42501": 403,          # insufficient privilege / RLS policy denial
            "PGRST204": 404,       # no rows found
            "PGRST116": 404,
            "PGRST117": 404,
            "23505": 409,          # unique violation
            "23503": 409,          # foreign key violation
            "23502": 422,          # not-null violation
            "23514": 422,          # check violation
            "22P02": 422,          # invalid text representation
        }
        status = status_by_code.get(code, 400)
        detail = exc.message or exc.details or code or "Database request failed"
        return JSONResponse(
            status_code=status,
            content={"detail": detail},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        import logging
        logging.getLogger(__name__).exception("Unhandled exception")
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )
