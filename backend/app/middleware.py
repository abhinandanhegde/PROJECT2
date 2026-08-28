"""
T2 Bug Tracker — Security Middleware

Provides:
1. Security headers middleware (X-Content-Type-Options, X-Frame-Options, etc.)
2. Request ID middleware (adds X-Request-ID to every response)
"""

import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


# ============================================================
# Security Headers Middleware
# ============================================================


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds security headers to all responses.

    Headers added:
    - X-Content-Type-Options: nosniff
    - X-Frame-Options: DENY
    - X-XSS-Protection: 1; mode=block
    - Referrer-Policy: strict-origin-when-cross-origin
    - Permissions-Policy: camera=(), microphone=(), geolocation=()
    - X-Request-ID: (see RequestIDMiddleware)
    """

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "camera=(), microphone=(), geolocation=()"
        )
        # Prevent caching of sensitive responses
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
        response.headers["Pragma"] = "no-cache"

        return response


# ============================================================
# Request ID Middleware
# ============================================================


class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    Adds a unique X-Request-ID to every response.
    If the client sends an X-Request-ID header, it's echoed back.
    Otherwise, a new UUID4 is generated.
    """

    async def dispatch(self: "RequestIDMiddleware", request: Request, call_next):
        # Use client-provided request ID or generate a new one
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

        # Store on request state for logging
        request.state.request_id = request_id

        response: Response = await call_next(request)
        response.headers["X-Request-ID"] = request_id

        return response


# ============================================================
# Middleware Registration Helper
# ============================================================


def register_middleware(app):
    """
    Register all security middleware on the FastAPI app.

    Call this in main.py:
        from .middleware import register_middleware
        register_middleware(app)
    """
    # Order matters: RequestID first (so other middleware can use it),
    # then SecurityHeaders
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
