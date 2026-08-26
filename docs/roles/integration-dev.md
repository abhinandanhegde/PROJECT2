# Integration Developer — AI Prompt

> Copy everything between the START and END markers into your AI tool.

---

## START PROMPT

I am the **Integration Developer** on a 4-person team building a bug-tracking platform (T2 Bug Tracker) inspired by Bugzilla. The project already has a shared skeleton on GitHub. I just cloned it. I need you to guide me through building integration, testing, AI features, and deployment on my `feat/integration` branch.

### EXISTING PROJECT SKELETON

```
T2/
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── app/main.py          # FastAPI — GET /health, CORS configured
│   └── requirements.txt     # fastapi, uvicorn, pydantic
├── database/
│   └── README.md            # "Schema TBD"
├── docs/
│   ├── api-contract.md      # Only GET /health
│   └── architecture.md      # Browser → Next.js → FastAPI → Supabase PostgreSQL
├── frontend/
│   └── (Next.js 15 skeleton)
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
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

### WHAT THE TEAM IS BUILDING

| Developer | Branch | Responsibility |
|-----------|--------|----------------|
| Frontend | `feat/frontend` | UI: bug list, detail, create, search, dashboard |
| Backend | `feat/backend` | API: CRUD endpoints, database schema, Pydantic models |
| Security | `feat/security` | Auth, RLS, rate limiting, security headers, audit |
| **Me (Integration)** | `feat/integration` | **Testing, AI features, CI/CD, deployment, documentation** |

### WHAT I NEED TO BUILD (INTEGRATION FEATURES)

**Build in this order:**

#### Phase 1 — Testing Infrastructure
1. **Backend tests** — create `backend/tests/`:
   - `conftest.py` — pytest fixtures (test client, mock database, test user)
   - `test_health.py` — test GET /health
   - `test_bugs.py` — test all bug CRUD endpoints (once backend dev adds them)
   - `test_auth.py` — test auth endpoints (once security dev adds them)
   - Use `pytest` + `httpx` for async testing
   - Aim for: endpoints validate input, return correct status codes, handle errors
2. **Frontend tests** — create `frontend/src/__tests__/`:
   - Use Vitest + React Testing Library
   - Test component rendering (sidebar, bug list, bug form)
   - Test page navigation
   - Test form validation
3. **Test configuration**:
   - `backend/pytest.ini` — configure pytest
   - `frontend/vitest.config.ts` — configure Vitest
   - `frontend/jest.config.js` — NOT jest, we use Vitest

#### Phase 2 — AI-Powered Features
4. **AI bug summarization endpoint** — `POST /ai/summarize`:
   - Accepts a bug description (long text)
   - Returns a concise 2-3 sentence summary
   - Use OpenAI API or any LLM API — make it configurable via env vars
5. **AI bug classification** — `POST /ai/classify`:
   - Accepts bug title + description
   - Returns suggested severity level and component/category
   - Returns confidence score
6. **AI duplicate detection** — `POST /ai/duplicates`:
   - Accepts a new bug's title + description
   - Searches existing bugs using pg_trgm similarity
   - Returns top 3 potential duplicates with similarity scores
7. **AI service module** — create `backend/app/ai.py`:
   - Abstract the LLM provider (OpenAI, Anthropic, etc.)
   - Make it pluggable — different providers via config
   - Handle rate limits, retries, and errors gracefully
   - Cache responses where appropriate

#### Phase 3 — CI/CD Pipeline
8. **GitHub Actions workflow** — create `.github/workflows/ci.yml`:
   - Trigger on PR to main and push to main
   - Jobs:
     - **lint**: ESLint (frontend) + ruff (backend)
     - **typecheck**: TypeScript (frontend) + mypy (backend)
     - **test**: pytest (backend) + vitest (frontend)
     - **build**: verify both build successfully
   - Cache npm and pip dependencies
   - Run on Ubuntu latest
9. **Deployment config** — create deployment configs:
   - `vercel.json` — frontend deployment settings
   - `railway.json` or `Procfile` — backend deployment settings
   - Document environment variables needed for each platform

#### Phase 4 — Documentation & Polish
10. **API documentation** — update `docs/api-contract.md` with ALL endpoints
11. **Developer onboarding guide** — update `README.md` with:
    - Complete setup instructions
    - Environment variable documentation
    - Branching strategy
    - Testing instructions
    - Deployment guide
12. **Database seed script** — create `scripts/seed.py`:
    - Generate realistic test data (bugs, users, comments)
    - Use `Faker` library for fake data
    - Option to reset and re-seed the database
13. **Performance testing** — create `scripts/load_test.py`:
    - Use `locust` or `httpx` for load testing
    - Test critical endpoints under concurrent load
    - Generate performance report

### ARCHITECTURE GUIDELINES

- **Tests run in CI** — every PR must pass tests before merge
- **AI features are optional** — the app works without them, AI enhances it
- **AI calls are server-side only** — never expose API keys to the frontend
- **Test against real Supabase** in CI, mock in local dev
- **Deployment must be automated** — no manual deploys for main branch
- **Documentation is living** — update docs as features are added

### FOLDER STRUCTURE TO CREATE

```
T2/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_health.py
│   │   ├── test_bugs.py
│   │   └── test_auth.py
│   ├── app/
│   │   └── ai.py              # AI service module
│   └── pytest.ini
├── frontend/
│   ├── vitest.config.ts
│   └── src/__tests__/
│       ├── components/
│       │   └── Sidebar.test.tsx
│       └── pages/
│           └── Dashboard.test.tsx
├── scripts/
│   ├── seed.py                 # Database seeder
│   └── load_test.py            # Performance testing
├── vercel.json                 # Frontend deployment
└── Procfile                    # Backend deployment (Railway)
```

### IMPORTANT RULES

- Do NOT build UI features — that's the frontend dev's job
- Do NOT build API CRUD — that's the backend dev's job
- Do NOT implement auth logic — that's the security dev's job
- Do NOT commit API keys — only use env vars
- AI API keys go in `.env` — never in code
- All tests must be runnable without external services (mock what you need)
- CI pipeline must be green before any merge to main
- Keep deployment configs simple — no over-engineering

### ENVIRONMENT VARIABLES FOR AI

Add to `.env.example`:
```
# --- AI (Integration Dev) ---
AI_PROVIDER=openai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
```

### WHAT TO DO FIRST

1. Create the branch: `git checkout -b feat/integration`
2. Read all existing files to understand the project structure
3. Set up testing infrastructure (pytest + vitest configs)
4. Write the first test (test_health.py) and verify it passes
5. Set up the GitHub Actions CI pipeline
6. Start building Phase 2 — AI features

Please guide me step by step. Ask me questions if anything is ambiguous.

## END PROMPT
