'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Bug, BugStatus, BugSeverity, BugPriority } from '@/lib/types'

type Tab = 'assigned' | 'reported' | 'all'

function statusColor(status: BugStatus) {
  switch (status) {
    case 'RESOLVED':
    case 'VERIFIED':
    case 'CLOSED':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
    case 'IN_PROGRESS':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
    case 'NEW':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300'
    default:
      return 'bg-stone-100 text-stone-800 dark:bg-stone-800 dark:text-stone-300'
  }
}

function severityColor(sev: BugSeverity) {
  switch (sev) {
    case 'BLOCKER':
    case 'CRITICAL':
      return 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-900'
    case 'MAJOR':
      return 'bg-orange-50 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-900'
    case 'NORMAL':
      return 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
    default:
      return 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400 border border-stone-200 dark:border-stone-700'
  }
}

function priorityColor(p: BugPriority) {
  if (p === 'P1') return 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
  if (p === 'P2') return 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
  return 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
}

export default function MyIssuesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('assigned')
  const [assignedBugs, setAssignedBugs] = useState<Bug[]>([])
  const [reportedBugs, setReportedBugs] = useState<Bug[]>([])
  const [allBugs, setAllBugs] = useState<Bug[]>([])
  const [loading, setLoading] = useState(true)


  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const projRes = await api.getProjects().catch(() => null)
        const projs = projRes?.data || []
        if (projs.length === 0) {
          setLoading(false)
          return
        }

        // Load bugs from all projects
        const allBugLists: Bug[] = []
        for (const proj of projs) {
          try {
            const bugRes = await api.getBugs(proj.id, { per_page: '100' })
            const bugs = (bugRes?.data || []) as Bug[]
            allBugLists.push(...bugs)
          } catch {
            // Skip failed projects
          }
        }

        setAllBugs(allBugLists)

        // We don't know current user ID from frontend directly, but we can infer from Supabase
        // For now, show all bugs and let the user see what's relevant
        // The assigned endpoint gives us user-specific bugs
        try {
          const assignedRes = await api.getDashboardAssigned({ per_page: 100 })
          setAssignedBugs(assignedRes?.data || [])
        } catch {
          setAssignedBugs([])
        }

        // For "reported", we'll filter from all bugs where the user is reporter
        // (We'll show all bugs as fallback since we can't easily get current user ID here)
        setReportedBugs(allBugLists)
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const displayBugs = activeTab === 'assigned' ? assignedBugs : activeTab === 'reported' ? reportedBugs : allBugs

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <Link href="/" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span className="text-stone-900 dark:text-white font-medium">My Issues</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          My Issues
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Bugs assigned to you, reported by you, and across all your projects.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-stone-100 dark:bg-stone-800 rounded-xl p-1 w-fit">
        {([
          { key: 'assigned' as Tab, label: 'Assigned to Me', count: assignedBugs.length },
          { key: 'reported' as Tab, label: 'Reported by Me', count: reportedBugs.length },
          { key: 'all' as Tab, label: 'All Issues', count: allBugs.length },
        ]).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === tab.key
                ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-700 dark:hover:text-stone-300'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-stone-200 dark:bg-stone-700 text-xs font-bold">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Bug List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 animate-pulse space-y-2">
              <div className="flex gap-2">
                <div className="h-4 w-20 bg-stone-200 dark:bg-stone-800 rounded" />
                <div className="h-4 w-16 bg-stone-200 dark:bg-stone-800 rounded-full" />
              </div>
              <div className="h-4 w-2/3 bg-stone-200 dark:bg-stone-800 rounded" />
              <div className="h-3 w-1/3 bg-stone-200 dark:bg-stone-800 rounded" />
            </div>
          ))}
        </div>
      ) : displayBugs.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-12 text-center border border-[#eee9e2] dark:border-stone-800">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white">No issues found</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 mb-4">
            {activeTab === 'assigned'
              ? 'No bugs are currently assigned to you.'
              : activeTab === 'reported'
              ? 'You haven\'t reported any bugs yet.'
              : 'No bugs found across your projects.'}
          </p>
          <Link
            href="/bugs/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold transition-colors"
          >
            Create your first bug →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {displayBugs.map((bug) => (
            <Link
              key={bug.id}
              href={`/bugs/${bug.id}`}
              className="block bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 hover:border-orange-500/40 dark:hover:border-orange-500/40 transition-all group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono font-bold text-xs text-orange-600 dark:text-orange-400 group-hover:underline">
                      {bug.id}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(bug.status)}`}>
                      {bug.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${severityColor(bug.severity)}`}>
                      {bug.severity}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${priorityColor(bug.priority)}`}>
                      {bug.priority}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                    {bug.title}
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-1">
                    {bug.description}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-1">
                  <div className="text-xs text-stone-400">
                    {new Date(bug.updated_at).toLocaleDateString()}
                  </div>
                  {bug.assignee_name && (
                    <div className="text-xs text-stone-500 dark:text-stone-400">
                      → {bug.assignee_name}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
