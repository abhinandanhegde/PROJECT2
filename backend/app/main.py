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
