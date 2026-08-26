# Security Developer — AI Prompt

> Copy everything between the START and END markers into your AI tool.

---

## START PROMPT

I am the **Security Developer** on a 4-person team building a bug-tracking platform (T2 Bug Tracker) inspired by Bugzilla. The project already has a shared skeleton on GitHub. I just cloned it. I need you to guide me through building all security, authentication, and access-control features on my `feat/security` branch.

### EXISTING PROJECT SKELETON

```
T2/
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── app/main.py          # FastAPI — GET /health, CORS configured for localhost:3000
│   └── requirements.txt     # fastapi, uvicorn, pydantic
├── database/
│   └── README.md            # "Schema TBD"
├── docs/
│   ├── api-contract.md      # Only GET /health
│   └── architecture.md      # Browser → Next.js → FastAPI → Supabase PostgreSQL
├── frontend/
│   └── (Next.js 15 skeleton — not my concern)
└── scripts/
    └── README.md
```

### EXISTING BACKEND CODE

```python
# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

app = FastAPI(
    title="T2 Bug Tracker API",
    description="Backend API for the T2 Bug Tracker",
    version="0.1.0",
)

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

@app.get("/health")
def health_check():
    return {"status": "ok"}
```

### ENVIRONMENT VARIABLES

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### WHAT I NEED TO BUILD (SECURITY FEATURES)

**Build in this order:**

#### Phase 1 — Supabase Auth Integration
1. **Supabase client setup for backend** — create `backend/app/supabase_client.py`:
   - Initialize `supabase-py` client with service role key
   - Helper function to verify JWT tokens from incoming requests
   - Helper function to get user info from token
2. **Auth dependency** — create `backend/app/auth.py`:
   - `get_current_user(token)` — extracts and verifies Supabase JWT
   - Returns user ID, email, role from the token
   - Raises 401 if token is invalid/expired
3. **Auth middleware** — update `main.py`:
   - Skip auth for `/health`, `/docs`, `/openapi.json`
   - Apply auth check to all other API routes
4. **Auth endpoints** — create `backend/app/routers/auth.py`:
   - `POST /auth/signup` — create user via Supabase Auth, then create profile in `users` table
   - `POST /auth/login` — authenticate via Supabase, return JWT + refresh token
   - `POST /auth/logout` — invalidate session
   - `GET /auth/me` — return current user profile from JWT

#### Phase 2 — Row-Level Security (RLS)
5. **RLS policies SQL** — create `database/rls.sql`:
   - `bugs` table:
     - Anyone can read bugs (or only team members — decide and document)
     - Only reporter can update/delete their own bugs
     - Admins can update/delete any bug
   - `comments` table:
     - Anyone can read comments on bugs they can see
     - Only author can delete their own comments
   - `users` table:
     - Users can read all profiles
     - Users can only update their own profile
     - Only admins can delete users
6. **Enable RLS on all tables** — add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` statements
7. **Service role bypass** — document when to use service role vs anon key:
   - Service role: admin operations, background tasks
   - Anon key: user-facing operations (RLS enforced)
   - User JWT: most operations (RLS + RLS policies apply)

#### Phase 3 — API Security Hardening
8. **Input validation** — ensure all Pydantic models have:
   - `max_length` on string fields
   - Email format validation
   - UUID format validation for IDs
   - No SQL injection vectors
9. **Rate limiting** — add rate limiting middleware:
   - 100 requests/minute per user for general endpoints
   - 10 requests/minute for auth endpoints (login/signup)
   - Use `slowapi` or in-memory rate limiter
10. **Security headers** — add middleware for:
    - `X-Content-Type-Options: nosniff`
    - `X-Frame-Options: DENY`
    - `X-XSS-Protection: 1; mode=block`
    - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
    - `Content-Security-Policy` (basic policy)
11. **CORS hardening** — update CORS config:
    - Only allow specific origins (no wildcards in production)
    - Add env var for production origins: `PRODUCTION_ORIGINS`
    - Validate origin header against allowed list

#### Phase 4 — Audit & Monitoring
12. **Request logging** — add middleware that logs:
    - Method, path, status code, response time
    - User ID (if authenticated)
    - IP address
13. **Audit trail** — create `audit_log` table:
    - user_id, action, resource_type, resource_id, timestamp, ip_address
    - Log bug create/update/delete, login/logout, admin actions
14. **Error handling** — create `backend/app/exceptions.py`:
    - Custom exception classes: `NotFoundError`, `ForbiddenError`, `UnauthorizedError`, `ValidationError`
    - Register handlers in `main.py` that return proper JSON error responses
    - Never expose stack traces in production

### ARCHITECTURE GUIDELINES

- **Security is NOT optional** — every endpoint must be protected
- **Supabase Auth handles passwords** — we never store or hash passwords ourselves
- **JWT tokens come from Supabase** — we verify them, not issue them
- **RLS is defense-in-depth** — even if the API has a bug, the database layer blocks unauthorized access
- **Log everything, expose nothing** — audit logs go to the database, stack traces never leave the server
- **Environment variables for all secrets** — no hardcoded keys anywhere
- **Document every security decision** — add comments explaining WHY, not just WHAT

### FOLDER STRUCTURE TO CREATE

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Add middleware, exception handlers
│   ├── auth.py              # JWT verification, get_current_user
│   ├── supabase_client.py   # Supabase client initialization
│   ├── exceptions.py        # Custom exceptions + handlers
│   ├── middleware.py         # Rate limiting, security headers, logging
│   └── routers/
│       ├── __init__.py
│       └── auth.py          # Auth endpoints (signup, login, logout, me)
├── requirements.txt         # Add supabase, slowapi
└── .gitignore

database/
├── schema.sql               # (created by backend dev)
└── rls.sql                  # RLS policies — MY RESPONSIBILITY
```

### IMPORTANT RULES

- Do NOT touch frontend files
- Do NOT implement auth UI — that's the frontend dev's job
- Do NOT commit secrets — only use env vars
- Do NOT use weak hashing — Supabase handles password hashing
- Do NOT allow CORS wildcard in production
- Do NOT expose stack traces in error responses
- JWT verification must check: expiration, issuer, audience
- All auth-related env vars must have placeholder values in `.env.example`
- Document every security decision in code comments
- Create `database/rls.sql` as a separate file — the backend dev creates the base schema

### WHAT TO DO FIRST

1. Create the branch: `git checkout -b feat/security`
2. Read `backend/app/main.py` to understand the existing setup
3. Install additional deps: `pip install supabase slowapi`
4. Plan the auth flow and show me the data flow diagram
5. Start building Phase 1 — Supabase auth integration

Please guide me step by step. Ask me questions if anything is ambiguous.

## END PROMPT
