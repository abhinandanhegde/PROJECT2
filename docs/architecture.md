# T2 Bug Tracker — Architecture

## High-Level Overview

```
Browser
  ↓
Next.js (Frontend — Vercel)
  ↓
FastAPI (Backend — Railway)
  ↓
Supabase PostgreSQL
```

## Layers

| Layer | Technology | Hosting | Purpose |
|-------|-----------|---------|---------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS | Vercel | User interface |
| Backend | Python, FastAPI, Uvicorn | Railway | API layer |
| Database | Supabase PostgreSQL | Supabase | Data storage |

## Future Layers (not yet implemented)

- **PostgreSQL Row-Level Security (RLS)** — fine-grained access control at the database level
- **pg_trgm** — trigram-based fuzzy search for bug titles/descriptions
- **pgvector** — optional vector embeddings for AI-powered search
- **Background processing** — optional async task queue (e.g., Celery, Redis)

## Principles

- Keep the stack boring and proven
- Each developer works on a feature branch; merge via PR
- The backend is stateless; all state lives in the database
- Environment-specific config goes through environment variables, never hardcoded
