# T2 Bug Tracker

A modern developer bug-tracking platform inspired by Bugzilla, built with Next.js, FastAPI, and Supabase PostgreSQL.

## Project Structure

```
T2/
├── frontend/          # Next.js 15 + TypeScript + Tailwind CSS
├── backend/           # Python FastAPI + Uvicorn
├── database/          # Database schema + migrations
├── scripts/           # Seed data, utilities
├── docs/              # Architecture, API contract, and role guides
│   ├── architecture.md
│   ├── api-contract.md
│   └── roles/         # ← AI prompts for each developer role
│       ├── dev1-database-security.md
│       ├── dev2-backend-api.md
│       ├── dev3-frontend-product.md
│       └── dev4-integration-intelligence.md
├── .env.example
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Python ≥ 3.10
- pip
- Supabase account (for database + auth)

## Quick Start

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
# → http://localhost:8000
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. See `.env.example` for the full list.

## Branching Workflow

```bash
git checkout -b feat/security      # Dev 1: Database + Security
git checkout -b feat/backend       # Dev 2: Backend/API
git checkout -b feat/frontend      # Dev 3: Frontend/Product
git checkout -b feat/integration   # Dev 4: Integration + Intelligence
```

- Never push directly to `main`
- Pull/rebase from `main` before starting major work
- Open a PR before merging
- Never commit secrets

## Role Guides (AI Prompts)

Each team member has a copy-paste prompt in `docs/roles/`. Open the file matching your role, copy everything between `## START PROMPT` and `## END PROMPT`, and paste it into your AI tool.

| Role | File | Branch | Owns |
|------|------|--------|------|
| Dev 1: Database + Security | `docs/roles/dev1-database-security.md` | `feat/security` | Schema, RLS, Auth, Audit |
| Dev 2: Backend/API | `docs/roles/dev2-backend-api.md` | `feat/backend` | Endpoints, Business Logic |
| Dev 3: Frontend/Product | `docs/roles/dev3-frontend-product.md` | `feat/frontend` | UI, UX, Product |
| Dev 4: Integration + Intelligence | `docs/roles/dev4-integration-intelligence.md` | `feat/integration` | Triage, Duplicates, Risk, CI |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS v4 |
| Backend | Python 3.10+, FastAPI, Uvicorn, Pydantic v2 |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| Hosting | Vercel (frontend), Railway (backend) |
