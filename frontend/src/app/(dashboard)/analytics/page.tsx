'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { ActivityLog } from '@/lib/types'

interface SeverityDist {
  name: string
  count: number
  pct: number
  color: string
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalReported: 0,
    openAssigned: 0,
    bugsBySeverity: {} as Record<string, number>,
    recentActivityCount: 0,
  })
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [statsRes, activityRes] = await Promise.allSettled([
          api.getDashboardStats(),
          api.getDashboardRecent(50),
        ])

        if (statsRes.status === 'fulfilled' && statsRes.value) {
          const s = statsRes.value
          setStats({
            totalReported: s.total_bugs_reported || 0,
            openAssigned: s.open_assigned || 0,
            bugsBySeverity: s.bugs_by_severity || {},
            recentActivityCount: s.recent_activity_count || 0,
          })
        }

        if (activityRes.status === 'fulfilled') {
          setRecentActivity(activityRes.value?.data || [])
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Compute severity distribution from real data
  const totalSev = Object.values(stats.bugsBySeverity).reduce((a, b) => a + b, 0) || 1
  const severityDistribution: SeverityDist[] = [
    { name: 'BLOCKER', count: stats.bugsBySeverity['BLOCKER'] || 0, pct: Math.round(((stats.bugsBySeverity['BLOCKER'] || 0) / totalSev) * 100), color: 'bg-red-600' },
    { name: 'CRITICAL', count: stats.bugsBySeverity['CRITICAL'] || 0, pct: Math.round(((stats.bugsBySeverity['CRITICAL'] || 0) / totalSev) * 100), color: 'bg-red-400' },
    { name: 'MAJOR', count: stats.bugsBySeverity['MAJOR'] || 0, pct: Math.round(((stats.bugsBySeverity['MAJOR'] || 0) / totalSev) * 100), color: 'bg-orange-500' },
    { name: 'NORMAL', count: stats.bugsBySeverity['NORMAL'] || 0, pct: Math.round(((stats.bugsBySeverity['NORMAL'] || 0) / totalSev) * 100), color: 'bg-blue-400' },
    { name: 'MINOR', count: stats.bugsBySeverity['MINOR'] || 0, pct: Math.round(((stats.bugsBySeverity['MINOR'] || 0) / totalSev) * 100), color: 'bg-stone-400' },
    { name: 'TRIVIAL', count: stats.bugsBySeverity['TRIVIAL'] || 0, pct: Math.round(((stats.bugsBySeverity['TRIVIAL'] || 0) / totalSev) * 100), color: 'bg-stone-300' },
  ]

  // Donut chart segments based on real severity data
  const donutSegments = severityDistribution
    .filter((s) => s.count > 0)
    .map((s) => ({ ...s, angle: (s.pct / 100) * 360 }))

  // Activity by action type
  const actionCounts: Record<string, number> = {}
  recentActivity.forEach((a) => {
    actionCounts[a.action] = (actionCounts[a.action] || 0) + 1
  })
  const topActions = Object.entries(actionCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6)

  const metrics = [
    { label: 'Total Bugs Filed', value: stats.totalReported.toString(), change: 'All time' },
    { label: 'Currently Assigned', value: stats.openAssigned.toString(), change: 'Open items' },
    { label: 'Severity Tracked', value: Object.keys(stats.bugsBySeverity).length.toString(), change: 'Categories' },
    { label: 'Actions This Week', value: stats.recentActivityCount.toString(), change: 'Activity count' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <Link href="/" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span className="text-stone-900 dark:text-white font-medium">Analytics</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Project Analytics
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Real-time metrics across your bug tracking pipeline.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{m.label}</div>
            <div className="text-2xl font-bold text-stone-900 dark:text-white mt-2">
              {loading ? (
                <div className="h-7 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
              ) : (
                m.value
              )}
            </div>
            <div className="text-xs text-stone-400 dark:text-stone-500 mt-2">
              {m.change}
            </div>
          </div>
        ))}
      </div>

      {/* Donut Chart + Severity Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Chart */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
          <h2 className="font-bold text-base text-stone-900 dark:text-white mb-4">Severity Overview</h2>
          <div className="flex items-center justify-center gap-8">
            <div className="relative w-40 h-40 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-stone-100 dark:text-stone-800"
                  strokeWidth="3.8"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                {(() => {
                  let offset = 0
                  return donutSegments.map((seg) => {
                    const dashArray = `${seg.pct}, 100`
                    const dashOffset = -offset
                    offset += seg.pct
                    return (
                      <path
                        key={seg.name}
                        className={seg.color}
                        strokeDasharray={dashArray}
                        strokeDashoffset={dashOffset}
                        strokeWidth="3.8"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    )
                  })
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-bold text-stone-900 dark:text-white leading-none">
                  {stats.totalReported}
                </span>
                <span className="text-xs text-stone-400 font-medium mt-0.5">
                  Total Bugs
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs flex-1">
              {severityDistribution.filter((s) => s.count > 0).map((s) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                    <span className="text-stone-600 dark:text-stone-300">{s.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-stone-900 dark:text-white">{s.count}</span>
                    <span className="text-stone-400">{s.pct}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Distribution */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
          <h2 className="font-bold text-base text-stone-900 dark:text-white mb-4">Activity Breakdown</h2>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="h-3 w-24 bg-stone-200 dark:bg-stone-800 rounded" />
                  <div className="flex-1 h-3 bg-stone-200 dark:bg-stone-800 rounded-full" />
                  <div className="h-3 w-8 bg-stone-200 dark:bg-stone-800 rounded" />
                </div>
              ))}
            </div>
          ) : topActions.length === 0 ? (
            <div className="text-center py-8 text-xs text-stone-400">
              No activity data yet. Start using the app to see analytics.
            </div>
          ) : (
            <div className="space-y-3">
              {topActions.map(([action, count]) => {
                const maxCount = topActions[0]?.[1] || 1
                const pct = Math.round((count / maxCount) * 100)
                const label = action.replace(/_/g, ' ').toLowerCase()

                return (
                  <div key={action} className="flex items-center gap-3">
                    <span className="w-28 text-xs font-medium text-stone-600 dark:text-stone-400 capitalize truncate">
                      {label}
                    </span>
                    <div className="flex-1 h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold text-stone-700 dark:text-stone-300">
                      {count}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Weekly Summary based on real data */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
        <h2 className="font-bold text-base text-stone-900 dark:text-white mb-4">Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">
              {stats.totalReported}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Total Filed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {stats.openAssigned}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Currently Assigned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.recentActivityCount}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Actions This Week</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">
              {Object.keys(stats.bugsBySeverity).length}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Severity Levels Used</div>
          </div>
        </div>
      </div>
    </div>
  )
}
