# Frontend Developer — AI Prompt

> Copy everything between the START and END markers into your AI tool.

---

## START PROMPT

I am the **Frontend Developer** on a 4-person team building a bug-tracking platform (T2 Bug Tracker) inspired by Bugzilla. The project already has a shared skeleton on GitHub. I just cloned it. I need you to guide me through building all frontend features on my `feat/frontend` branch.

### EXISTING PROJECT SKELETON

The repo structure I cloned:

```
T2/
├── .env.example
├── .gitignore
├── README.md
├── backend/
│   ├── app/main.py          # FastAPI — has GET /health, CORS configured
│   └── requirements.txt
├── database/
│   └── README.md            # "Schema TBD"
├── docs/
│   ├── api-contract.md      # Only GET /health documented so far
│   └── architecture.md      # Browser → Next.js → FastAPI → Supabase PostgreSQL
├── frontend/
│   ├── package.json          # Next.js 15, React 19, Tailwind CSS v4, TypeScript
│   ├── src/app/
│   │   ├── globals.css       # @import "tailwindcss"; CSS variables
│   │   ├── layout.tsx        # Root layout with metadata
│   │   └── page.tsx          # Placeholder: "T2 Bug Tracker"
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── postcss.config.mjs
│   └── eslint.config.mjs
└── scripts/
    └── README.md
```

### TECH STACK (FRONTEND)

- Next.js 15 (App Router)
- React 19
- TypeScript
- Tailwind CSS v4 (uses `@import "tailwindcss"` — no tailwind.config.js)
- ESLint 9 flat config

### ENVIRONMENT VARIABLES

Available via `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### WHAT THE BACKEND PROVIDES

The backend is a FastAPI app at `http://localhost:8000` with:
- `GET /health` → `{"status": "ok"}`
- CORS configured for `localhost:3000`
- Swagger docs at `/docs`
- More endpoints will be added as the team progresses — you should build the frontend to call them.

### WHAT I NEED TO BUILD (FRONTEND FEATURES)

**Do NOT build everything at once. Build in this order:**

#### Phase 1 — Core UI Shell
1. **App layout with navigation sidebar** — persistent sidebar with: Dashboard, Bugs, Search, Settings links
2. **Dashboard page** (`/dashboard`) — placeholder cards showing: Open Bugs, In Progress, Resolved, Total
3. **Bug list page** (`/bugs`) — table/grid showing bugs with columns: ID, Title, Severity, Status, Assignee, Created Date. Empty state when no bugs yet.
4. **Bug detail page** (`/bugs/[id]`) — layout for a single bug: title, description, metadata sidebar, status/assignee controls
5. **Create bug page/form** (`/bugs/new`) — form with: title, description (markdown), severity dropdown, assignee dropdown, tags

#### Phase 2 — Search & Filtering
6. **Global search bar** in the header — searches bugs by title/description
7. **Filter sidebar** on the bug list page — filter by status, severity, assignee, date range
8. **Sort controls** — sort by date, severity, status

#### Phase 3 — Real-time & Polish
9. **Toast notifications** — success/error feedback on actions
10. **Loading states** — skeleton loaders for all data-fetching pages
11. **Responsive design** — mobile-friendly sidebar, table → cards on small screens
12. **Dark mode toggle** — use CSS variables already in globals.css

#### Phase 4 — Supabase Integration
13. **Supabase client setup** — create `src/lib/supabase.ts` with browser client
14. **Auth UI** — login/signup pages (connect to Supabase Auth, no custom auth)
15. **Fetch bugs from Supabase** — replace mock data with real queries
16. **Real-time subscriptions** — Supabase realtime for live bug updates

### ARCHITECTURE GUIDELINES

- **Keep pages in `src/app/`** using App Router conventions
- **Shared components in `src/components/`** (create this folder)
- **Utility/lib code in `src/lib/`** (create this folder)
- **Use Server Components by default**, add `"use client"` only when you need interactivity
- **No state management library yet** — use React state, Context, or URL params. Only add Zustand/Redux if truly needed.
- **API calls** should go through a typed API client in `src/lib/api.ts`
- **Every component should be in its own file** — don't dump everything in page.tsx

### FOLDER STRUCTURE TO CREATE

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/
│   │   └── page.tsx
│   ├── bugs/
│   │   ├── page.tsx           # Bug list
│   │   ├── new/page.tsx       # Create bug form
│   │   └── [id]/page.tsx      # Bug detail
│   ├── layout.tsx             # Update: add sidebar
│   ├── page.tsx               # Redirect to /dashboard or show landing
│   └── globals.css
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── MobileNav.tsx
│   ├── bugs/
│   │   ├── BugTable.tsx
│   │   ├── BugCard.tsx
│   │   ├── BugFilters.tsx
│   │   ├── BugForm.tsx
│   │   └── BugDetail.tsx
│   ├── ui/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Badge.tsx
│   │   ├── Modal.tsx
│   │   ├── Skeleton.tsx
│   │   └── Toast.tsx
│   └── dashboard/
│       └── StatCard.tsx
├── lib/
│   ├── api.ts                  # Typed fetch wrapper for backend
│   ├── supabase.ts             # Supabase client
│   └── types.ts                # Shared TypeScript interfaces
└── hooks/
    └── useDebounce.ts          # For search debounce
```

### IMPORTANT RULES

- Do NOT touch any backend files
- Do NOT install Redux, Zustand, React Query, or any state library unless I confirm it's needed
- Do NOT implement authentication logic — just build the UI shell for it
- Do NOT commit secrets — only use env vars
- Every new page should have a basic loading state
- Use Tailwind CSS v4 — no tailwind.config.js, just utility classes
- TypeScript strict mode is ON — no `any` types

### WHAT TO DO FIRST

1. Create the branch: `git checkout -b feat/frontend`
2. Verify the skeleton works: `cd frontend && npm install && npm run dev`
3. Plan out the components and show me the file structure
4. Start building Phase 1 — the app shell with sidebar navigation

Please guide me step by step. Ask me questions if anything is ambiguous.

## END PROMPT
