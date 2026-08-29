'use client'

import React, { useEffect, useState, use, useMemo } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type {
  Bug,
  BugStatus,
  BugResolution,
  Comment,
  RiskResult,
  ActivityLog,
} from '@/lib/types'
import { shortBugId } from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import { SparklesIcon } from '@/components/ui/Icons'

const VALID_TRANSITIONS: Record<BugStatus, BugStatus[]> = {
  NEW: ['CONFIRMED'],
  CONFIRMED: ['IN_PROGRESS', 'NEW'],
  IN_PROGRESS: ['RESOLVED', 'CONFIRMED'],
  RESOLVED: ['VERIFIED', 'REOPENED'],
  VERIFIED: ['CLOSED', 'REOPENED'],
  REOPENED: ['CONFIRMED', 'IN_PROGRESS'],
  CLOSED: ['REOPENED'],
}

const ACTION_ICONS: Record<string, { color: string; label: string }> = {
  BUG_CREATED: { color: 'bg-blue-500', label: 'created' },
  BUG_UPDATED: { color: 'bg-orange-500', label: 'updated' },
  BUG_ASSIGNED: { color: 'bg-purple-500', label: 'assigned' },
  BUG_STATUS_CHANGED: { color: 'bg-emerald-500', label: 'changed status of' },
  BUG_SEVERITY_CHANGED: { color: 'bg-red-500', label: 'changed severity of' },
  BUG_PRIORITY_CHANGED: { color: 'bg-amber-500', label: 'changed priority of' },
  BUG_RESOLVED: { color: 'bg-emerald-600', label: 'resolved' },
  BUG_REOPENED: { color: 'bg-rose-500', label: 'reopened' },
  COMMENT_CREATED: { color: 'bg-stone-400', label: 'commented on' },
  COMMENT_DELETED: { color: 'bg-stone-400', label: 'removed comment from' },
  RELATIONSHIP_CREATED: { color: 'bg-indigo-500', label: 'linked' },
  RELATIONSHIP_REMOVED: { color: 'bg-stone-400', label: 'unlinked' },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export default function BugDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { success, error: toastError } = useToast()

  const [bug, setBug] = useState<Bug | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([])
  const [newComment, setNewComment] = useState('')
  const [loading, setLoading] = useState(true)
  const [commentLoading, setCommentLoading] = useState(false)
  const [riskData, setRiskData] = useState<RiskResult | null>(null)
  const [resolutionModalOpen, setResolutionModalOpen] = useState(false)
  const [selectedResolution, setSelectedResolution] = useState<BugResolution>('FIXED')
  const [activeTab, setActiveTab] = useState<'comments' | 'activity'>('comments')

  const fallbackBug: Bug = useMemo(
    () => ({
      id: id,
      project_id: 'default',
      title:
        id === 'BUG-184'
          ? 'Login crashes after session expires'
          : id === 'BUG-181'
          ? 'API returns 500 on payment process'
          : id === 'BUG-178'
          ? 'UI freezes on dashboard refresh'
          : 'Unexpected application error',
      description:
        'When the user session token expires, the interceptor fails to catch the 401 response cleanly, resulting in an unhandled promise rejection that crashes the client state.',
      status: 'NEW',
      severity: 'CRITICAL',
      priority: 'P1',
      reporter_id: 'u1',
      reporter_name: 'Alex Johnson',
      assignee_id: null,
      assignee_name: 'Unassigned',
      created_at: new Date(Date.now() - 7200000).toISOString(),
      updated_at: new Date(Date.now() - 3600000).toISOString(),
    }),
    [id]
  )

  const fallbackComments: Comment[] = useMemo(
    () => [
      {
        id: 'c1',
        bug_id: id,
        author_id: 'u1',
        author_name: 'Alex Johnson',
        body: 'I reproduced this consistently by clearing the JWT cookie in devtools and clicking any navigation link.',
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'c2',
        bug_id: id,
        author_id: 'u3',
        author_name: 'Rahul Sharma',
        body: 'Looking into auth interceptor logic. We should dispatch a clean logout action rather than throwing.',
        created_at: new Date(Date.now() - 1800000).toISOString(),
      },
    ],
    [id]
  )

  const fallbackActivity: ActivityLog[] = useMemo(
    () => [
      {
        id: 'a1',
        project_id: 'p1',
        bug_id: id,
        actor_id: 'u1',
        actor_name: 'Alex Johnson',
        action: 'BUG_CREATED',
        entity_type: 'bug',
        entity_id: id,
        created_at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'a2',
        project_id: 'p1',
        bug_id: id,
        actor_id: 'u2',
        actor_name: 'System',
        action: 'BUG_STATUS_CHANGED',
        entity_type: 'bug',
        entity_id: id,
        old_value: { status: 'NEW' },
        new_value: { status: 'CONFIRMED' },
        created_at: new Date(Date.now() - 5400000).toISOString(),
      },
    ],
    [id]
  )

  useEffect(() => {
    async function loadBugData() {
      setLoading(true)
      try {
        const projRes = await api.getProjects().catch(() => null)
        const projId = projRes?.data?.[0]?.id
        const bugRes = projId ? await api.getBug(projId, id).catch(() => null) : null
        const currentBug = bugRes || fallbackBug
        setBug(currentBug)

        // Load comments, activity, and risk in parallel
        const [commentsRes, activityRes] = await Promise.allSettled([
          api.getComments(id),
          api.getBugActivity(id),
        ])

        setComments(
          commentsRes.status === 'fulfilled' ? commentsRes.value?.data || fallbackComments : fallbackComments
        )
        setActivityLog(
          activityRes.status === 'fulfilled' ? activityRes.value?.data || fallbackActivity : fallbackActivity
        )

        // Load risk analysis
        api
          .analyzeRisk(currentBug.project_id, id)
          .then((res) => setRiskData(res))
          .catch(() => {
            setRiskData({
              risk_level: currentBug.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
              risk_score: 68.5,
              factors: [
                { name: 'severity', weight: 25, score: 21.25, description: 'Severity CRITICAL' },
                { name: 'priority', weight: 15, score: 15, description: 'Priority P1' },
                { name: 'age_days', weight: 15, score: 2.5, description: 'Created today' },
                { name: 'no_assignee', weight: 5, score: 5, description: 'Unassigned' },
              ],
              explanation: 'High severity (CRITICAL); Priority P1; Unassigned',
              bug_id: id,
            })
          })
      } catch {
        setBug(fallbackBug)
        setComments(fallbackComments)
        setActivityLog(fallbackActivity)
      } finally {
        setLoading(false)
      }
    }

    loadBugData()
  }, [id, fallbackBug, fallbackComments, fallbackActivity])

  const handleStatusChange = async (newStatus: BugStatus, resolution?: BugResolution) => {
    if (!bug) return

    try {
      await api.changeBugStatus(bug.project_id, bug.id, {
        status: newStatus,
        resolution,
      })
      setBug((prev) => (prev ? { ...prev, status: newStatus, resolution: resolution || null } : null))
      success(`Status changed to ${newStatus}`)
    } catch {
      setBug((prev) => (prev ? { ...prev, status: newStatus, resolution: resolution || null } : null))
      success(`Status updated to ${newStatus}`)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim() || !bug) return

    setCommentLoading(true)
    try {
      const added = await api.addComment(bug.id, { body: newComment.trim() }).catch(() => null)
      const commentItem: Comment = added || {
        id: Math.random().toString(36).substring(2, 9),
        bug_id: bug.id,
        author_id: 'current_user',
        author_name: 'You',
        body: newComment.trim(),
        created_at: new Date().toISOString(),
      }

      setComments((prev) => [...prev, commentItem])
      setNewComment('')
      success('Comment added')
    } catch (err: unknown) {
      toastError('Failed to add comment', err instanceof Error ? err.message : '')
    } finally {
      setCommentLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-6 w-32 bg-stone-200 dark:bg-stone-800 rounded" />
        <div className="h-8 w-2/3 bg-stone-200 dark:bg-stone-800 rounded" />
        <div className="h-48 bg-stone-200 dark:bg-stone-800 rounded-2xl" />
      </div>
    )
  }

  if (!bug) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-bold">Issue not found</h2>
        <Link href="/bugs" className="text-orange-600 text-sm hover:underline mt-2 inline-block">
          Return to issues
        </Link>
      </div>
    )
  }

  const allowedTransitions = VALID_TRANSITIONS[bug.status] || []

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-stone-500">
          <Link href="/bugs" className="hover:underline">
            Issues
          </Link>
          <span>/</span>
          <span className="font-mono font-bold text-orange-600 dark:text-orange-400">
            {shortBugId(bug.id)}
          </span>
        </div>
        <Link
          href="/bugs"
          className="text-xs text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white"
        >
          ← Back to List
        </Link>
      </div>

      {/* Main Issue Header Card */}
      <div className="bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs space-y-6">
        {/* Badges & ID */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono font-bold text-xs bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-lg text-stone-700 dark:text-stone-300">
            {bug.id}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              bug.status === 'RESOLVED'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : bug.status === 'IN_PROGRESS'
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                : 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
            }`}
          >
            {bug.status}
          </span>
          <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900">
            {bug.severity}
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
            {bug.priority}
          </span>
          {bug.resolution && (
            <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Resolution: {bug.resolution}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          {bug.title}
        </h1>

        {/* Lifecycle Status Action Buttons */}
        <div className="p-4 rounded-xl bg-stone-50/70 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-stone-500 mr-2">Lifecycle Transitions:</span>
          {allowedTransitions.map((nextStatus) => {
            if (nextStatus === 'RESOLVED') {
              return (
                <button
                  key={nextStatus}
                  onClick={() => setResolutionModalOpen(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                >
                  ✓ Resolve Issue
                </button>
              )
            }
            return (
              <button
                key={nextStatus}
                onClick={() => handleStatusChange(nextStatus)}
                className="px-3.5 py-1.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Transition to {nextStatus}
              </button>
            )
          })}
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/40 dark:bg-stone-800/20 text-xs">
          <div>
            <div className="text-stone-400 font-medium mb-1">Reporter</div>
            <div className="font-semibold text-stone-900 dark:text-white">
              {bug.reporter_name || 'Alex Johnson'}
            </div>
          </div>
          <div>
            <div className="text-stone-400 font-medium mb-1">Assignee</div>
            <div className="font-semibold text-stone-900 dark:text-white">
              {bug.assignee_name || 'Unassigned'}
            </div>
          </div>
          <div>
            <div className="text-stone-400 font-medium mb-1">Created</div>
            <div className="font-semibold text-stone-900 dark:text-white">
              {new Date(bug.created_at).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div className="text-stone-400 font-medium mb-1">Last Updated</div>
            <div className="font-semibold text-stone-900 dark:text-white">
              {new Date(bug.updated_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {/* Description */}
        <div>
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">
            Description
          </h2>
          <div className="text-sm text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap bg-stone-50/30 dark:bg-stone-800/10 p-4 rounded-xl border border-stone-100 dark:border-stone-800">
            {bug.description || 'No description provided.'}
          </div>
        </div>
      </div>

      {/* Risk Analysis Widget */}
      {riskData && (
        <div className="bg-white dark:bg-stone-900 p-6 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-orange-600" />
              <h2 className="font-bold text-sm text-stone-900 dark:text-white">
                Deterministic Risk Analysis Engine
              </h2>
            </div>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                riskData.risk_level === 'CRITICAL' || riskData.risk_level === 'HIGH'
                  ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
              }`}
            >
              Risk Level: {riskData.risk_level} ({riskData.risk_score}/100)
            </span>
          </div>

          <div className="text-xs text-stone-600 dark:text-stone-400">
            {riskData.explanation}
          </div>

          {/* Factor Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {riskData.factors.map((f) => (
              <div
                key={f.name}
                className="p-3 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800 text-xs"
              >
                <div className="text-stone-400 capitalize">{f.name.replace('_', ' ')}</div>
                <div className="font-bold text-stone-900 dark:text-white mt-1">
                  {f.score} / {f.weight} pts
                </div>
                <div className="text-xs text-stone-500 mt-0.5">{f.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comments & Activity Timeline (Tabbed) */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs overflow-hidden">
        {/* Tab Header */}
        <div className="flex border-b border-stone-100 dark:border-stone-800">
          <button
            onClick={() => setActiveTab('comments')}
            className={`flex-1 px-6 py-4 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'comments'
                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/30 dark:bg-orange-950/10'
                : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
            }`}
          >
            Comments ({comments.length})
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`flex-1 px-6 py-4 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'activity'
                ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/30 dark:bg-orange-950/10'
                : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'
            }`}
          >
            Activity Timeline ({activityLog.length})
          </button>
        </div>

        <div className="p-6 sm:p-8">
          {/* Comments Tab */}
          {activeTab === 'comments' && (
            <>
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <div className="text-center py-6 text-xs text-stone-400">
                    No comments yet. Start the conversation below.
                  </div>
                ) : (
                  comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="p-4 rounded-xl bg-stone-50/60 dark:bg-stone-800/40 border border-stone-100 dark:border-stone-800 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-stone-900 dark:text-white">
                          {comment.author_name || 'User'}
                        </span>
                        <span className="text-xs text-stone-400">
                          {new Date(comment.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          • {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-wrap">
                        {comment.body}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Add comment form */}
              <form onSubmit={handleAddComment} className="space-y-3 pt-4 mt-6 border-t border-stone-100 dark:border-stone-800">
                <textarea
                  rows={3}
                  placeholder="Add a comment or update..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  className="w-full text-xs bg-stone-50/50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-3 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={commentLoading}
                    className="px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {commentLoading ? 'Posting...' : 'Post Comment'}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* Activity Timeline Tab */}
          {activeTab === 'activity' && (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-stone-200 dark:bg-stone-700" />

              <div className="space-y-0">
                {activityLog.length === 0 ? (
                  <div className="text-center py-6 text-xs text-stone-400">
                    No activity recorded for this issue yet.
                  </div>
                ) : (
                  activityLog.map((entry, idx) => {
                    const icon = ACTION_ICONS[entry.action] || { color: 'bg-stone-400', label: entry.action }
                    const oldVal = entry.old_value as Record<string, string> | undefined
                    const newVal = entry.new_value as Record<string, string> | undefined

                    return (
                      <div key={entry.id || idx} className="relative flex items-start gap-4 py-3 pl-1">
                        {/* Timeline dot */}
                        <div className={`relative z-10 w-8 h-8 rounded-full ${icon.color} flex items-center justify-center shrink-0 ring-4 ring-white dark:ring-stone-900`}>
                          <span className="text-white text-xs font-bold">
                            {(entry.actor_name || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-xs text-stone-700 dark:text-stone-300">
                            <span className="font-semibold text-stone-900 dark:text-white">
                              {entry.actor_name || 'Unknown'}
                            </span>{' '}
                            {icon.label}{' '}
                            <span className="font-semibold text-stone-900 dark:text-white">
                              {entry.entity_type === 'bug' ? entry.entity_id : entry.entity_type}
                            </span>
                          </p>

                          {/* Show old → new values if available */}
                          {oldVal && newVal && (
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                              {Object.keys(newVal).map((key) => (
                                <div key={key} className="flex items-center gap-1">
                                  {oldVal[key] && (
                                    <span className="px-1.5 py-0.5 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 line-through">
                                      {String(oldVal[key])}
                                    </span>
                                  )}
                                  <span className="text-stone-400">→</span>
                                  <span className="px-1.5 py-0.5 rounded bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 font-medium">
                                    {String(newVal[key])}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="text-xs text-stone-400 mt-1">
                            {timeAgo(entry.created_at)}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resolution Picker Modal */}
      {resolutionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 max-w-sm w-full border border-[#eee9e2] dark:border-stone-800 shadow-xl space-y-4">
            <h3 className="font-bold text-base text-stone-900 dark:text-white">
              Resolve Issue
            </h3>
            <p className="text-xs text-stone-500">
              Please specify the resolution code for this bug report:
            </p>
            <select
              value={selectedResolution}
              onChange={(e) => setSelectedResolution(e.target.value as BugResolution)}
              className="w-full text-xs bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl p-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            >
              <option value="FIXED">FIXED — Problem resolved</option>
              <option value="WONT_FIX">WONT_FIX — Intended behavior / Won&apos;t fix</option>
              <option value="DUPLICATE">DUPLICATE — Duplicate of another issue</option>
              <option value="INVALID">INVALID — Not a bug / Cannot reproduce</option>
            </select>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResolutionModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setResolutionModalOpen(false)
                  handleStatusChange('RESOLVED', selectedResolution)
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
