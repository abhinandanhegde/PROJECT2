# Contributing to BugFlow

## Team Roles

| Role | Responsibility | Branch |
|------|---------------|--------|
| Dev 1 | Security / Auth / RLS | `feat/security` |
| Dev 2 | Backend API / Routers | `feat/backend` |
| Dev 3 | Frontend / UI / UX | `feat/frontend` |
| Dev 4 | Intelligence / Testing / Integration | `feat/integration` |

## Branch Workflow

1. **Always start from `main`**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/your-feature
   ```

2. **Work only on your branch** — never commit directly to `main`

3. **Keep your branch updated**
   ```bash
   git fetch origin
   git merge origin/main
   ```

4. **Push and create a PR**
   ```bash
   git push -u origin feat/your-feature
   ```
   Create PR: `feat/your-feature → main`

5. **Get approval before merging** — at least one team member reviews

## Commit Messages

Use conventional commits:

```
feat: add dark mode toggle
fix: resolve comment edit 500 error
docs: update README rubric map
test: add 20 endpoint behavior tests
refactor: extract BugTable component
```

## Code Standards

### Backend (Python)
- Format: Black
- Lint: Ruff (if available)
- Tests: pytest
- Type hints on all public functions

### Frontend (TypeScript)
- Format: Prettier (if available)
- Lint: ESLint (next lint)
- Tests: none configured (add if time permits)
- No `any` types, no `@ts-ignore`

## Environment Variables

### Backend (`backend/.env`)
```
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CORS_ORIGINS=http://localhost:3000
ALLOW_DEMO_SETUP=true
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Never commit `.env` or `.env.local` — they're in `.gitignore`.**

## Database Changes

If you modify `database/schema.sql` or `database/rls.sql`:

1. Update the corresponding file
2. Test locally against your Supabase project
3. Document the change in the PR description
4. Apply to production via Supabase SQL Editor

## Testing

Before pushing:

```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend
cd frontend && npx tsc --noEmit && npx next lint && npm run build
```

All 100 backend tests must pass. Zero TypeScript errors. Zero lint warnings.
