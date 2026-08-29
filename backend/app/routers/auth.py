"""
Auth Router — Minimal backend auth endpoints.

Supabase Auth handles signup/login/logout from the frontend.
This router only provides backend profile lookups.
"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user_with_client

router = APIRouter(prefix="/api", tags=["auth"])


@router.get("/auth/me")
async def get_current_user_profile(auth=Depends(get_current_user_with_client)):
    """Return the current user's profile from the users table."""
    user = auth["user"]
    db = auth["db"]

    result = db.table("users").select("*").eq("id", user["id"]).execute()

    if not result.data:
        return {
            "id": user["id"],
            "email": user.get("email", ""),
            "display_name": user.get("email", "").split("@")[0],
            "avatar_url": None,
        }

    return result.data[0]
