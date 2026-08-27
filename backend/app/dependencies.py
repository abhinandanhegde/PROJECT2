"""
T2 Bug Tracker — Shared FastAPI Dependencies

Provides reusable dependencies for Dev 2's endpoints:
- get_db_user_context(): Supabase client with user's JWT (for RLS)
- get_db_service_role(): Admin client (for trusted operations only)
- get_current_user_with_client(): Combined auth + DB client
"""

from typing import AsyncGenerator

from fastapi import Depends

from .auth import get_current_active_user, get_raw_token
from .supabase_client import get_service_role_client, get_user_client

# ============================================================
# Database Client Dependencies
# ============================================================


async def get_db_user_context(
    token: str = Depends(get_raw_token),
):
    """
    FastAPI dependency that provides a Supabase client
    authenticated with the current user's JWT.

    RLS policies will be enforced based on this user's identity.

    Usage in Dev 2's endpoints:
        @router.get("/projects/{project_id}/bugs")
        async def list_bugs(
            project_id: str,
            user: dict = Depends(get_current_active_user),
            db = Depends(get_db_user_context),
        ):
            result = db.table("bugs").select("*").eq("project_id", project_id).execute()
            return result.data
    """
    return get_user_client(access_token=token)


def get_db_service_role():
    """
    FastAPI dependency that provides the service-role Supabase client.

    ⚠️  WARNING: This bypasses ALL RLS policies.
    Only use for administrative operations like:
    - User sync from auth.users
    - Seed data operations
    - Background tasks

    Usage:
        @router.post("/admin/sync-users")
        async def sync_users(db_admin = Depends(get_db_service_role)):
            # This query bypasses RLS
            ...
    """
    return get_service_role_client()


# ============================================================
# Combined Dependencies (Auth + DB)
# ============================================================


async def get_current_user_with_client(
    token: str = Depends(get_raw_token),
    user: dict = Depends(get_current_active_user),
):
    """
    FastAPI dependency that provides both the authenticated user
    AND a user-context database client.

    Returns a dict with:
      - user: dict with id, email, role
      - db: Supabase client with user's JWT (RLS enforced)

    Usage in Dev 2's endpoints:
        @router.post("/projects/{project_id}/bugs")
        async def create_bug(
            project_id: str,
            data: BugCreate,
            ctx = Depends(get_current_user_with_client),
        ):
            user = ctx["user"]
            db = ctx["db"]
            # user["id"] is the authenticated user
            # db queries enforce RLS
    """
    return {
        "user": user,
        "db": get_user_client(access_token=token),
    }
