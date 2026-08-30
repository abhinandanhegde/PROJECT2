'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface SeverityDist {
  name: string
  count: number
  pct: number
  color: string
}

interface ActivityCount {
  label: string
  count: number
}

interface ActivityBreakdown {
  total: number
  since: string
  window_days: number
  breakdown: ActivityCount[]
}

const SEV_COLORS: Record<string, string> = {
  BLOCKER: '#dc2626',
  CRITICAL: '#ef4444',
  MAJOR: '#f97316',
  NORMAL: '#3b82f6',
  MINOR: '#6b7280',
  TRIVIAL: '#a1a1aa',
}

// SVG arc path for a donut segment (start at top, clockwise).
function donutArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = (Math.PI / 180) * startAngle
  const end = (Math.PI / 180) * endAngle
  const x1 = cx + r * Math.cos(start)
  const y1 = cy + r * Math.sin(start)
  const x2 = cx + r * Math.cos(end)
  const y2 = cy + r * Math.sin(end)
  const large = endAngle - startAngle > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState({
    totalReported: 0,
    openAssigned: 0,
    bugsBySeverity: {} as Record<string, number>,
    recentActivityCount: 0,
  })
  const [activityBreakdown, setActivityBreakdown] = useState<ActivityBreakdown | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [statsRes, breakdownRes] = await Promise.allSettled([
          api.getDashboardStats(),
          api.getActivityBreakdown(),
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

        if (breakdownRes.status === 'fulfilled' && breakdownRes.value) {
          setActivityBreakdown(breakdownRes.value)
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
    { name: 'BLOCKER', count: stats.bugsBySeverity['BLOCKER'] || 0, pct: Math.round(((stats.bugsBySeverity['BLOCKER'] || 0) / totalSev) * 100), color: SEV_COLORS['BLOCKER'] },
    { name: 'CRITICAL', count: stats.bugsBySeverity['CRITICAL'] || 0, pct: Math.round(((stats.bugsBySeverity['CRITICAL'] || 0) / totalSev) * 100), color: SEV_COLORS['CRITICAL'] },
    { name: 'MAJOR', count: stats.bugsBySeverity['MAJOR'] || 0, pct: Math.round(((stats.bugsBySeverity['MAJOR'] || 0) / totalSev) * 100), color: SEV_COLORS['MAJOR'] },
    { name: 'NORMAL', count: stats.bugsBySeverity['NORMAL'] || 0, pct: Math.round(((stats.bugsBySeverity['NORMAL'] || 0) / totalSev) * 100), color: SEV_COLORS['NORMAL'] },
    { name: 'MINOR', count: stats.bugsBySeverity['MINOR'] || 0, pct: Math.round(((stats.bugsBySeverity['MINOR'] || 0) / totalSev) * 100), color: SEV_COLORS['MINOR'] },
    { name: 'TRIVIAL', count: stats.bugsBySeverity['TRIVIAL'] || 0, pct: Math.round(((stats.bugsBySeverity['TRIVIAL'] || 0) / totalSev) * 100), color: SEV_COLORS['TRIVIAL'] },
  ]

  // Real donut segments (arc paths). A 2° inset per segment keeps clean gaps.
  const GAP = 2
  const donutSegments = severityDistribution
    .filter((s) => s.count > 0)
    .map((s, i, arr) => {
      const startAngle = -90 + (arr.slice(0, i).reduce((a, x) => a + x.pct, 0) / 100) * 360
      const endAngle = startAngle + (s.pct / 100) * 360
      return { ...s, startAngle: startAngle + GAP, endAngle: endAngle - GAP }
    })

  // Activity categories: server-aggregated from the same activity records as
  // the "Activity This Week" stat (same user projects, same 7-day window), so
  // the per-category counts always sum to that headline number.
  const breakdownItems = activityBreakdown?.breakdown || []
  const breakdownMax = breakdownItems[0]?.count || 1

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
          <div className="flex items-center justify-center gap-10">
            <div className="relative w-44 h-44 shrink-0">
              <svg className="w-full h-full" viewBox="0 0 36 36">
                {donutSegments.length === 0 ? (
                  <circle
                    cx="18"
                    cy="18"
                    r="15.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.8"
                    className="text-stone-100 dark:text-stone-800"
                  />
                ) : (
                  donutSegments.map((seg) => (
                    <path
                      key={seg.name}
                      d={donutArc(
                        18,
                        18,
                        15.5,
                        seg.startAngle,
                        seg.endAngle
                      )}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth="3.8"
                      strokeLinecap="butt"
                    />
                  ))
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="text-2xl font-bold text-stone-900 dark:text-white leading-none">
                  {Object.values(stats.bugsBySeverity).reduce((a, b) => a + b, 0)}
                </span>
                <span className="text-xs text-stone-400 font-medium mt-1">
                  Total Bugs
                </span>
              </div>
            </div>

            <div className="min-w-[220px] flex-1 space-y-3">
              {severityDistribution.filter((s) => s.count > 0).map((s) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="font-medium text-stone-700 dark:text-stone-300">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-900 dark:text-white">{s.count}</span>
                      <span className="text-stone-400 w-9 text-right">{s.pct}%</span>
                    </div>
                  </div>
                  <div className="mt-1 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Distribution */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-bold text-base text-stone-900 dark:text-white">Activity Breakdown</h2>
            {!loading && breakdownItems.length > 0 && (
              <span className="text-xs text-stone-500 dark:text-stone-400">
                Last {activityBreakdown?.window_days ?? 7} days · {activityBreakdown?.total ?? 0} actions
              </span>
            )}
          </div>
          {loading ? (
            <div className="space-y-3 mt-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse flex items-center gap-3">
                  <div className="h-3 w-24 bg-stone-200 dark:bg-stone-800 rounded" />
                  <div className="flex-1 h-3 bg-stone-200 dark:bg-stone-800 rounded-full" />
                  <div className="h-3 w-8 bg-stone-200 dark:bg-stone-800 rounded" />
                </div>
              ))}
            </div>
          ) : breakdownItems.length === 0 ? (
            <div className="text-center py-8 text-xs text-stone-400">
              No activity data yet. Start using the app to see analytics.
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              {breakdownItems.map((item) => {
                const pct = Math.round((item.count / breakdownMax) * 100)
                return (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className="w-32 text-xs font-medium text-stone-600 dark:text-stone-400 capitalize truncate">
                      {item.label}
                    </span>
                    <div className="flex-1 h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-500 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right text-xs font-semibold text-stone-700 dark:text-stone-300">
                      {item.count}
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
