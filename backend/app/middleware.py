"""
T2 Bug Tracker — Security & Logging Middleware

Provides:
1. Security headers middleware (X-Content-Type-Options, X-Frame-Options, etc.)
2. Request ID middleware (adds X-Request-ID to every response)
3. Access log middleware (structured JSON request logging)
"""

import json
import logging
import time
import uuid

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("app.access")

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
# Access Log Middleware
# ============================================================


class AccessLogMiddleware(BaseHTTPMiddleware):
    """
    Structured JSON access logging for every request.

    Emits one JSON object per request:
      {"level":"REQUEST","ts":...,"request_id":...,"method":...,"path":...,
       "status":...,"duration_ms":...,"remote_addr":...}
    """

    async def dispatch(self: "AccessLogMiddleware", request: Request, call_next):
        start_ns = time.perf_counter_ns()

        try:
            response: Response = await call_next(request)
        except Exception:
            # Log the failure so structured logging still captures it
            try:
                status_code = 500
                logger.info(
                    json.dumps(
                        {
                            "level": "REQUEST",
                            "ts": time.time(),
                            "request_id": getattr(request.state, "request_id", None),
                            "method": request.method,
                            "path": request.url.path,
                            "status": status_code,
                            "duration_ms": round(
                                (time.perf_counter_ns() - start_ns) / 1_000_000, 3
                            ),
                            "remote_addr": request.client.host if request.client else None,
                            "error": "unhandled",
                        }
                    )
                )
            except Exception:
                pass
            raise

        duration_ms = round((time.perf_counter_ns() - start_ns) / 1_000_000, 3)
        log_entry = {
            "level": "REQUEST",
            "ts": time.time(),
            "request_id": getattr(request.state, "request_id", None),
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": duration_ms,
            "remote_addr": request.client.host if request.client else None,
        }
        logger.info(json.dumps(log_entry, default=str))

        return response


# ============================================================
# Middleware Registration Helper
# ============================================================


def register_middleware(app):
    """
    Register all middleware on the FastAPI app.

    Call this in main.py:
        from .middleware import register_middleware
        register_middleware(app)
    """
    # Order matters: RequestID first (so other middleware can use it),
    # then AccessLog, then SecurityHeaders
    app.add_middleware(RequestIDMiddleware)
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)
