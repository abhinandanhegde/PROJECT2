import { supabase } from './supabase'
import { API_URL } from './config'

// Tiny client-side cache so frequently revisited views (graph, projects)
// render instantly instead of re-fetching on every navigation. Mutations
// that affect a resource invalidate its entry.
const cache = new Map<string, { at: number; value: unknown }>()
const CACHE_TTL_MS = 30_000

function cached(path: string) {
  const hit = cache.get(path)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.value)
  return authFetch(path).then((v) => {
    cache.set(path, { at: Date.now(), value: v })
    return v
  })
}

export function invalidateCache(pathPrefix?: string) {
  if (!pathPrefix) {
    cache.clear()
    return
  }
  for (const key of Array.from(cache.keys())) {
    if (key.startsWith(pathPrefix)) cache.delete(key)
  }
}

async function authFetch(path: string, options?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${res.status}: ${body}`)
  }
  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // ── Projects ──
  getProjects: () => cached('/api/projects'),
  createProject: (data: Record<string, unknown>) =>
    authFetch('/api/projects', { method: 'POST', body: JSON.stringify(data) })
      .then((v) => { invalidateCache('/api/projects'); return v }),
  getProject: (projectId: string) => authFetch(`/api/projects/${projectId}`),
  updateProject: (projectId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(data) })
      .then((v) => { invalidateCache('/api/projects'); return v }),
  deleteProject: (projectId: string) =>
    authFetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      .then((v) => { invalidateCache('/api/projects'); return v }),
  getProjectStats: (projectId: string) => authFetch(`/api/projects/${projectId}/stats`),

  // ── Bugs ──
  getBugs: (projectId: string, params?: Record<string, string | undefined>) => {
    const filtered: Record<string, string> = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]) : {}
    const qs = Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : ''
    return authFetch(`/api/projects/${projectId}/bugs${qs}`)
  },
  createBug: (projectId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/bugs`, { method: 'POST', body: JSON.stringify(data) })
      .then((v) => { invalidateCache('/api/graph'); invalidateCache('/api/dashboard'); return v }),
  getBug: (projectId: string, bugId: string) =>
    authFetch(`/api/projects/${projectId}/bugs/${bugId}`),
  updateBug: (projectId: string, bugId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/bugs/${bugId}`, { method: 'PUT', body: JSON.stringify(data) })
      .then((v) => { invalidateCache('/api/graph'); invalidateCache('/api/dashboard'); return v }),
  changeBugStatus: (projectId: string, bugId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/bugs/${bugId}/status`, { method: 'PATCH', body: JSON.stringify(data) })
      .then((v) => { invalidateCache('/api/graph'); invalidateCache('/api/dashboard'); return v }),
  assignBug: (projectId: string, bugId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/bugs/${bugId}/assign`, { method: 'PATCH', body: JSON.stringify(data) })
      .then((v) => { invalidateCache('/api/graph'); invalidateCache('/api/dashboard'); return v }),
  searchBugs: (query: string) => authFetch(`/api/bugs/search?q=${encodeURIComponent(query)}`),

  // ── Comments ──
  getComments: (bugId: string) => authFetch(`/api/bugs/${bugId}/comments`),
  addComment: (bugId: string, data: Record<string, unknown>) =>
    authFetch(`/api/bugs/${bugId}/comments`, { method: 'POST', body: JSON.stringify(data) }),
  updateComment: (bugId: string, commentId: string, data: Record<string, unknown>) =>
    authFetch(`/api/bugs/${bugId}/comments/${commentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComment: (bugId: string, commentId: string) =>
    authFetch(`/api/bugs/${bugId}/comments/${commentId}`, { method: 'DELETE' }),

  // ── Components ──
  getComponents: (projectId: string) => authFetch(`/api/projects/${projectId}/components`),
  createComponent: (projectId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/components`, { method: 'POST', body: JSON.stringify(data) }),
  updateComponent: (projectId: string, componentId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/components/${componentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteComponent: (projectId: string, componentId: string) =>
    authFetch(`/api/projects/${projectId}/components/${componentId}`, { method: 'DELETE' }),

  // ── Members ──
  getMembers: (projectId: string) => authFetch(`/api/projects/${projectId}/members`),
  addMember: (projectId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/members`, { method: 'POST', body: JSON.stringify(data) }),
  updateMember: (projectId: string, memberId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/members/${memberId}`, { method: 'PUT', body: JSON.stringify(data) }),
  removeMember: (projectId: string, memberId: string) =>
    authFetch(`/api/projects/${projectId}/members/${memberId}`, { method: 'DELETE' }),

  // ── Relationships ──
  getRelationships: (bugId: string) => authFetch(`/api/bugs/${bugId}/relationships`),
  addRelationship: (bugId: string, data: Record<string, unknown>) =>
    authFetch(`/api/bugs/${bugId}/relationships`, { method: 'POST', body: JSON.stringify(data) })
      .then((v) => { invalidateCache('/api/graph'); return v }),
  deleteRelationship: (bugId: string, relId: string) =>
    authFetch(`/api/bugs/${bugId}/relationships/${relId}`, { method: 'DELETE' })
      .then((v) => { invalidateCache('/api/graph'); return v }),

  // ── Graph (single round trip: all visible nodes + edges) ──
  getGraph: () => cached('/api/graph'),

  // ── Dashboard ──
  getDashboardStats: () => authFetch('/api/dashboard/stats'),
  getDashboardRecent: (limit?: number) => authFetch(`/api/dashboard/recent${limit ? `?limit=${limit}` : ''}`),
  getActivityBreakdown: () => authFetch('/api/dashboard/activity-breakdown'),
  getDashboardAssigned: (params?: { status?: string; page?: number; per_page?: number }) => {
    const filtered: Record<string, string> = params ? Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
    ) : {}
    const qs = Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : ''
    return authFetch(`/api/dashboard/assigned${qs}`)
  },

  // ── Activity Log (per bug, filtered client-side from dashboard/recent) ──
  getBugActivity: async (bugId: string) => {
    const res = await authFetch('/api/dashboard/recent?limit=100')
    const entries = (res?.data || []).filter((e: Record<string, unknown>) => e.bug_id === bugId)
    return { data: entries }
  },

  // ── Triage for multiple bugs (batch) ──
  triageBatch: async (projectId: string, bugs: { id: string; title: string; description?: string; severity?: string; priority?: string }[]) => {
    const results = await Promise.allSettled(
      bugs.map((b) => authFetch(`/api/intelligence/projects/${projectId}/bugs/triage`, {
        method: 'POST',
        body: JSON.stringify({ title: b.title, description: b.description, severity: b.severity, priority: b.priority }),
      }))
    )
    return results.map((r, i) => ({
      bug_id: bugs[i].id,
      ...(r.status === 'fulfilled' ? r.value : { error: true }),
    }))
  },

  // ── Intelligence ──
  // Triage: analyze a bug's title/description to suggest severity/priority
  triage: (projectId: string, body: { title: string; description?: string; severity?: string; priority?: string; component?: string; status?: string }) =>
    authFetch(`/api/intelligence/projects/${projectId}/bugs/triage`, { method: 'POST', body: JSON.stringify(body) }),
  // Alias: frontend calls triageBug(projectId, body) — same as triage
  triageBug: (projectId: string, body: Record<string, unknown>) =>
    authFetch(`/api/intelligence/projects/${projectId}/bugs/triage`, { method: 'POST', body: JSON.stringify(body) }),
  // Duplicate detection: find similar bugs using pg_trgm / Jaccard
  findDuplicates: (projectId: string, body: { title: string; description?: string; threshold?: number; limit?: number }) =>
    authFetch(`/api/intelligence/projects/${projectId}/bugs/duplicates`, { method: 'POST', body: JSON.stringify(body) }),
  // Risk analysis: compute weighted risk score for a specific bug
  riskAnalysis: (projectId: string, bugId: string) =>
    authFetch(`/api/intelligence/projects/${projectId}/bugs/risk`, { method: 'POST', body: JSON.stringify({ bug_id: bugId }) }),
  // Alias: frontend calls analyzeRisk(projectId, bugId) — same as riskAnalysis
  analyzeRisk: (projectId: string, bugId: string) =>
    authFetch(`/api/intelligence/projects/${projectId}/bugs/risk`, { method: 'POST', body: JSON.stringify({ bug_id: bugId }) }),

  // ── Auth ──
  getMe: () => authFetch('/api/auth/me'),
}
