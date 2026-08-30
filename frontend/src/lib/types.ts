// ═══════════════════════════════════════════════════════════════
// Enums
// ═══════════════════════════════════════════════════════════════

export type BugStatus = 'NEW' | 'CONFIRMED' | 'IN_PROGRESS' | 'RESOLVED' | 'VERIFIED' | 'CLOSED' | 'REOPENED'
export type BugSeverity = 'BLOCKER' | 'CRITICAL' | 'MAJOR' | 'NORMAL' | 'MINOR' | 'TRIVIAL'
export type BugPriority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
export type BugResolution = 'FIXED' | 'WONT_FIX' | 'DUPLICATE' | 'INVALID'
export type ProjectRole = 'REPORTER' | 'DEVELOPER' | 'QA' | 'ADMIN'

// ═══════════════════════════════════════════════════════════════
// Core Entities
// ═══════════════════════════════════════════════════════════════

export interface User {
  id: string
  email: string
  display_name: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: ProjectRole
  created_at: string
  users?: {
    id: string
    email: string
    display_name: string
  }
}

export interface Component {
  id: string
  project_id: string
  name: string
  description?: string
  created_at: string
}

export interface Bug {
  id: string
  project_id: string
  component_id?: string | null
  title: string
  description: string
  reporter_id: string
  assignee_id?: string | null
  status: BugStatus
  resolution?: BugResolution | null
  severity: BugSeverity
  priority: BugPriority
  duplicate_of?: string | null
  created_at: string
  updated_at: string
  reporter_name?: string
  assignee_name?: string
}

export interface Comment {
  id: string
  bug_id: string
  author_id: string
  body: string
  created_at: string
  updated_at?: string
  author_name?: string
}

export interface Relationship {
  id: string
  source_bug_id: string
  target_bug_id: string
  relationship_type: 'blocks' | 'depends_on' | 'related_to'
  created_by: string
  created_at: string
}

export interface ActivityLog {
  id: string
  project_id: string
  bug_id?: string
  actor_id: string
  actor_name?: string
  action: string
  entity_type: string
  entity_id: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  created_at: string
}

// ═══════════════════════════════════════════════════════════════
// Intelligence
// ═══════════════════════════════════════════════════════════════

export interface TriageResult {
  suggested_severity: BugSeverity
  suggested_priority: BugPriority
  confidence: number
  reasons: string[]
  signals: string[]
}

export interface DuplicateCandidate {
  bug_id: string
  title: string
  status: BugStatus
  severity?: BugSeverity
  priority?: BugPriority
  similarity: number
  match_type: string
}

export interface DuplicateResult {
  candidates: DuplicateCandidate[]
  query_title: string
  checked_at: string
}

export interface RiskFactor {
  name: string
  weight: number
  score: number
  description: string
}

export interface RiskResult {
  risk_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'MINIMAL'
  risk_score: number
  factors: RiskFactor[]
  explanation: string
  bug_id: string
}

// ═══════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════

export interface DashboardStats {
  total_bugs: number
  open_bugs: number
  in_progress: number
  resolved: number
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Display a short version of a bug ID.
 * UUID → "#" + first 8 chars (e.g. "#a1b2c3d4")
 * "BUG-184" → "BUG-184"
 */
export function shortBugId(id: string): string {
  if (id.startsWith('BUG-')) return id
  if (id.length > 8) return `#${id.slice(0, 8)}`
  return `#${id}`
}
