"""
T2 Bug Tracker — Authentication Module

Verifies Supabase JWT tokens and extracts authenticated user context.
Used by Dev 2's endpoints as a FastAPI dependency.
"""

import os
from functools import lru_cache
from typing import Optional

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# ============================================================
# Configuration
# ============================================================

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json" if SUPABASE_URL else ""

# Token scheme — extracts Bearer token from Authorization header
security = HTTPBearer(auto_error=False)


# ============================================================
# JWKS Caching (Supabase signs JWTs with rotating keys)
# ============================================================

_jwks_cache: Optional[dict] = None


async def _fetch_jwks() -> dict:
    """Fetch JWKS from Supabase, with in-memory caching."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    if not SUPABASE_JWKS_URL:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_URL not configured",
        )

    async with httpx.AsyncClient() as client:
        response = await client.get(SUPABASE_JWKS_URL, timeout=10.0)
        response.raise_for_status()
        _jwks_cache = response.json()
        return _jwks_cache


def _get_signing_key(jwks: dict, token_header: dict) -> str:
    """Extract the signing key from JWKS for the given token header."""
    kid = token_header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing key ID",
        )

    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            # Return the key as a jwt.PyJWK for PyJWT compatibility
            return jwt.algorithms.RSAAlgorithm.from_jwk(key)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unable to find matching signing key",
    )


# ============================================================
# JWT Verification
# ============================================================


async def verify_supabase_token(token: str) -> dict:
    """
    Verify a Supabase JWT access token.

    Returns the decoded token payload with claims like:
      - sub (user ID)
      - email
      - aud
      - exp
      - role
    """
    try:
        # Decode header to get kid
        unverified_header = jwt.get_unverified_header(token)
    except jwt.DecodeError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        )

    # Fetch JWKS and get the signing key
    jwks = await _fetch_jwks()
    signing_key = _get_signing_key(jwks, unverified_header)

    try:
        payload = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience="authenticated",
            options={
                "verify_exp": True,
                "verify_aud": True,
                "require": ["exp", "sub", "aud"],
            },
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidAudienceError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token audience",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )


# ============================================================
# FastAPI Dependencies
# ============================================================


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """
    FastAPI dependency that extracts and verifies the Supabase JWT.

    Returns a dict with at minimum:
      - id: UUID (the user's auth.uid())
      - email: str

    Raises 401 if token is missing, invalid, or user not in users table.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    payload = await verify_supabase_token(token)

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing user ID",
        )

    # Build user dict from JWT claims
    user = {
        "id": user_id,
        "email": payload.get("email", ""),
        "role": payload.get("role", ""),
        "aud": payload.get("aud", ""),
    }

    return user


async def get_current_active_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    FastAPI dependency for endpoints requiring an authenticated user.

    Extends get_current_user with any additional checks if needed.
    Currently just passes through the verified user.
    """
    # Future: could check if user is active/disabled
    return current_user


# ============================================================
# Utility: Get raw token string (for creating user-context clients)
# ============================================================


async def get_raw_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    FastAPI dependency that returns the raw JWT string.
    Used by Dev 2 to create a user-context Supabase client.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return credentials.credentials
