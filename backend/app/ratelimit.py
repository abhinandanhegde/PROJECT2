"""
Lightweight per-user sliding-window rate limiter.

No external dependencies — a simple in-memory bucketing scheme keyed by
user id. Applied to expensive intelligence endpoints (triage, duplicates,
risk) to prevent abuse.
"""

import time
import threading
from collections import defaultdict, deque
from typing import DefaultDict, Deque

from fastapi import Depends, Request
from starlette.responses import JSONResponse

from app.auth import get_current_active_user


class SlidingWindowLimiter:
    """Tracks request timestamps per key in a sliding window."""

    def __init__(self, limit: int = 30, window_seconds: int = 60):
        self.limit = limit
        self.window = window_seconds
        self._hits: DefaultDict[str, Deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            dq = self._hits[key]
            # Drop timestamps outside the window
            while dq and now - dq[0] >= self.window:
                dq.popleft()
            if len(dq) >= self.limit:
                return False
            dq.append(now)
            return True


# One shared limiter for all intelligence endpoints.
intel_limiter = SlidingWindowLimiter(limit=100, window_seconds=60)


def rate_limit_intelligence(
    request: Request,
    user: dict = Depends(get_current_active_user),
):
    """
    FastAPI dependency. Rejects a call with 429 when the authenticated
    user exceeds the per-minute budget on intelligence endpoints.
    """
    if not intel_limiter.allow(user["id"]):
        raise RateLimitError(
            "Rate limit exceeded. Please wait a minute and try again."
        )
    return True


class RateLimitError(Exception):
    """Thrown when a rate limit is exceeded."""

    def __init__(self, detail: str = "Rate limit exceeded"):
        self.detail = detail


def rate_limit_error_handler(request: Request, exc: RateLimitError):
    return JSONResponse(status_code=429, content={"detail": exc.detail})