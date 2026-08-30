'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  DocumentIcon,
  FlagIcon,
  UserIcon,
  LockIcon,
} from '@/components/ui/Icons'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import type { Bug, TriageResult, ActivityLog } from '@/lib/types'
import { bugRef } from '@/lib/types'

interface EnrichedTriageItem {
  bug: Bug
  triage?: TriageResult
  loading: boolean
}

function greetingForHour(hour: number) {
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 22) return 'Good evening'
  return 'Good night'
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

const ACTION_LABELS: Record<string, string> = {
  BUG_CREATED: 'created',
  BUG_UPDATED: 'updated',
  BUG_ASSIGNED: 'assigned',
  BUG_STATUS_CHANGED: 'changed status of',
  BUG_SEVERITY_CHANGED: 'changed severity of',
  BUG_PRIORITY_CHANGED: 'changed priority of',
  BUG_RESOLVED: 'resolved',
  BUG_REOPENED: 'reopened',
  COMMENT_CREATED: 'commented on',
}

const ACTION_COLORS: Record<string, string> = {
  BUG_CREATED: 'bg-blue-500',
  BUG_UPDATED: 'bg-orange-500',
  BUG_ASSIGNED: 'bg-purple-500',
  BUG_STATUS_CHANGED: 'bg-emerald-500',
  BUG_SEVERITY_CHANGED: 'bg-red-500',
  BUG_PRIORITY_CHANGED: 'bg-amber-500',
  BUG_RESOLVED: 'bg-emerald-600',
  BUG_REOPENED: 'bg-rose-500',
  COMMENT_CREATED: 'bg-stone-400',
}

function PulsingDot({ color = 'bg-orange-500' }: { color?: string }) {
  return (
    <span className="relative flex h-2.5 w-2.5 ml-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${color}`} />
    </span>
  )
}

export default function DashboardPage() {
  const [userName, setUserName] = useState('Alex')
  const [greeting, setGreeting] = useState(() => greetingForHour(new Date().getHours()))

  const [stats, setStats] = useState({
    openIssues: 0,
    p1Issues: 0,
    unassigned: 0,
    blocked: 0,
  })

  const [triageItems, setTriageItems] = useState<EnrichedTriageItem[]>([])
  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [triageLoading, setTriageLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [intel, setIntel] = useState({ triaged: 0, total: 0, avgRisk: 0, blocking: 0, critical: 0 })

  const loadTriageData = useCallback(async (projectId: string, bugs: Bug[]) => {
    setTriageLoading(true)
    const topBugs = bugs.slice(0, 5)
    const enriched: EnrichedTriageItem[] = topBugs.map((b) => ({ bug: b, loading: true }))
    setTriageItems(enriched)

    // Fetch ALL triage in PARALLEL (not sequential!) — 5x faster
    const results = await Promise.allSettled(
      topBugs.map((b) =>
        api.triage(projectId, {
          title: b.title,
          description: b.description,
          severity: b.severity,
          priority: b.priority,
        })
      )
    )
    setTriageItems(
      results.map((r, i) => ({
        bug: topBugs[i],
        triage: r.status === 'fulfilled' ? r.value : undefined,
        loading: false,
      }))
    )
    setTriageLoading(false)
  }, [])

  useEffect(() => {
    setGreeting(greetingForHour(new Date().getHours()))

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        const name =
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          'Alex'
        setUserName(name)
      }
    })

    // PHASE 1: Stats + Activity + Intelligence in parallel (fastest — 3 calls)
    const loadPhase1 = async () => {
      const [statsResult, activityResult, intelResult] = await Promise.allSettled([
        api.getDashboardStats(),
        api.getDashboardRecent(10),
        api.getDashboardIntelligence(),
      ])

      if (statsResult.status === 'fulfilled') {
        const r = statsResult.value as Record<string, unknown>
        const sev = (r.bugs_by_severity || {}) as Record<string, number>
        setStats({
          openIssues: Number(r.open_assigned) || 0,
          p1Issues: (Number(sev['CRITICAL']) || 0) + (Number(sev['BLOCKER']) || 0),
          unassigned: Number(r.unassigned) || 0,
          blocked: Number(r.recent_activity_count) || 0,
        })
      }
      setStatsLoading(false)

      if (activityResult.status === 'fulfilled') {
        const data = (activityResult.value as { data?: ActivityLog[] })?.data || []
        setRecentActivities(data.slice(0, 10))
        data.forEach((e: ActivityLog) => {
          // hydrate actor_name if backend sent actor (nested)
          const eAny = e as unknown as Record<string, unknown>
          if (eAny.actor && !e.actor_name) {
            const actor = eAny.actor as Record<string, unknown> | null
            e.actor_name = (actor?.display_name as string) || 'User'
          }
        })
      }
      setActivityLoading(false)

      if (intelResult.status === 'fulfilled') {
        const d = intelResult.value as Record<string, unknown>
        setIntel({
          triaged: Number(d.triaged_count) || 0,
          total: Number(d.total_open) || 0,
          avgRisk: Number(d.avg_risk_score) || 0,
          blocking: Number(d.blocking_edges) || 0,
          critical: Number(d.critical_bugs) || 0,
        })
      }

      // PHASE 2: Triage (loads after stats are visible)
      const projectsResult = await Promise.allSettled([api.getProjects()])
      if (projectsResult[0].status === 'fulfilled') {
        const projs = (projectsResult[0].value as { data?: { id: string }[] })?.data || []
        if (projs.length > 0) {
          const bugsResult = await Promise.allSettled([
            api.getBugs(projs[0].id, { per_page: '5', sort_by: 'created_at', sort_order: 'desc' }),
          ])
          if (bugsResult[0].status === 'fulfilled') {
            const bugsData = (bugsResult[0].value as { data?: Bug[] })?.data || []
            loadTriageData(projs[0].id, bugsData)
          } else {
            setTriageLoading(false)
          }


        }
      }
    }

    loadPhase1()
  }, [loadTriageData])

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <Link href="/" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span className="text-stone-900 dark:text-white font-medium">Overview</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            {greeting}, {userName}! 👋
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Here&apos;s what&apos;s happening with your projects today.
          </p>
        </div>
        <div className="text-xs text-stone-400 dark:text-stone-500 font-mono">
          {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Open Issues */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Open Issues
            </div>
            <div className="w-9 h-9 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <DocumentIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {statsLoading ? (
              <div className="h-8 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
            ) : (
              <>
                {stats.openIssues}
                {stats.openIssues > 0 && <PulsingDot color="bg-orange-500" />}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 font-medium mt-3">
            <span>Assigned to you</span>
          </div>
        </div>

        {/* P1 Issues */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Critical / Blocker
            </div>
            <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
              <FlagIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {statsLoading ? (
              <div className="h-8 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
            ) : (
              <>
                {stats.p1Issues}
                {stats.p1Issues > 0 && <PulsingDot color="bg-red-500" />}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 font-medium mt-3">
            <span>High-priority items</span>
          </div>
        </div>

        {/* Unassigned */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Unassigned
            </div>
            <div className="w-9 h-9 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <UserIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {statsLoading ? (
              <div className="h-8 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
            ) : (
              <>
                {stats.unassigned}
                {stats.unassigned > 0 && <PulsingDot color="bg-amber-500" />}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 font-medium mt-3">
            <span>Need assignment</span>
          </div>
        </div>

        {/* Activity This Week */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">
              Activity This Week
            </div>
            <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <LockIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {statsLoading ? (
              <div className="h-8 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
            ) : (
              <>
                {stats.blocked}
                {stats.blocked > 0 && <PulsingDot color="bg-emerald-500" />}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 font-medium mt-3">
            <span>Actions across projects</span>
          </div>
        </div>
      </div>

      {/* Intelligence Summary Bar */}
      {intel.total > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-2xl p-4 border border-orange-200 dark:border-orange-900/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🧠</span>
            <h3 className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">Intelligence Overview</h3>
          </div>
          <div className="flex flex-wrap gap-4 sm:gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-stone-600 dark:text-stone-400">
                <span className="font-bold text-stone-900 dark:text-white">{intel.triaged}</span>/{intel.total} bugs triaged
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-stone-600 dark:text-stone-400">
                Avg risk: <span className="font-bold text-stone-900 dark:text-white">{intel.avgRisk}</span>/100
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-stone-600 dark:text-stone-400">
                <span className="font-bold text-stone-900 dark:text-white">{intel.blocking}</span> blocking edges
              </span>
            </div>
            {intel.critical > 0 && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  {intel.critical} critical unassigned
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Triage Queue + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Triage Queue */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-stone-900 dark:text-white">Smart Triage Queue</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-lg font-bold text-stone-900 dark:text-white">
                  {triageLoading ? '—' : triageItems.length}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                  ⚡ Instant
                </span>
              </div>
            </div>
            <Link href="/bugs?status=NEW" className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
              View all →
            </Link>
          </div>

          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_80px_100px_60px_80px] gap-2 px-3 py-1.5 text-[10px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
              <span>Issue</span>
              <span>Priority</span>
              <span>Suggested</span>
              <span>Confidence</span>
              <span>Status</span>
            </div>

            {triageLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3 px-3 py-2.5 rounded-xl">
                  <div className="h-4 w-32 bg-stone-200 dark:bg-stone-800 rounded" />
                  <div className="h-4 w-12 bg-stone-200 dark:bg-stone-800 rounded" />
                  <div className="h-4 w-16 bg-stone-200 dark:bg-stone-800 rounded" />
                  <div className="h-4 w-10 bg-stone-200 dark:bg-stone-800 rounded" />
                  <div className="h-4 w-14 bg-stone-200 dark:bg-stone-800 rounded" />
                </div>
              ))
            ) : triageItems.length === 0 ? (
              <div className="text-center py-8 text-xs text-stone-400 dark:text-stone-500">
                No issues found. Create your first bug to see triage suggestions.
              </div>
            ) : (
              triageItems.map((item) => (
                <Link
                  key={item.bug.id}
                  href={`/bugs/${item.bug.id}`}
                  className="grid grid-cols-[1fr_80px_100px_60px_80px] gap-2 items-center px-3 py-2.5 rounded-xl hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-900 dark:text-white">
                        {bugRef(item.bug)}
                      </span>
                      <span className="text-xs text-stone-500 dark:text-stone-400 truncate">
                        {item.bug.title.length > 30 ? item.bug.title.slice(0, 30) + '…' : item.bug.title}
                      </span>
                    </div>
                    {item.triage && item.triage.reasons.length > 0 && (
                      <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5 truncate" title={item.triage.reasons.join(' · ')}>
                        ✓ {item.triage.reasons[0]}
                        {item.triage.reasons.length > 1 && <span className="text-stone-300 dark:text-stone-600"> +{item.triage.reasons.length - 1} more</span>}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      item.bug.priority === 'P1' ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400' :
                      item.bug.priority === 'P2' ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400' :
                      'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                    }`}>
                      {item.bug.priority}
                    </span>
                  </div>
                  <div>
                    {item.triage ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        item.triage.suggested_severity === 'BLOCKER' || item.triage.suggested_severity === 'CRITICAL'
                          ? 'bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                          : item.triage.suggested_severity === 'MAJOR'
                          ? 'bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400'
                          : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                      }`}>
                        {item.triage.suggested_severity}
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400">—</span>
                    )}
                  </div>
                  <div>
                    {item.triage ? (
                      <span className="text-xs font-mono text-stone-600 dark:text-stone-400">
                        {Math.round(item.triage.confidence * 100)}%
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400">—</span>
                    )}
                  </div>
                  <div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                      item.bug.status === 'NEW' ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400' :
                      item.bug.status === 'CONFIRMED' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' :
                      item.bug.status === 'IN_PROGRESS' ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400' :
                      'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                    }`}>
                      {item.bug.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="mt-3 text-center">
            <Link href="/bugs?status=NEW" className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
              View full triage queue →
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-stone-900 dark:text-white">Recent Activity</h2>
            <Link href="/reports" className="text-xs text-orange-600 dark:text-orange-400 hover:underline font-medium">
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {activityLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-stone-200 dark:bg-stone-800 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <div className="h-3 w-3/4 bg-stone-200 dark:bg-stone-800 rounded" />
                    <div className="h-2 w-1/4 bg-stone-200 dark:bg-stone-800 rounded mt-1" />
                  </div>
                </div>
              ))
            ) : recentActivities.length === 0 ? (
              <div className="text-center py-8 text-xs text-stone-400 dark:text-stone-500">
                No recent activity yet. Start using the app to see activity here.
              </div>
            ) : (
              recentActivities.map((activity, idx) => {
                const actionLabel = ACTION_LABELS[activity.action] || activity.action
                const dotColor = ACTION_COLORS[activity.action] || 'bg-stone-400'
                return (
                  <div key={activity.id || idx} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full ${dotColor} mt-1.5 shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-stone-600 dark:text-stone-400">
                        <span className="font-semibold text-stone-900 dark:text-white">
                          {activity.actor_name || 'User'}
                        </span>
                        {' '}{actionLabel}{' '}
                        <span className="font-medium text-stone-700 dark:text-stone-300">
                          {activity.entity_type?.toLowerCase() === 'bug' ? bugRef({ id: activity.entity_id || activity.bug_id || '' } as Bug) : activity.entity_type}
                        </span>
                      </p>
                      <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                        {activity.created_at ? timeAgo(activity.created_at) : ''}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>


    </div>
  )
}
