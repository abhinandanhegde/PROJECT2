# BugFlow

> A modern developer bug-tracking platform with intelligent triage, deterministic duplicate detection, and role-based security — built in 3 days for CloneFest hackathon.

**Live Demo:** [bugflow.vercel.app](https://bugflow.vercel.app) · **API Docs:** [bugflow-api.up.railway.app/docs](https://bugflow-api.up.railway.app/docs)

---

## What It Does

BugFlow tracks software bugs from report to resolution with a full lifecycle state machine, project-level access control, and AI-free intelligence features.

| Feature | How It Works |
|---------|-------------|
| **Bug Lifecycle** | 7-state machine: NEW → CONFIRMED → IN_PROGRESS → RESOLVED → VERIFIED → CLOSED (+ REOPENED) |
| **Intelligent Triage** | Keyword-based severity/priority suggestion with confidence scoring — no LLM needed |
| **Duplicate Detection** | PostgreSQL pg_trgm trigram similarity + Jaccard fallback — finds similar bugs in <100ms |
| **Risk Analysis** | 7-factor weighted scoring (severity, priority, age, status, reopens, staleness, assignment) |
| **Role-Based Access** | 4-tier project roles: REPORTER → DEVELOPER → QA → ADMIN with RLS enforcement |
| **Full Audit Trail** | Every mutation logged with actor identity, old/new values, timestamps |

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Next.js)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Auth UI  │  │Dashboard │  │ Bug CRUD │  │Search   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬────┘ │
│       └──────────────┴──────────────┴──────────────┘     │
│                          │ Bearer JWT                    │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│                    FastAPI Backend                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │Auth (ES256)│ │Projects │  │   Bugs   │  │Intel.   │ │
│  │JWKS Verify │ │Members  │  │Comments  │  │Triage   │ │
│  └──────────┘  │Components│  │Relations │  │Dupes    │ │
│                 └──────────┘  └──────────┘  │Risk     │ │
│                                              └─────────┘ │
│                          │                               │
│              User-context client (RLS enforced)          │
└──────────────────────────┼──────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────┐
│               Supabase PostgreSQL                        │
│  ┌─────┐ ┌──────┐ ┌─────┐ ┌────────┐ ┌──────────────┐  │
│  │Users│ │Bugs  │ │Rls  │ │pg_trgm │ │activity_log  │  │
│  │     │ │      │ │policies│ │extension│ │(audit trail) │  │
│  └─────┘ └──────┘ └─────┘ └────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 | App Router, server components, type safety |
| Backend | Python 3.10+, FastAPI, Pydantic v2, Uvicorn | Async, auto-docs, validation |
| Database | Supabase PostgreSQL | Managed Postgres + Auth + RLS |
| Auth | Supabase Auth + ES256 JWT | JWKS verification, no custom auth |
| Intelligence | pg_trgm, Python heuristics | Zero AI dependency, deterministic |

## Project Structure

```
T2/
├── frontend/                    # Next.js 15 application
│   ├── src/
│   │   ├── app/                 # App Router pages
│   │   │   ├── (auth)/          # Login, Signup
│   │   │   └── (dashboard)/     # Dashboard, Bugs, Search, etc.
│   │   ├── components/          # Reusable UI components
│   │   ├── lib/                 # API client, auth, types
│   │   └── hooks/               # Custom React hooks
│   └── package.json
│
├── backend/                     # FastAPI application
│   ├── app/
│   │   ├── auth.py              # JWT verification (ES256/RS256)
│   │   ├── dependencies.py      # FastAPI dependency injection
│   │   ├── supabase_client.py   # Service-role + user-context clients
│   │   ├── helpers.py           # Role checking, activity logging
│   │   ├── middleware.py        # Security headers, request ID
│   │   ├── exceptions.py        # Custom error classes
│   │   ├── routers/             # API endpoints (8 routers)
│   │   └── models/              # Pydantic request/response schemas
│   └── requirements.txt
│
├── database/                    # SQL migrations (apply in order)
│   ├── schema.sql               # Tables, enums, indexes
│   ├── rls.sql                  # Row-Level Security policies
│   ├── auth_trigger.sql         # Supabase Auth → users sync
│   ├── audit_function.sql       # log_activity() function
│   └── project_creation.sql     # Atomic project + admin creation
│
├── scripts/
│   └── seed.py                  # Database seeder (5 users, 3 projects, 42 bugs)
│
└── tests/
    └── e2e/                     # Integration tests (23 tests)
```

## Quick Start

### Prerequisites

- Node.js ≥ 18
- Python ≥ 3.10
- Supabase account ([free tier works](https://supabase.com))

### 1. Database Setup

1. Go to [Supabase Dashboard](https://supabase.com/dashboard) → your project → **SQL Editor**
2. Run these files **in order**:
   ```sql
   -- 1. schema.sql
   -- 2. rls.sql
   -- 3. auth_trigger.sql
   -- 4. audit_function.sql
   -- 5. project_creation.sql
   ```

### 2. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EOF

# Start server
uvicorn app.main:app --reload --port 8000
# → http://localhost:8000/docs (Swagger UI)
```

### 3. Frontend

```bash
cd frontend
npm install

# Create .env.local
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

# Start dev server
npm run dev
# → http://localhost:3000
```

### 4. Seed Data (Optional)

```bash
cd backend
python -m scripts.seed
# Creates: 5 users, 3 projects, 42 bugs, comments, relationships, activity
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| **Projects** | | |
| `GET` | `/api/projects` | List user's projects |
| `POST` | `/api/projects` | Create project (auto-adds creator as ADMIN) |
| `GET` | `/api/projects/{id}` | Get project details |
| `PUT` | `/api/projects/{id}` | Update project (ADMIN) |
| `DELETE` | `/api/projects/{id}` | Delete project (ADMIN) |
| `GET` | `/api/projects/{id}/stats` | Project statistics |
| **Bugs** | | |
| `GET` | `/api/projects/{id}/bugs` | List bugs (filter, sort, paginate) |
| `POST` | `/api/projects/{id}/bugs` | Create bug |
| `GET` | `/api/projects/{id}/bugs/{id}` | Get bug details |
| `PUT` | `/api/projects/{id}/bugs/{id}` | Update bug |
| `PATCH` | `/api/projects/{id}/bugs/{id}/status` | Change bug status |
| `PATCH` | `/api/projects/{id}/bugs/{id}/assign` | Assign bug |
| `GET` | `/api/bugs/search?q=...` | Global search |
| **Comments** | | |
| `GET` | `/api/bugs/{id}/comments` | List comments |
| `POST` | `/api/bugs/{id}/comments` | Add comment |
| `PUT` | `/api/bugs/{id}/comments/{id}` | Edit comment |
| `DELETE` | `/api/bugs/{id}/comments/{id}` | Delete comment |
| **Intelligence** | | |
| `POST` | `/api/intelligence/projects/{id}/bugs/triage` | Get triage suggestion |
| `POST` | `/api/intelligence/projects/{id}/bugs/duplicates` | Find duplicate bugs |
| `POST` | `/api/intelligence/projects/{id}/bugs/risk` | Analyze bug risk |
| **Other** | | |
| `GET` | `/api/projects/{id}/members` | List project members |
| `POST` | `/api/projects/{id}/members` | Add member (ADMIN) |
| `GET` | `/api/projects/{id}/components` | List components |
| `GET` | `/api/dashboard/stats` | Dashboard statistics |
| `GET` | `/api/dashboard/recent` | Recent activity |

Full interactive docs at `http://localhost:8000/docs`.

## Security Architecture

### Authentication Flow

```
Browser → Supabase Auth (signup/login) → JWT access token
       → Authorization: Bearer <token> → FastAPI
       → JWKS verification (ES256/RS256) → Authenticated user
       → Supabase client with user's JWT → PostgreSQL RLS enforced
```

### Key Security Features

| Feature | Implementation |
|---------|---------------|
| **JWT Verification** | JWKS-based ES256/RS256 with auto key rotation |
| **Row-Level Security** | Policies on all 11 tables — users can only see their projects |
| **Service-Role Isolation** | Service-role client ONLY for admin ops — never for user requests |
| **Security Headers** | X-Content-Type-Options, X-Frame-Options, Cache-Control: no-store |
| **Request IDs** | Every request gets unique X-Request-ID for tracing |
| **Audit Trail** | SECURITY DEFINER function validates actor_id = auth.uid() |
| **Input Validation** | Pydantic v2 schemas on all endpoints |

### Role Hierarchy

```
REPORTER (least) → DEVELOPER → QA → ADMIN (most)
```

| Action | REPORTER | DEVELOPER | QA | ADMIN |
|--------|----------|-----------|-----|-------|
| View bugs | ✅ | ✅ | ✅ | ✅ |
| Create bugs | ✅ | ✅ | ✅ | ✅ |
| Update own bugs | ✅ | ✅ | ✅ | ✅ |
| Update any bug | ❌ | ✅ | ✅ | ✅ |
| Change status | ❌ | ✅ | ✅ | ✅ |
| Assign bugs | ❌ | ✅ | ✅ | ✅ |
| Manage members | ❌ | ❌ | ❌ | ✅ |
| Delete bugs | ❌ | ❌ | ❌ | ✅ |

## Intelligence Engine

**Zero AI. Zero LLM. Zero external APIs.**

### Triage

Keyword-based severity/priority suggestion with confidence scoring:

```json
POST /api/intelligence/projects/{id}/bugs/triage
{
  "title": "Application crashes on login",
  "description": "Unhandled exception when user session expires...",
  "severity": "BLOCKER",
  "priority": "P1"
}

Response:
{
  "suggested_severity": "BLOCKER",
  "suggested_priority": "P1",
  "confidence": 0.92,
  "reasons": ["Keyword analysis suggests BLOCKER", "Reporter severity ≥ engine suggestion"],
  "signals": ["Detected: crash, data loss, security"]
}
```

### Duplicate Detection

PostgreSQL pg_trgm trigram similarity with Jaccard fallback:

```json
POST /api/intelligence/projects/{id}/bugs/duplicates
{
  "title": "Login page crashes",
  "threshold": 0.3,
  "limit": 5
}

Response:
{
  "candidates": [
    { "bug_id": "...", "title": "App crashes on login", "similarity": 0.87, "match_type": "title_trgm" }
  ]
}
```

### Risk Analysis

7-factor weighted scoring (0-100):

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Severity | 25 | Bug severity level |
| Priority | 15 | Business priority |
| Age | 15 | Days since creation |
| Status Blockage | 15 | Stuck in NEW/CONFIRMED/REOPENED |
| Reopen Count | 15 | How many times reopened |
| Activity Staleness | 10 | Days since last update |
| No Assignee | 5 | Unassigned = higher risk |

## Database Schema

11 tables with proper foreign keys, indexes, and constraints:

| Table | Records | Purpose |
|-------|---------|---------|
| `users` | Synced from Auth | User profiles |
| `projects` | User-created | Bug tracking projects |
| `project_members` | Per-project | Role-based membership |
| `components` | Per-project | Bug categorization |
| `bugs` | Core entity | Bug reports with lifecycle |
| `comments` | Per-bug | Discussion threads |
| `attachments` | Per-bug | File uploads |
| `relationships` | Cross-bug | blocks, depends_on, related_to |
| `activity_log` | Audit trail | Every mutation logged |
| `notifications` | Per-user | Alert system |
| `saved_searches` | Per-user | Custom filters |

## Testing

### Backend Tests — 51 tests, all passing

```bash
cd backend
pytest tests/test_comprehensive.py -v
# Output: 51 passed in 6.08s
```

| Category | Tests | What It Proves |
|----------|-------|----------------|
| Auth Module | 3 | JWT verification, ES256/RS256 support, JWKS caching |
| Bug Lifecycle | 9 | All 7 state machine transitions validated |
| Triage Algorithm | 6 | Keyword matching, severity/priority suggestion |
| Jaccard Similarity | 5 | Duplicate detection math |
| Risk Analysis | 4 | 7-factor weighted scoring (sum=100) |
| Models | 7 | Pydantic validation, enum completeness |
| Exceptions | 6 | All HTTP error codes (401,403,404,409,422) |
| Frontend Types | 3 | Backend enums match frontend TypeScript |
| Supabase Client | 2 | Env validation, error handling |
| App/Middleware | 4 | FastAPI loads, middleware imports |

**Full test documentation:** [docs/TESTS.md](docs/TESTS.md)

### Frontend Verification

```bash
cd frontend
npx tsc --noEmit    # TypeScript: 0 errors
npx next lint        # ESLint: 0 warnings, 0 errors
npm run build        # Build: 15/15 pages generated
```

## Documentation

| Document | Description |
|----------|-------------|
| [docs/TESTS.md](docs/TESTS.md) | Full test documentation with proof of all 51 tests |
| [database/README.md](database/README.md) | Complete schema docs, RLS policies, state machine |
| [docs/api-contract.md](docs/api-contract.md) | API endpoint contracts |
| [docs/architecture.md](docs/architecture.md) | System architecture |

## License

MIT

---

Built with ❤️ for CloneFest hackathon
