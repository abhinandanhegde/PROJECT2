'use client'

import React, { useEffect, useState, Suspense, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import type { Bug } from '@/lib/types'

function BugsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const statusFilter = searchParams.get('status') || ''
  const severityFilter = searchParams.get('severity') || ''
  const priorityFilter = searchParams.get('priority') || ''
  const sortBy = searchParams.get('sort_by') || 'created_at'
  const sortOrder = searchParams.get('sort_order') || 'desc'
  const searchQuery = searchParams.get('q') || ''

  const [bugs, setBugs] = useState<Bug[]>([])
  const [loading, setLoading] = useState(true)

  // Demo / fallback bugs if none in backend
  const fallbackBugs: Bug[] = useMemo(
    () => [
      {
        id: 'BUG-184',
        project_id: 'default',
        title: 'Login crashes after session expires',
        description: 'Users experience an unhandled exception on token expiry.',
        status: 'NEW',
        severity: 'BLOCKER',
        priority: 'P1',
        reporter_id: 'u1',
        reporter_name: 'Alex Johnson',
        assignee_id: null,
        assignee_name: 'Unassigned',
        created_at: new Date(Date.now() - 7200000).toISOString(),
        updated_at: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: 'BUG-181',
        project_id: 'default',
        title: 'API returns 500 on payment process',
        description: 'Stripe webhook verification fails intermittently.',
        status: 'CONFIRMED',
        severity: 'CRITICAL',
        priority: 'P1',
        reporter_id: 'u2',
        reporter_name: 'Mike Ross',
        assignee_id: 'u3',
        assignee_name: 'Rahul Sharma',
        created_at: new Date(Date.now() - 18000000).toISOString(),
        updated_at: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: 'BUG-178',
        project_id: 'default',
        title: 'UI freezes on dashboard refresh',
        description: 'Heavy SVG render blocking main thread.',
        status: 'IN_PROGRESS',
        severity: 'MAJOR',
        priority: 'P2',
        reporter_id: 'u1',
        reporter_name: 'Alex Johnson',
        assignee_id: 'u4',
        assignee_name: 'Priya Singh',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 43200000).toISOString(),
      },
      {
        id: 'BUG-175',
        project_id: 'default',
        title: 'Email notifications not sent',
        description: 'SMTP connection timeout on worker nodes.',
        status: 'NEW',
        severity: 'NORMAL',
        priority: 'P2',
        reporter_id: 'u2',
        reporter_name: 'Mike Ross',
        assignee_id: null,
        assignee_name: 'Unassigned',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'BUG-143',
        project_id: 'default',
        title: 'Database connection pool exhaustion under load',
        description: 'Max connections reached during peak hour benchmarks.',
        status: 'RESOLVED',
        severity: 'CRITICAL',
        priority: 'P1',
        reporter_id: 'u3',
        reporter_name: 'Rahul Sharma',
        assignee_id: 'u3',
        assignee_name: 'Rahul Sharma',
        resolution: 'FIXED',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 120000).toISOString(),
      },
    ],
    []
  )

  useEffect(() => {
    function filterFallback(list: Bug[]) {
      let filtered = [...list]
      if (statusFilter) {
        filtered = filtered.filter((b) => b.status === statusFilter)
      }
      if (severityFilter) {
        filtered = filtered.filter((b) => b.severity === severityFilter)
      }
      if (priorityFilter) {
        filtered = filtered.filter((b) => b.priority === priorityFilter)
      }
      if (searchQuery) {
        filtered = filtered.filter(
          (b) =>
            b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.id.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }
      setBugs(filtered)
    }

    async function loadData() {
      setLoading(true)

      try {
        const projRes = await api.getProjects().catch(() => null)
        const projs = projRes?.data || []

        if (projs.length > 0) {
          const bugRes = await api.getBugs(projs[0].id, {
            status: statusFilter || undefined,
            severity: severityFilter || undefined,
            priority: priorityFilter || undefined,
            search: searchQuery || undefined,
            sort_by: sortBy,
            sort_order: sortOrder,
          })
          if (bugRes?.data && bugRes.data.length > 0) {
            setBugs(bugRes.data)
          } else {
            filterFallback(fallbackBugs)
          }
        } else {
          filterFallback(fallbackBugs)
        }
      } catch {
        filterFallback(fallbackBugs)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [statusFilter, severityFilter, priorityFilter, sortBy, sortOrder, searchQuery, fallbackBugs])

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`/bugs?${params.toString()}`)
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'BLOCKER':
      case 'CRITICAL':
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
      case 'P1':
        return 'bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200 font-bold'
      case 'P2':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 font-semibold'
      case 'P3':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200'
      default:
        return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
      case 'CONFIRMED':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
      case 'RESOLVED':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
      case 'CLOSED':
        return 'bg-stone-200 text-stone-700 dark:bg-stone-700 dark:text-stone-300'
      case 'REOPENED':
        return 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
      default:
        return 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header & New Bug Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Issues & Bugs
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Browse, filter, and triage issues across your projects
          </p>
        </div>
        <Link
          href="/bugs/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-sm shadow-orange-500/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <span className="text-base leading-none">+</span>
          <span>New Bug</span>
        </Link>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs flex flex-wrap items-center gap-3">
        {/* Status Filter */}
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

        {/* Severity Filter */}
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

        {/* Priority Filter */}
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

        {/* Sort By */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-stone-400 font-medium">Sort by:</span>
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

      {/* Loading Skeleton */}
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
                <div className="w-12 h-6 bg-stone-200 dark:bg-stone-800 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : bugs.length === 0 ? (
        /* Empty State */
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-12 text-center border border-[#eee9e2] dark:border-stone-800">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-3">
            <span className="text-xl">🔍</span>
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white">No bugs found</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            No issues match your current filter settings. Try adjusting your filters or create a new bug report.
          </p>
          <div className="mt-4">
            <Link
              href="/bugs/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              + Create Bug
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[#eee9e2] dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30 text-stone-400 dark:text-stone-500 font-semibold uppercase tracking-wider">
                  <th className="py-3.5 px-5">ID</th>
                  <th className="py-3.5 px-4">Title</th>
                  <th className="py-3.5 px-4">Severity</th>
                  <th className="py-3.5 px-4">Priority</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Assignee</th>
                  <th className="py-3.5 px-5 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9e2] dark:divide-stone-800">
                {bugs.map((bug) => (
                  <tr
                    key={bug.id}
                    className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 px-5 font-mono font-bold text-orange-600 dark:text-orange-400">
                      <Link href={`/bugs/${bug.id}`} className="hover:underline">
                        {bug.id.length > 8 && !bug.id.startsWith('BUG-')
                          ? bug.id.slice(0, 8)
                          : bug.id}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-stone-900 dark:text-white max-w-xs truncate">
                      <Link href={`/bugs/${bug.id}`} className="hover:underline">
                        {bug.title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold ${getSeverityBadge(
                          bug.severity
                        )}`}
                      >
                        {bug.severity}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-[11px] ${getPriorityBadge(
                          bug.priority
                        )}`}
                      >
                        {bug.priority}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium ${getStatusBadge(
                          bug.status
                        )}`}
                      >
                        {bug.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-stone-600 dark:text-stone-400">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center text-[10px] font-bold text-stone-600 dark:text-stone-300">
                          {(bug.assignee_name || 'U').charAt(0)}
                        </div>
                        <span>{bug.assignee_name || 'Unassigned'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-5 text-right text-stone-400 dark:text-stone-500 whitespace-nowrap">
                      {new Date(bug.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {bugs.map((bug) => (
              <div
                key={bug.id}
                className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 shadow-2xs space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400">
                    <Link href={`/bugs/${bug.id}`}>{bug.id}</Link>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${getStatusBadge(
                      bug.status
                    )}`}
                  >
                    {bug.status}
                  </span>
                </div>

                <div className="text-sm font-semibold text-stone-900 dark:text-white">
                  <Link href={`/bugs/${bug.id}`}>{bug.title}</Link>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold ${getSeverityBadge(
                      bug.severity
                    )}`}
                  >
                    {bug.severity}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${getPriorityBadge(
                      bug.priority
                    )}`}
                  >
                    {bug.priority}
                  </span>
                  <span className="text-[11px] text-stone-500 dark:text-stone-400 ml-auto">
                    {bug.assignee_name || 'Unassigned'}
                  </span>
                </div>
              </div>
            ))}
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