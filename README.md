# T2 Bug Tracker

A modern developer bug-tracking platform inspired by Bugzilla, built with Next.js, FastAPI, and Supabase PostgreSQL.

## Project Structure

```
T2/
├── frontend/          # Next.js 15 + TypeScript + Tailwind CSS
├── backend/           # Python FastAPI + Uvicorn
├── database/          # Database schema (TBD)
├── scripts/           # Utility scripts
├── docs/              # Architecture, API contract, and role guides
│   ├── architecture.md
│   ├── api-contract.md
│   └── roles/         # ← AI prompts for each developer role
│       ├── frontend-dev.md
│       ├── backend-dev.md
│       ├── security-dev.md
│       └── integration-dev.md
├── .env.example
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js ≥ 18
- npm ≥ 9
- Python ≥ 3.10
- pip

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
git checkout -b feat/frontend
git checkout -b feat/backend
git checkout -b feat/security
git checkout -b feat/integration
```

- Never push directly to `main`
- Pull/rebase from `main` before starting major work
- Open a PR before merging
- Never commit secrets

## Role Guides (AI Prompts)

Each team member has a copy-paste prompt in `docs/roles/`. Open the file matching your role, copy everything between `## START PROMPT` and `## END PROMPT`, and paste it into your AI tool. It gives the AI full context about the project and your specific responsibilities.

| Role | File | Branch |
|------|------|--------|
| Frontend | `docs/roles/frontend-dev.md` | `feat/frontend` |
| Backend | `docs/roles/backend-dev.md` | `feat/backend` |
| Security | `docs/roles/security-dev.md` | `feat/security` |
| Integration | `docs/roles/integration-dev.md` | `feat/integration` |
