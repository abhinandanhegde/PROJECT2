from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import time
from dotenv import load_dotenv

load_dotenv()

# Structured request logging (JSON lines to stderr). Enabled by default so
# access logs always surface; tune the numeric level in production via env.
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(message)s")
logger = logging.getLogger(__name__)

from .exceptions import register_exception_handlers
from .middleware import register_middleware
from .ratelimit import RateLimitError, rate_limit_error_handler

app = FastAPI(
    title="T2 Bug Tracker API",
    description="Backend API for the T2 Bug Tracker",
    version="0.1.0",
)

app.add_exception_handler(RateLimitError, rate_limit_error_handler)

# ============================================================
# CORS configuration
# ============================================================

origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.11:3000",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Register middleware (security headers + request ID)
# ============================================================

register_middleware(app)

# ============================================================
# Register exception handlers (consistent error format)
# ============================================================

register_exception_handlers(app)

# ============================================================
# Health check (keep this — used by Dev 2 + deployments)
# ============================================================


_START_TIME = time.time()


@app.get("/health")
def health_check():
    return {"status": "ok"}


@app.get("/health/detail")
def health_detail(request: Request):
    """Rich health detail for ops/dashboards: version, uptime, request id."""
    return {
        "status": "ok",
        "service": app.title,
        "version": app.version,
        "uptime_seconds": round(time.time() - _START_TIME, 3),
        "request_id": getattr(request.state, "request_id", None),
    }


# ============================================================
# API Routers
# ============================================================

from .routers.projects import router as projects_router
from .routers.bugs import router as bugs_router
from .routers.comments import router as comments_router
from .routers.components import router as components_router
from .routers.members import router as members_router
from .routers.relationships import router as relationships_router
from .routers.dashboard import router as dashboard_router
from .routers.intelligence import router as intelligence_router
from .routers.demo import router as demo_router
from .routers.auth import router as auth_router

app.include_router(projects_router)
app.include_router(bugs_router)
app.include_router(comments_router)
app.include_router(components_router)
app.include_router(members_router)
app.include_router(relationships_router)
app.include_router(dashboard_router)
app.include_router(intelligence_router)
app.include_router(demo_router)
app.include_router(auth_router)
