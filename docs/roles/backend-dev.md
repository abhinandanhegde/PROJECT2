# Backend Developer — AI Prompt

> Copy everything between the START and END markers into your AI tool.

---

## START PROMPT

I am the **Backend Developer** on a 4-person team building a bug-tracking platform (T2 Bug Tracker) inspired by Bugzilla. The project already has a shared skeleton on GitHub. I just cloned it. I need you to guide me through building all backend API features on my `feat/backend` branch.

### EXISTING PROJECT SKELETON

The repo structure I cloned:

```
T2/
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   └── main.py          # FastAPI app with GET /health + CORS
│   └── requirements.txt     # fastapi, uvicorn[standard], pydantic
├── database/
│   └── README.md            # "Schema TBD" — I own database schema design
├── docs/
│   ├── api-contract.md      # Only GET /health documented
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

### TECH STACK (BACKEND)

- Python 3.10+
- FastAPI
- Uvicorn (with --reload for dev)
- Pydantic v2
- Supabase PostgreSQL (direct connection via `supabase-py` or `asyncpg`)

### ENVIRONMENT VARIABLES

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### WHAT I NEED TO BUILD (BACKEND FEATURES)

**Build in this order:**

#### Phase 1 — Database Schema & Connection
1. **Database connection module** — create `backend/app/database.py` using `asyncpg` or `supabase-py` to connect to Supabase PostgreSQL
2. **SQL schema file** — create `database/schema.sql` with tables:
   - `bugs` — id (uuid), title, description, severity (enum: low/medium/high/critical), status (enum: open/in_progress/resolved/closed), assignee_id, reporter_id, created_at, updated_at
   - `users` — id (uuid, references Supabase Auth), email, name, avatar_url, role (admin/member)
   - `comments` — id (uuid), bug_id (FK), author_id, content, created_at
   - `tags` — id (serial), name (unique)
   - `bug_tags` — bug_id (FK), tag_id (FK), composite primary key
   - `attachments` — id (uuid), bug_id (FK), filename, file_url, uploaded_by, created_at
3. **Migration runner** — script in `scripts/` to apply schema

#### Phase 2 — Bug CRUD API
4. **Pydantic models** — create `backend/app/schemas.py` with request/response models:
   - `BugCreate`, `BugUpdate`, `BugResponse`, `BugListResponse`
   - `UserResponse`, `CommentCreate`, `CommentResponse`
5. **Bug endpoints** — create `backend/app/routers/bugs.py`:
   - `GET /bugs` — list bugs with pagination, filtering (status, severity, assignee), sorting
   - `GET /bugs/{id}` — get single bug with comments
   - `POST /bugs` — create bug (validate with Pydantic)
   - `PATCH /bugs/{id}` — update bug (partial updates)
   - `DELETE /bugs/{id}` — soft-delete or hard-delete
6. **Register routers** — update `main.py` to include the bugs router

#### Phase 3 — Comments & Tags
7. **Comment endpoints** — create `backend/app/routers/comments.py`:
   - `POST /bugs/{bug_id}/comments` — add comment
   - `GET /bugs/{bug_id}/comments` — list comments for a bug
   - `DELETE /bugs/{bug_id}/comments/{comment_id}` — delete comment
8. **Tag endpoints** — create `backend/app/routers/tags.py`:
   - `GET /tags` — list all tags
   - `POST /bugs/{bug_id}/tags` — add tags to bug
   - `DELETE /bugs/{bug_id}/tags/{tag_id}` — remove tag from bug

#### Phase 4 — Search & Advanced Features
9. **Search endpoint** — `GET /bugs/search?q=term` — full-text search on title + description using pg_trgm
10. **Dashboard stats endpoint** — `GET /stats` — return counts by status, severity, recent activity
11. **User endpoints** — `GET /users`, `GET /users/{id}` — user profile data

### ARCHITECTURE GUIDELINES

- **Keep routes organized** — one file per resource in `backend/app/routers/`
- **Pydantic models** go in `backend/app/schemas.py` — strict validation, no `Any`
- **Database queries** go in `backend/app/database.py` — use parameterized queries, never string interpolation
- **Use async/await** throughout — FastAPI's async advantage
- **Error handling** — create `backend/app/exceptions.py` with custom exception classes and register handlers in `main.py`
- **CORS is already configured** — don't change it, just add new env vars if needed
- **Swagger auto-docs** — add `response_model` to all endpoints so `/docs` shows proper schemas

### FOLDER STRUCTURE TO CREATE

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Already exists — add router includes
│   ├── database.py          # DB connection + query helpers
│   ├── schemas.py           # Pydantic models for all endpoints
│   ├── exceptions.py        # Custom exceptions + handlers
│   ├── dependencies.py      # FastAPI dependencies (get_db, get_current_user)
│   └── routers/
│       ├── __init__.py
│       ├── bugs.py          # Bug CRUD endpoints
│       ├── comments.py      # Comment endpoints
│       ├── tags.py          # Tag endpoints
│       └── users.py         # User endpoints
├── requirements.txt         # Add asyncpg, python-multipart
└── .gitignore
```

### IMPORTANT RULES

- Do NOT touch any frontend files
- Do NOT install Redis, Celery, or background processing yet
- Do NOT implement actual auth — use a placeholder `get_current_user` dependency that returns a mock user
- Do NOT commit secrets or credentials
- All database queries must be parameterized — NO SQL injection
- Use HTTP status codes correctly: 201 for create, 204 for delete, 404 for not found
- Add proper error responses with meaningful messages
- Every endpoint must have a Pydantic response model for Swagger docs
- Write the SQL schema in `database/schema.sql`, not inline in Python

### WHAT TO DO FIRST

1. Create the branch: `git checkout -b feat/backend`
2. Verify the skeleton works: `cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn app.main:app --reload`
3. Install additional deps: `pip install asyncpg python-multipart`
4. Design the database schema and show me the SQL
5. Start building Phase 1 — database connection and schema

Please guide me step by step. Ask me questions if anything is ambiguous.

## END PROMPT
