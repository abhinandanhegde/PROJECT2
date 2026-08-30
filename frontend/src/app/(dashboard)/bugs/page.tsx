'use client'

import React, { useEffect, useState, Suspense, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Bug, TriageResult } from '@/lib/types'
import { bugRef } from '@/lib/types'
import { supabase } from '@/lib/supabase'

type Tab = 'all' | 'assigned' | 'reported'

interface EnrichedTriageItem {
  bug: Bug
  triage?: TriageResult
  loading: boolean
}

function BugsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const statusFilter = searchParams.get('status') || ''
  const severityFilter = searchParams.get('severity') || ''
  const priorityFilter = searchParams.get('priority') || ''
  const sortBy = searchParams.get('sort_by') || 'created_at'
  const sortOrder = searchParams.get('sort_order') || 'desc'
  const searchQuery = searchParams.get('q') || ''
  const tabParam = (searchParams.get('tab') || 'all') as Tab

  const [bugs, setBugs] = useState<Bug[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>('')
  const [triageItems, setTriageItems] = useState<EnrichedTriageItem[]>([])
  const [triageLoading, setTriageLoading] = useState(false)
  const [triageView, setTriageView] = useState(false)

  // Map bug ID → triage result for inline display in the bugs table
  const triageMap = useMemo(() => {
    const map = new Map<string, TriageResult>()
    triageItems.forEach((item) => {
      if (item.triage) map.set(item.bug.id, item.triage)
    })
    return map
  }, [triageItems])

  // Get current user ID
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id)
    })
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    setTriageLoading(true)
    try {
      const projRes = await api.getProjects().catch(() => null)
      const projs = projRes?.data || []

      if (projs.length === 0) {
        setBugs([])
        setTriageItems([])
        setLoading(false)
        setTriageLoading(false)
        return
      }

      const projectId = projs[0].id

      // Fetch the bug LIST and TRIAGE SOURCE list in PARALLEL (single project fetch above)
      const [listRes, triageSrcRes] = await Promise.all([
        api
          .getBugs(projectId, {
            status: statusFilter || undefined,
            severity: severityFilter || undefined,
            priority: priorityFilter || undefined,
            search: searchQuery || undefined,
            sort_by: sortBy,
            sort_order: sortOrder,
          })
          .catch(() => null),
        api.getBugs(projectId, { per_page: '10' }).catch(() => null),
      ])

      const list = listRes?.data as Bug[] | undefined
      setBugs(list || [])

      const triageSrc = (triageSrcRes?.data as Bug[] | undefined) || []
      const topBugs = triageSrc.slice(0, 5)
      if (topBugs.length === 0) {
        setTriageItems([])
        setLoading(false)
        setTriageLoading(false)
        return
      }

      // Show skeleton rows immediately, run ALL triage calls in PARALLEL
      setTriageItems(topBugs.map((b) => ({ bug: b, loading: true })))
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
    } catch {
      setBugs([])
      setTriageItems([])
    } finally {
      setLoading(false)
      setTriageLoading(false)
    }
  }, [statusFilter, severityFilter, priorityFilter, searchQuery, sortBy, sortOrder])

  // Load bugs list + triage queue together. The triage view is now part of the
  // issues page — one effect, parallel fetches, no separate triage tab.
  useEffect(() => {
    loadData()
  }, [loadData])

const visibleBugs = useMemo(() => {
    let filtered = bugs
    if (tabParam === 'assigned' && currentUserId) {
      filtered = bugs.filter((b) => b.assignee_id === currentUserId)
    } else if (tabParam === 'reported' && currentUserId) {
      filtered = bugs.filter((b) => b.reporter_id === currentUserId)
    }
    // Triage View: only bugs with triage data, sorted by confidence desc
    if (triageView) {
      filtered = filtered
        .filter((b) => triageMap.has(b.id))
        .sort((a, b) => {
          const ta = triageMap.get(a.id)
          const tb = triageMap.get(b.id)
          return (tb?.confidence || 0) - (ta?.confidence || 0)
        })
    }
    return filtered
  }, [bugs, tabParam, currentUserId, triageView, triageMap])

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/bugs?${params.toString()}`)
  }

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tab)
    router.push(`/bugs?${params.toString()}`)
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'BLOCKER': case 'CRITICAL':
        return 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900'
      case 'MAJOR':
        return 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-900'
      case 'NORMAL':
        return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
      default:
        return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
    }
  }

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'P1': return 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200 font-bold'
      case 'P2': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 font-semibold'
      case 'P3': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
      default: return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
      case 'CONFIRMED': return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
      case 'RESOLVED': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      case 'CLOSED': return 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
      case 'REOPENED': return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
      default: return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
    }
  }


  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Issues
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Browse, filter, and triage issues across your projects
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setTriageView(!triageView)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all cursor-pointer ${
              triageView
                ? 'bg-orange-500 text-white shadow-orange-500/20'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 border border-stone-200 dark:border-stone-700'
            }`}
          >
            <span className="text-sm">🧠</span>
            <span>{triageView ? 'Showing Triage' : 'Triage View'}</span>
            {triageView && <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/20 font-bold">{triageMap.size}</span>}
          </button>
          <Link
            href="/bugs/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-sm shadow-orange-500/20 transition-all cursor-pointer"
          >
            <span className="text-base leading-none">+</span>
            <span>New Bug</span>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 rounded-xl p-1 w-fit">
        {([
          { key: 'all' as Tab, label: 'All Issues' },
          { key: 'assigned' as Tab, label: 'Assigned to Me' },
          { key: 'reported' as Tab, label: 'Reported by Me' },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              tabParam === t.key
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => updateParam('status', e.target.value)}
          className="text-xs bg-stone-100/80 dark:bg-stone-800 border border-transparent rounded-xl px-3 py-2 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        >
          <option value="">All Statuses</option>
          <option value="NEW">NEW</option>
          <option value="CONFIRMED">CONFIRMED</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="CLOSED">CLOSED</option>
          <option value="REOPENED">REOPENED</option>
        </select>

        <select
          value={severityFilter}
          onChange={(e) => updateParam('severity', e.target.value)}
          className="text-xs bg-stone-100/80 dark:bg-stone-800 border border-transparent rounded-xl px-3 py-2 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        >
          <option value="">All Severities</option>
          <option value="BLOCKER">BLOCKER</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="MAJOR">MAJOR</option>
          <option value="NORMAL">NORMAL</option>
          <option value="MINOR">MINOR</option>
          <option value="TRIVIAL">TRIVIAL</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => updateParam('priority', e.target.value)}
          className="text-xs bg-stone-100/80 dark:bg-stone-800 border border-transparent rounded-xl px-3 py-2 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
        >
          <option value="">All Priorities</option>
          <option value="P1">P1 (Highest)</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
          <option value="P4">P4</option>
          <option value="P5">P5</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-stone-400 font-medium">Sort:</span>
          <select
            value={`${sortBy}:${sortOrder}`}
            onChange={(e) => {
              const [sb, so] = e.target.value.split(':')
              const params = new URLSearchParams(searchParams.toString())
              params.set('sort_by', sb)
              params.set('sort_order', so)
              router.push(`/bugs?${params.toString()}`)
            }}
            className="text-xs bg-stone-100/80 dark:bg-stone-800 border border-transparent rounded-xl px-3 py-2 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          >
            <option value="created_at:desc">Newest First</option>
            <option value="created_at:asc">Oldest First</option>
            <option value="severity:desc">Highest Severity</option>
            <option value="priority:asc">Highest Priority</option>
          </select>
        </div>
      </div>

      {/* Triage Queue View (always part of the Issues page) */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="p-6 pb-2">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <h2 className="font-bold text-base text-stone-900 dark:text-white">
                  Instant Triage Queue
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                  deterministic
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400">
                  {triageItems.length}
                </span>
              </div>
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
                <div className="text-center py-10 text-xs text-stone-400">
                  No issues to triage yet. Create your first bug to see suggestions.
                </div>
              ) : (
                triageItems.map((item) => (
                  <div
                    key={item.bug.id}
                    className="grid grid-cols-12 items-center py-3.5 hover:bg-stone-50/70 dark:hover:bg-stone-800/40 rounded-xl transition-colors px-1"
                  >
                    <div className="col-span-5 pr-2">
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400">
                        <Link href={`/bugs/${item.bug.id}`} className="hover:underline">{bugRef(item.bug)}</Link>
                      </span>
                      <div className="text-xs font-medium text-stone-900 dark:text-white truncate mt-0.5">
                        <Link href={`/bugs/${item.bug.id}`} className="hover:underline">{item.bug.title}</Link>
                      </div>
                      {/* Show triage reasoning chain inline */}
                      {item.triage && item.triage.reasons.length > 0 && (
                        <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 truncate" title={item.triage.reasons.join(' · ')}>
                          ✓ {item.triage.reasons[0]}
                          {item.triage.reasons.length > 1 && <span className="text-stone-300 dark:text-stone-600"> +{item.triage.reasons.length - 1} more</span>}
                        </div>
                      )}
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
                            item.triage.suggested_severity === 'CRITICAL' ||
                            item.triage.suggested_severity === 'BLOCKER'
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
                      <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-400">
                        {item.bug.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      {/* Issues List */}
      {/* Loading */}
      {loading ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 space-y-4">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className="animate-pulse flex items-center justify-between py-3">
              <div className="flex items-center gap-4 flex-1">
                <div className="w-16 h-4 bg-stone-200 dark:bg-stone-800 rounded" />
                <div className="w-1/3 h-4 bg-stone-200 dark:bg-stone-800 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-16 h-6 bg-stone-200 dark:bg-stone-800 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : visibleBugs.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-12 text-center border border-[#eee9e2] dark:border-stone-800">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-3">
            <span className="text-xl">🔍</span>
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white">No issues found</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            {tabParam === 'assigned'
              ? 'No bugs are currently assigned to you.'
              : tabParam === 'reported'
              ? "You haven't reported any bugs yet."
              : 'No issues match your current filters. Try adjusting them or create a new bug.'}
          </p>
          <div className="mt-4">
            <Link href="/bugs/new" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-sm transition-colors">
              + Create Bug
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#eee9e2] dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 text-stone-400 dark:text-stone-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-5">ID</th>
                  <th className="py-3.5 px-4">Title</th>
                  <th className="py-3.5 px-4">Severity</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Triage</th>
                  <th className="py-3.5 px-4">Assignee</th>
                  <th className="py-3.5 px-5 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9e2] dark:divide-stone-800">
                {visibleBugs.map((bug) => {
                  const triage = triageMap.get(bug.id)
                  return (
                    <tr key={bug.id} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors cursor-pointer">
                      <td className="py-3.5 px-5 font-mono font-bold text-orange-600 dark:text-orange-400">
                        <Link href={`/bugs/${bug.id}`} className="hover:underline">{bugRef(bug)}</Link>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-stone-900 dark:text-white max-w-xs truncate">
                        <Link href={`/bugs/${bug.id}`} className="hover:underline">{bug.title}</Link>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                            bug.severity === 'BLOCKER' || bug.severity === 'CRITICAL'
                              ? 'bg-red-500'
                              : bug.severity === 'MAJOR'
                              ? 'bg-orange-500'
                              : bug.severity === 'NORMAL'
                              ? 'bg-blue-500'
                              : 'bg-stone-400'
                          }`} />
                          <span className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${getSeverityBadge(bug.severity)}`}>{bug.severity}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${getPriorityBadge(bug.priority)}`}>{bug.priority}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(bug.status)}`}>{bug.status}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        {triage ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              triage.suggested_severity === 'BLOCKER' || triage.suggested_severity === 'CRITICAL'
                                ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                                : triage.suggested_severity === 'MAJOR'
                                ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
                                : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                            }`}>
                              {triage.suggested_severity}
                            </span>
                            <span className="text-[10px] text-stone-400 dark:text-stone-500">
                              {Math.round(triage.confidence * 100)}% · {triage.reasons[0]?.slice(0, 30) || '—'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-stone-400">—</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-xs font-bold text-stone-600 dark:text-stone-300">
                            {(bug.assignee_name || 'U').charAt(0)}
                          </div>
                          <span>{bug.assignee_name || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5 text-right text-stone-400 dark:text-stone-500 whitespace-nowrap">
                        {new Date(bug.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {visibleBugs.map((bug) => {
              const triage = triageMap.get(bug.id)
              return (
                <div key={bug.id} className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
                      <Link href={`/bugs/${bug.id}`}>{bugRef(bug)}</Link>
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(bug.status)}`}>{bug.status}</span>
                  </div>
                  <div className="text-sm font-semibold text-stone-900 dark:text-white">
                    <Link href={`/bugs/${bug.id}`}>{bug.title}</Link>
                  </div>
                  {/* Show triage suggestion inline on mobile */}
                  {triage && (
                    <div className="flex items-center gap-2 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded font-bold ${
                        triage.suggested_severity === 'BLOCKER' || triage.suggested_severity === 'CRITICAL'
                          ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                          : triage.suggested_severity === 'MAJOR'
                          ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
                          : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                      }`}>
                        Triage: {triage.suggested_severity}
                      </span>
                      <span className="text-stone-400 dark:text-stone-500">{Math.round(triage.confidence * 100)}% confidence</span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        bug.severity === 'BLOCKER' || bug.severity === 'CRITICAL'
                          ? 'bg-red-500'
                          : bug.severity === 'MAJOR'
                          ? 'bg-orange-500'
                          : bug.severity === 'NORMAL'
                          ? 'bg-blue-500'
                          : 'bg-stone-400'
                      }`} />
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getSeverityBadge(bug.severity)}`}>{bug.severity}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getPriorityBadge(bug.priority)}`}>{bug.priority}</span>
                    <span className="text-xs text-stone-500 dark:text-stone-400 ml-auto">{bug.assignee_name || 'Unassigned'}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

export default function BugsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading issues...</div>}>
      <BugsContent />
    </Suspense>
  )
}
