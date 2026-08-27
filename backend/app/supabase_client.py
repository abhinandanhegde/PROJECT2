"""
T2 Bug Tracker — Supabase Client Factory

Provides two client types:
1. Service-role client: Admin/background ops ONLY (bypasses RLS)
2. User-context client: For normal API requests (RLS enforced)

CRITICAL: Never use service-role client for user-facing requests.
"""

import os
from typing import Optional

from supabase import Client, create_client

# ============================================================
# Configuration
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


# ============================================================
# Service-Role Client (ADMIN/Background ONLY)
# ============================================================

_service_role_client: Optional[Client] = None


def get_service_role_client() -> Client:
    """
    Get the privileged service-role Supabase client.

    ⚠️  USE ONLY FOR:
    - User sync operations
    - Seed data
    - Administrative tasks
    - Background jobs

    ❌ NEVER USE FOR:
    - Normal user-facing API requests
    - Any operation where RLS should be enforced
    """
    global _service_role_client

    if _service_role_client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set "
                "for the service-role client"
            )
        _service_role_client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    return _service_role_client


# ============================================================
# User-Context Client (Normal API requests)
# ============================================================


def get_user_client(access_token: str) -> Client:
    """
    Create a Supabase client authenticated with a user's JWT.

    This client carries the user's identity so RLS policies
    can enforce project-level access control.

    Usage in FastAPI:
        user = await get_current_active_user(token=token)
        client = get_user_client(access_token=token)
        result = client.table("bugs").select("*").execute()

    Args:
        access_token: The user's Supabase JWT access token

    Returns:
        A Supabase client scoped to the authenticated user
    """
    if not SUPABASE_URL or not SUPABASE_ANON_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_ANON_KEY must be set"
        )

    # Create a client with the user's JWT for RLS enforcement
    client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

    # Set the user's access token so PostgREST sees their auth context
    # This ensures auth.uid() returns the correct user in RLS policies
    client.postgrest.auth(access_token)

    return client


# ============================================================
# User-Context via Raw SQL (alternative for complex queries)
# ============================================================


def get_user_client_sql(access_token: str) -> tuple[str, dict]:
    """
    For operations that need raw SQL with user context,
    return the connection info needed to set the JWT claims.

    Usage:
        url, headers = get_user_client_sql(token)
        # Then use with httpx or psycopg2 with those headers

    Returns:
        Tuple of (supabase_url, headers_dict)
    """
    return (
        SUPABASE_URL,
        {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )
