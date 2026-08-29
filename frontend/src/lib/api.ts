import { supabase } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
  getProjects: () => authFetch('/api/projects'),
  createProject: (data: Record<string, unknown>) =>
    authFetch('/api/projects', { method: 'POST', body: JSON.stringify(data) }),
  getProject: (projectId: string) => authFetch(`/api/projects/${projectId}`),
  updateProject: (projectId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProject: (projectId: string) =>
    authFetch(`/api/projects/${projectId}`, { method: 'DELETE' }),
  getProjectStats: (projectId: string) => authFetch(`/api/projects/${projectId}/stats`),

  // ── Bugs ──
  getBugs: (projectId: string, params?: Record<string, string | undefined>) => {
    const filtered: Record<string, string> = params ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]) : {}
    const qs = Object.keys(filtered).length ? '?' + new URLSearchParams(filtered).toString() : ''
    return authFetch(`/api/projects/${projectId}/bugs${qs}`)
  },
  createBug: (projectId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/bugs`, { method: 'POST', body: JSON.stringify(data) }),
  getBug: (projectId: string, bugId: string) =>
    authFetch(`/api/projects/${projectId}/bugs/${bugId}`),
  updateBug: (projectId: string, bugId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/bugs/${bugId}`, { method: 'PUT', body: JSON.stringify(data) }),
  changeBugStatus: (projectId: string, bugId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/bugs/${bugId}/status`, { method: 'PATCH', body: JSON.stringify(data) }),
  assignBug: (projectId: string, bugId: string, data: Record<string, unknown>) =>
    authFetch(`/api/projects/${projectId}/bugs/${bugId}/assign`, { method: 'PATCH', body: JSON.stringify(data) }),
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
    authFetch(`/api/bugs/${bugId}/relationships`, { method: 'POST', body: JSON.stringify(data) }),
  deleteRelationship: (bugId: string, relId: string) =>
    authFetch(`/api/bugs/${bugId}/relationships/${relId}`, { method: 'DELETE' }),

  // ── Dashboard ──
  getDashboardStats: () => authFetch('/api/dashboard/stats'),
  getDashboardRecent: (limit?: number) => authFetch(`/api/dashboard/recent${limit ? `?limit=${limit}` : ''}`),
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
  triageBatch: async (bugIds: string[]) => {
    const results = await Promise.allSettled(
      bugIds.map((id) => authFetch(`/api/intelligence/triage/${id}`, { method: 'POST' }))
    )
    return results.map((r, i) => ({
      bug_id: bugIds[i],
      ...(r.status === 'fulfilled' ? r.value : { error: true }),
    }))
  },

  // ── Intelligence ──
  triage: (bugId: string) => authFetch(`/api/intelligence/triage/${bugId}`, { method: 'POST' }),
  // Alias: frontend calls triageBug(projectId, body) — no backend endpoint for pre-creation triage,
  // so this throws to trigger the client-side fallback heuristic.
  triageBug: (_projectId: string, _data: Record<string, unknown>) => {
    return Promise.reject(new Error('No pre-creation triage endpoint — using client fallback'))
  },
  findDuplicates: (bugId: string) => authFetch(`/api/intelligence/duplicates/${bugId}`, { method: 'POST' }),
  riskAnalysis: (bugId: string) => authFetch(`/api/intelligence/risk/${bugId}`, { method: 'POST' }),
  // Alias: frontend calls analyzeRisk(projectId, bugId)
  analyzeRisk: (_projectId: string, bugId: string) => authFetch(`/api/intelligence/risk/${bugId}`, { method: 'POST' }),
}
