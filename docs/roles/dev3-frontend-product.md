# DEVELOPER 3 — FRONTEND / PRODUCT UI

> Copy everything between START PROMPT and END PROMPT into your AI coding assistant.

---

## START PROMPT

You are the FRONTEND/PRODUCT developer on a 4-person team building "T2 Bug Tracker" — a modern developer bug-tracking platform inspired by Bugzilla. This is a 3-day hackathon.

You own the entire user interface, product experience, and frontend code. You consume the API that Dev 2 (Backend) builds. You do NOT query the database directly. You do NOT implement backend logic.

The product must feel like a serious developer tool — fast, information-dense, keyboard-friendly, and trustworthy. Think Linear, GitHub Issues, and Bugzilla had a modern baby.

### EXISTING PROJECT SKELETON (TREAT AS FIXED)

```
T2/
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
├── backend/                  # Dev 2 owns this — you call it via HTTP
├── database/                 # Dev 1 owns this
├── docs/
├── .env.local                # Contains NEXT_PUBLIC_API_URL=http://localhost:8000
└── README.md
```

### TECH STACK (FRONTEND)

- Next.js 15 (App Router)
- React 19
- TypeScript (strict mode)
- Tailwind CSS v4 (uses `@import "tailwindcss"` — NO tailwind.config.js)
- ESLint 9 flat config

### ENVIRONMENT VARIABLES

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=<from .env.local>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from .env.local>
```

### YOUR EXACT OWNERSHIP

- Application shell (sidebar navigation, header, layout)
- Dashboard page
- Project list and project creation
- Bug list (table with filters, sorting, search)
- Bug creation form
- Bug detail view (metadata, description, status controls)
- Comments UI (add, edit, delete)
- Relationship visualization (dependency graph)
- Assignment UI
- Status/lifecycle controls
- Activity timeline
- Search and filter UX
- Loading states (skeletons), error states, empty states
- Responsive design (mobile-friendly)
- Accessibility (keyboard navigation, ARIA labels)
- Dark mode toggle
- Toast notifications for user feedback
- Visual polish and consistency

### YOUR EXPLICIT NON-OWNERSHIP

- Do NOT query PostgreSQL directly — all domain data goes through `NEXT_PUBLIC_API_URL`
- Do NOT implement backend authorization or authentication logic — use the Supabase browser client directly for signup, login, logout, and session management
- Do NOT implement triage algorithms — display what the API returns
- Do NOT modify `backend/` files
- Do NOT modify `database/` files
- Do NOT install Redux, Zustand, React Query, or any state management library unless you truly need it (prefer React state, Context, URL params)

### SHARED DOMAIN MODEL (YOUR UI MUST REPRESENT THIS)

The API returns data matching these shapes. Your TypeScript types must match exactly.

```typescript
// frontend/src/lib/types.ts

type BugStatus = 'NEW' | 'CONFIRMED' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFIED' | 'CLOSED' | 'REOPENED';
type BugResolution = 'FIXED' | 'WONT_FIX' | 'DUPLICATE' | 'INVALID';
type BugSeverity = 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'NORMAL' | 'MINOR' | 'TRIVIAL';
type BugPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5';
type ProjectRole = 'REPORTER' | 'DEVELOPER' | 'QA' | 'ADMIN';

interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  user?: User;  // joined
}

interface Component {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
}

interface Bug {
  id: string;
  project_id: string;
  component_id: string | null;
  title: string;
  description: string;
  reporter_id: string;
  assignee_id: string | null;
  status: BugStatus;
  resolution: BugResolution | null;
  severity: BugSeverity;
  priority: BugPriority;
  duplicate_of: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields from API
  reporter_name?: string;
  assignee_name?: string;
  component_name?: string;
  comment_count?: number;
}

interface Comment {
  id: string;
  bug_id: string;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  author_name?: string;
}

interface Relationship {
  id: string;
  source_bug_id: string;
  target_bug_id: string;
  relationship_type: 'blocks' | 'depends_on' | 'related_to';
  created_at: string;
}

interface ActivityLog {
  id: string;
  project_id: string;
  bug_id: string | null;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  actor_name?: string;
}

interface Notification {
  id: string;
  user_id: string;
  project_id: string;
  bug_id: string | null;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

interface DashboardStats {
  total_bugs: number;
  by_status: Record<BugStatus, number>;
  by_severity: Record<BugSeverity, number>;
  recent_activity: ActivityLog[];
}
```

### API CLIENT

Create `frontend/src/lib/api.ts` — a typed fetch wrapper:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// The single source of truth for authentication is Supabase Auth.
// This client obtains the current session token from Supabase before each request.
// Do NOT maintain a separate frontend auth state that can drift from Supabase.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Input types (not Partial<Bug> — only fields the user can submit)
interface BugCreateInput {
  title: string;
  description: string;
  component_id?: string | null;
  assignee_id?: string | null;
  severity: BugSeverity;
  priority: BugPriority;
}

interface BugUpdateInput {
  title?: string;
  description?: string;
  component_id?: string | null;
  assignee_id?: string | null;
  status?: BugStatus;
  resolution?: BugResolution | null;
  severity?: BugSeverity;
  priority?: BugPriority;
}

class ApiClient {
  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    // Get the current Supabase session token for every request
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: 'Request failed' }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // Auth (Supabase handles signup/login/logout directly — see auth.ts)
  getMe() { return this.request<User>('GET', '/auth/me'); }

  // Projects
  listProjects() { return this.request<Project[]>('GET', '/projects'); }
  createProject(data: { name: string; description?: string }) { return this.request<Project>('POST', '/projects', data); }
  getProject(id: string) { return this.request<Project>('GET', `/projects/${id}`); }

  // Bugs
  listBugs(projectId: string, params?: Record<string, string>) {
    const query = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<PaginatedResponse<Bug>>('GET', `/projects/${projectId}/bugs${query}`);
  }
  createBug(projectId: string, data: BugCreateInput) { return this.request<Bug>('POST', `/projects/${projectId}/bugs`, data); }
  getBug(id: string) { return this.request<Bug>('GET', `/bugs/${id}`); }
  updateBug(id: string, data: BugUpdateInput) { return this.request<Bug>('PATCH', `/bugs/${id}`, data); }

  // Comments
  listComments(bugId: string) { return this.request<Comment[]>('GET', `/bugs/${bugId}/comments`); }
  addComment(bugId: string, body: string) { return this.request<Comment>('POST', `/bugs/${bugId}/comments`, { body }); }
  updateComment(id: string, body: string) { return this.request<Comment>('PATCH', `/comments/${id}`, { body }); }
  deleteComment(id: string) { return this.request('DELETE', `/comments/${id}`); }

  // Relationships
  listRelationships(bugId: string) { return this.request<Relationship[]>('GET', `/bugs/${bugId}/relationships`); }
  addRelationship(bugId: string, data: { target_bug_id: string; relationship_type: Relationship['relationship_type'] }) {
    return this.request<Relationship>('POST', `/bugs/${bugId}/relationships`, data);
  }
  deleteRelationship(id: string) { return this.request('DELETE', `/relationships/${id}`); }

  // Stats
  getStats(projectId: string) { return this.request<DashboardStats>('GET', `/projects/${projectId}/stats`); }

  // Notifications
  listNotifications() { return this.request<Notification[]>('GET', '/notifications'); }
  markNotificationRead(id: string) { return this.request('PATCH', `/notifications/${id}/read`); }
}

export const api = new ApiClient();
```

### FILE STRUCTURE YOU CREATE

```
frontend/src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx           # Sidebar + header layout
│   │   ├── page.tsx             # Dashboard home (redirects to first project or project list)
│   │   ├── projects/
│   │   │   ├── page.tsx         # Project list
│   │   │   └── new/page.tsx     # Create project form
│   │   └── [projectId]/
│   │       ├── layout.tsx       # Project context provider
│   │       ├── page.tsx         # Dashboard stats for this project
│   │       ├── bugs/
│   │       │   ├── page.tsx     # Bug list with filters
│   │       │   ├── new/page.tsx # Create bug form
│   │       │   └── [bugId]/page.tsx  # Bug detail
│   │       ├── components/page.tsx
│   │       └── settings/page.tsx
│   ├── layout.tsx               # Root layout (update existing)
│   ├── page.tsx                 # Landing/redirect
│   └── globals.css              # (update existing)
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── ProjectSwitcher.tsx
│   ├── bugs/
│   │   ├── BugTable.tsx
│   │   ├── BugFilters.tsx
│   │   ├── BugForm.tsx
│   │   ├── BugDetail.tsx
│   │   ├── StatusBadge.tsx
│   │   ├── SeverityBadge.tsx
│   │   ├── PriorityBadge.tsx
│   │   └── LifecycleActions.tsx   # Status transition buttons
│   ├── comments/
│   │   ├── CommentList.tsx
│   │   ├── CommentForm.tsx
│   │   └── CommentItem.tsx
│   ├── relationships/
│   │   ├── RelationshipList.tsx
│   │   └── DependencyGraph.tsx
│   ├── activity/
│   │   └── ActivityTimeline.tsx
│   ├── dashboard/
│   │   ├── StatCard.tsx
│   │   └── ProjectOverview.tsx
│   └── ui/
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Select.tsx
│       ├── Badge.tsx
│       ├── Modal.tsx
│       ├── Skeleton.tsx
│       ├── Toast.tsx
│       ├── Dropdown.tsx
│       └── Avatar.tsx
├── lib/
│   ├── api.ts                    # API client
│   ├── types.ts                  # TypeScript interfaces
│   ├── auth.ts                   # Supabase Auth helpers
│   ├── supabase.ts               # Supabase client
│   └── utils.ts                  # Helpers (date formatting, etc.)
├── hooks/
│   ├── useAuth.ts                # Auth state hook
│   ├── useBugs.ts                # Bug data fetching
│   └── useDebounce.ts            # Search debounce
└── contexts/
    └── AuthContext.tsx            # Auth provider — thin UI adapter over Supabase Auth (see note below)
```

### AUTH CONTEXT NOTE

`AuthContext` and `useAuth` must be a **thin UI adapter** over Supabase Auth. Do NOT duplicate session state, tokens, or authentication status independently of Supabase. Use Supabase's `onAuthStateChange` and `getSession` as the source of truth. The context simply exposes Supabase's auth state to React components — it is not a second auth system.

### UI DESIGN GUIDELINES

**Color coding (use consistent colors throughout):**

| Severity | Color |
|----------|-------|
| BLOCKER | Red-600 |
| CRITICAL | Red-500 |
| MAJOR | Orange-500 |
| NORMAL | Blue-500 |
| MINOR | Gray-500 |
| TRIVIAL | Gray-400 |

| Priority | Color |
|----------|-------|
| P1 | Red-600 |
| P2 | Orange-500 |
| P3 | Yellow-500 |
| P4 | Blue-500 |
| P5 | Gray-500 |

| Status | Color |
|--------|-------|
| NEW | Blue-500 |
| CONFIRMED | Purple-500 |
| IN_PROGRESS | Yellow-500 |
| RESOLVED | Green-500 |
| VERIFIED | Green-600 |
| CLOSED | Gray-500 |
| REOPENED | Red-500 |

**Layout principles:**
- Sidebar: fixed left, 240px wide, collapsible on mobile
- Content area: scrollable, max-width 1200px centered
- Bug list: dense table with alternating row colors
- Bug detail: two-column layout (main content + sidebar metadata)
- Dashboard: stat cards at top, recent activity feed below
- Use monospace font for bug IDs and technical data

**Keyboard shortcuts:**
- `g` then `d` → go to dashboard
- `g` then `b` → go to bug list
- `c` → create new bug (when on bug list)
- `/` → focus search
- `Esc` → close modals

### IMPLEMENTATION PHASES

#### DAY 1 — App Shell + Core CRUD (CRITICAL PATH)

**Morning:**
1. Create `frontend/src/lib/types.ts` — all TypeScript interfaces
2. Create `frontend/src/lib/api.ts` — typed API client
3. Create `frontend/src/lib/supabase.ts` — Supabase client
4. Create `frontend/src/lib/auth.ts` — auth helpers
5. Create `frontend/src/contexts/AuthContext.tsx` — auth provider
6. Create `frontend/src/app/(auth)/login/page.tsx` — login form
7. Create `frontend/src/app/(auth)/signup/page.tsx` — signup form

**Afternoon:**
8. Create layout with sidebar navigation
9. Create project list page
10. Create project creation form
11. Create bug list page (basic table)
12. Create bug creation form
13. Create bug detail page (basic)
14. Test: full flow from login → project → create bug → view bug (if Dev 2's endpoints aren't ready yet, use fixtures/mock data temporarily — do not block UI work on API availability)

**End of Day 1 verification:**
- Can sign up / log in
- Can create a project
- Can create a bug
- Can view bug list
- Can view bug detail
- Navigation works

#### DAY 2 — Feature Depth

**Morning:**
15. Add status/lifecycle controls to bug detail (transition buttons based on current status)
16. Add comments UI (list, add, delete)
17. Add assignment dropdown (fetch project members from `GET /projects/{id}/members`)
18. Add severity/priority badges with color coding
19. Add filter sidebar to bug list (status, severity, priority, assignee)

**Afternoon:**
20. Add search bar with debounce
21. Add activity timeline to bug detail
22. Add relationships UI (add/remove, list)
23. Add dashboard stats page (stat cards, recent activity)
24. Add notifications dropdown in header

#### DAY 3 — Polish + Responsive

**Morning:**
25. Loading states (skeleton loaders for all data-fetching pages)
26. Error states (friendly error messages, retry buttons)
27. Empty states (illustrations + call-to-action)
28. Responsive design (mobile sidebar, table → cards on small screens)
29. Dark mode toggle (use CSS variables from globals.css)

**Afternoon:**
30. Toast notifications for all user actions
31. Keyboard shortcuts
32. Visual polish (consistent spacing, typography, colors)
33. Accessibility audit (ARIA labels, focus management)
34. Final visual review

### DEPENDENCIES ON OTHER DEVELOPERS

- **Dev 1 (Database/Security)** — Provides JWT verification, authorization, RLS, and security infrastructure. You use the Supabase browser client directly for authentication.
- **Dev 2 (Backend)** — You consume their domain APIs. The only auth-related backend endpoint you may consume is `GET /auth/me` when backend profile data is required. If an endpoint is missing: (1) check the agreed API contract, (2) do not invent a different contract, (3) use a temporary "Coming Soon" state or fixture only for UI development, (4) coordinate with Dev 2 for the real endpoint.
- **Dev 4 (Integration)** — They may provide triage, duplicate-detection, and risk-analysis data through agreed API contracts. Display these results in the UI.

### INTEGRATION RULES

1. ALL domain data comes from `NEXT_PUBLIC_API_URL` — never from Supabase directly
2. Supabase Auth is the single source of truth for authentication — use it directly for signup, login, logout, and session management. Do NOT create a second frontend auth state that can drift from Supabase.
3. If the API returns an error, show it in the UI — don't silently fail
4. If an API endpoint doesn't exist yet, show a "Coming Soon" placeholder — don't invent data
5. Use the exact TypeScript types from the shared domain model
6. Announce UI changes that affect the API contract

### TESTING EXPECTATIONS

- Full flow works: login → create project → create bug → view bug → change status → add comment
- All loading states show skeletons
- All error states show friendly messages
- All empty states show helpful guidance
- Navigation works on mobile
- Dark mode toggle works
- Keyboard shortcuts work
- No console errors

### DEFINITION OF DONE

- [ ] Login/signup works with Supabase Auth
- [ ] Project list and creation work
- [ ] Bug list with filters and search works
- [ ] Bug creation works
- [ ] Bug detail shows all metadata
- [ ] Status transitions work with correct available actions
- [ ] Comments work (add, list, edit, delete)
- [ ] Relationships display correctly
- [ ] Activity timeline shows audit log
- [ ] Dashboard shows stats
- [ ] All loading/error/empty states handled
- [ ] Responsive design works
- [ ] No console errors

### FIRST ACTIONS (DO THESE NOW)

1. `git checkout -b feat/frontend`
2. `cd frontend && npm install && npm run dev` — verify it works
3. Create `frontend/src/lib/types.ts` with all TypeScript interfaces
4. Create `frontend/src/lib/api.ts` with the typed API client
5. Create `frontend/src/lib/supabase.ts` with Supabase client
6. Start building the auth pages

## END PROMPT
