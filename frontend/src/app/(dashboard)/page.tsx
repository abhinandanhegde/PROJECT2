'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  DocumentIcon,
  FlagIcon,
  UserIcon,
  LockIcon,
  CalendarIcon,
} from '@/components/ui/Icons'
import { supabase } from '@/lib/supabase'
import { api } from '@/lib/api'
import type { Bug, TriageResult, ActivityLog } from '@/lib/types'
import { shortBugId } from '@/lib/types'

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
  const [staleIssues, setStaleIssues] = useState<{ code: string; title: string; days: string }[]>([])

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

    // Fire ALL 3 dashboard API calls in PARALLEL — 3x faster
    Promise.allSettled([
      api.getDashboardStats(),
      api.getDashboardRecent(20),
      api.getProjects(),
    ]).then(([statsRes, recentRes, projRes]) => {
      // Stats
      if (statsRes.status === 'fulfilled' && statsRes.value?.total_bugs_reported !== undefined) {
        const r = statsRes.value
        const sev = r.bugs_by_severity || {}
        setStats({
          openIssues: r.open_assigned || 0,
          p1Issues: (sev['CRITICAL'] || 0) + (sev['BLOCKER'] || 0),
          unassigned: r.total_bugs_assigned ? Math.max(0, r.total_bugs_assigned - r.open_assigned) : 0,
          blocked: r.recent_activity_count || 0,
        })
      }
      setStatsLoading(false)

      // Recent activity
      if (recentRes.status === 'fulfilled') {
        const entries = recentRes.value?.data || []
        setRecentActivities(entries)
        const staleMap = new Map<string, { code: string; title: string; days: string }>()
        entries.forEach((e: ActivityLog) => {
          if (e.bug_id && e.entity_type === 'bug') {
            const age = timeAgo(e.created_at)
            if (!staleMap.has(e.bug_id) && age.includes('d ago')) {
              staleMap.set(e.bug_id, { code: e.bug_id, title: e.action.replace(/_/g, ' ').toLowerCase(), days: age })
            }
          }
        })
        setStaleIssues(Array.from(staleMap.values()).slice(0, 3))
      }
      setActivityLoading(false)

      // Triage — fetch bugs then triage in parallel
      if (projRes.status === 'fulfilled') {
        const projects = projRes.value?.data || []
        if (projects.length > 0) {
          api.getBugs(projects[0].id, { status: 'NEW', per_page: '5' })
            .then((bugRes) => loadTriageData(projects[0].id, bugRes?.data || []))
            .catch(() => setTriageLoading(false))
        } else {
          setTriageLoading(false)
        }
      } else {
        setTriageLoading(false)
      }
    })
  }, [loadTriageData])

  const currentDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })

  const triageCount = triageItems.length

  return (
    <div className="space-y-6">
      {/* Top Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900 dark:text-white flex items-center gap-2">
            {greeting}, {userName}! <span className="animate-bounce">👋</span>
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Here&apos;s what&apos;s happening with your projects today.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white dark:bg-stone-900 border border-[#eee9e2] dark:border-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 shadow-2xs">
            <CalendarIcon className="w-3.5 h-3.5 text-stone-400" />
            <span>{currentDate}</span>
          </div>
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
          <div className="text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {statsLoading ? (
              <div className="h-8 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
            ) : (
              stats.openIssues
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
          <div className="text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {statsLoading ? (
              <div className="h-8 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
            ) : (
              stats.p1Issues
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
          <div className="text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {statsLoading ? (
              <div className="h-8 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
            ) : (
              stats.unassigned
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
          <div className="text-3xl font-bold text-stone-900 dark:text-white mt-3">
            {statsLoading ? (
              <div className="h-8 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
            ) : (
              stats.blocked
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 font-medium mt-3">
            <span>Actions across projects</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Smart Triage Queue (Left) & Recent Activity (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Smart Triage Queue (2 cols wide) */}
        <div className="lg:col-span-2 bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs flex flex-col justify-between overflow-hidden">
          <div className="p-6 pb-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold text-base text-stone-900 dark:text-white">
                  Smart Triage Queue
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400">
                  {triageCount}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                  AI-powered
                </span>
              </div>
              <Link
                href="/bugs?status=NEW"
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
              >
                View all
              </Link>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider pb-3 border-b border-stone-100 dark:border-stone-800">
              <div className="col-span-5">Issue</div>
              <div className="col-span-2 text-center">Priority</div>
              <div className="col-span-2 text-center">Suggested</div>
              <div className="col-span-2 text-center">Confidence</div>
              <div className="col-span-1 text-right">Status</div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {triageLoading ? (
                // Loading skeleton
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="grid grid-cols-12 items-center py-3.5 px-1 animate-pulse">
                    <div className="col-span-5 space-y-1">
                      <div className="h-3 w-16 bg-stone-200 dark:bg-stone-800 rounded" />
                      <div className="h-3 w-40 bg-stone-200 dark:bg-stone-800 rounded" />
                    </div>
                    <div className="col-span-2 flex justify-center"><div className="h-4 w-12 bg-stone-200 dark:bg-stone-800 rounded-full" /></div>
                    <div className="col-span-2 flex justify-center"><div className="h-4 w-12 bg-stone-200 dark:bg-stone-800 rounded-full" /></div>
                    <div className="col-span-2 flex justify-center"><div className="h-3 w-10 bg-stone-200 dark:bg-stone-800 rounded" /></div>
                    <div className="col-span-1 flex justify-end"><div className="h-4 w-14 bg-stone-200 dark:bg-stone-800 rounded-full" /></div>
                  </div>
                ))
              ) : triageItems.length === 0 ? (
                <div className="text-center py-8 text-xs text-stone-400">
                  No issues found. Create your first bug to see AI triage suggestions.
                </div>
              ) : (
                triageItems.map((item) => (
                  <div
                    key={item.bug.id}
                    className="grid grid-cols-12 items-center py-3.5 hover:bg-stone-50/70 dark:hover:bg-stone-800/40 rounded-xl transition-colors px-1"
                  >
                    <div className="col-span-5 pr-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline">
                          <Link href={`/bugs/${item.bug.id}`}>{shortBugId(item.bug.id)}</Link>
                        </span>
                      </div>
                      <div className="text-xs font-medium text-stone-900 dark:text-white truncate mt-0.5">
                        <Link href={`/bugs/${item.bug.id}`}>{item.bug.title}</Link>
                      </div>
                    </div>

                    <div className="col-span-2 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          item.bug.priority === 'P1'
                            ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                            : item.bug.priority === 'P2'
                            ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
                            : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                        }`}
                      >
                        {item.bug.priority}
                      </span>
                    </div>

                    <div className="col-span-2 text-center">
                      {item.loading ? (
                        <div className="h-4 w-14 bg-stone-200 dark:bg-stone-800 rounded-full mx-auto animate-pulse" />
                      ) : item.triage ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                            item.triage.suggested_severity === 'CRITICAL' || item.triage.suggested_severity === 'BLOCKER'
                              ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                          }`}
                        >
                          {item.triage.suggested_severity}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </div>

                    <div className="col-span-2 text-center">
                      {item.loading ? (
                        <div className="h-3 w-10 bg-stone-200 dark:bg-stone-800 rounded mx-auto animate-pulse" />
                      ) : item.triage ? (
                        <span className="text-xs font-medium text-stone-700 dark:text-stone-300">
                          {Math.round(item.triage.confidence * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">—</span>
                      )}
                    </div>

                    <div className="col-span-1 text-right">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.bug.status === 'NEW'
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400'
                            : item.bug.status === 'IN_PROGRESS'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400'
                            : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                        }`}
                      >
                        {item.bug.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="p-4 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800 text-center">
            <Link
              href="/bugs?status=NEW"
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:text-orange-700 inline-flex items-center gap-1"
            >
              View full triage queue →
            </Link>
          </div>
        </div>

        {/* Right Column: Recent Activity (Real Data) */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base text-stone-900 dark:text-white">
                Recent Activity
              </h2>
              <Link
                href="/analytics"
                className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="space-y-3.5">
              {activityLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2.5 animate-pulse">
                    <div className="w-2 h-2 rounded-full bg-stone-200 dark:bg-stone-800 mt-1.5 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-3/4 bg-stone-200 dark:bg-stone-800 rounded" />
                      <div className="h-2 w-1/4 bg-stone-200 dark:bg-stone-800 rounded" />
                    </div>
                  </div>
                ))
              ) : recentActivities.length === 0 ? (
                <div className="text-center py-6 text-xs text-stone-400">
                  No recent activity yet. Start using the app to see activity here.
                </div>
              ) : (
                recentActivities.slice(0, 8).map((act) => {
                  const label = ACTION_LABELS[act.action] || act.action.toLowerCase()
                  const color = ACTION_COLORS[act.action] || 'bg-stone-400'

                  return (
                    <div key={act.id} className="flex items-start gap-2.5 text-xs">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-stone-700 dark:text-stone-300">
                          <span className="font-semibold text-stone-900 dark:text-white">
                            {act.actor_name || 'User'}
                          </span>{' '}
                          {label}{' '}
                          {act.bug_id && (
                            <span className="font-semibold text-stone-900 dark:text-white">
                              <Link href={`/bugs/${act.bug_id}`} className="hover:underline">
                                {shortBugId(act.bug_id)}
                              </Link>
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-stone-400 whitespace-nowrap">
                        {timeAgo(act.created_at)}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Cards: Stale Issues (Real or Empty) */}
      {staleIssues.length > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-stone-900 dark:text-white">
              Stale Issues
            </h2>
            <Link
              href="/bugs?sort=stale"
              className="text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="space-y-3.5">
            {staleIssues.map((item) => (
              <div key={item.code} className="flex items-start justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-orange-600 dark:text-orange-400 hover:underline">
                    <Link href={`/bugs/${item.code}`}>{shortBugId(item.code)}</Link>
                  </div>
                  <div className="text-stone-700 dark:text-stone-300 truncate mt-0.5">
                    {item.title}
                  </div>
                </div>
                <span className="text-stone-400 dark:text-stone-500 whitespace-nowrap text-xs mt-0.5">
                  {item.days}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
