from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from .exceptions import register_exception_handlers
from .middleware import register_middleware

app = FastAPI(
    title="T2 Bug Tracker API",
    description="Backend API for the T2 Bug Tracker",
    version="0.1.0",
)

# ============================================================
# CORS configuration
# ============================================================

origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000",
).split(",")

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


@app.get("/health")
def health_check():
    return {"status": "ok"}


# ============================================================
# NOTE: Do NOT add routers here.
# Dev 2 owns all API routers and adds them in their branch.
# Dev 2 should import and register routers like:
#
#   from .routers import bugs, projects, auth
#   app.include_router(bugs.router)
#   app.include_router(projects.router)
#   app.include_router(auth.router)
# ============================================================
