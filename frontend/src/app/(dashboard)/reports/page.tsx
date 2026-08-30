'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Bug, Component, Project } from '@/lib/types'

interface ComponentHealth {
  name: string
  bugs: number
  open: number
  resolved: number
  pct: number
  risk: 'High' | 'Medium' | 'Low'
  color: string
}

const DONE_STATUSES = new Set(['RESOLVED', 'VERIFIED', 'CLOSED'])

export default function ReportsPage() {
  const [componentHealth, setComponentHealth] = useState<ComponentHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [totalBugs, setTotalBugs] = useState(0)
  const [resolvedBugs, setResolvedBugs] = useState(0)
  const [openBugs, setOpenBugs] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [projRes] = await Promise.allSettled([
          api.getProjects(),
        ])

        const projects = projRes.status === 'fulfilled' ? projRes.value?.data || [] : []

        // Build component health from bugs across the user's projects
        const componentMap = new Map<string, { total: number; resolved: number; open: number }>()
        let totalResolved = 0
        let totalSeen = 0

        const projectResults = await Promise.allSettled(
          projects.map(async (proj: Project) => {
            const [bugRes, compRes] = await Promise.allSettled([
              api.getBugs(proj.id, { per_page: '100' }),
              api.getComponents(proj.id),
            ])
            return {
              bugs: bugRes.status === 'fulfilled' ? bugRes.value?.data || [] : [],
              components: compRes.status === 'fulfilled' ? compRes.value?.data || [] : [],
            }
          })
        )

        for (const pr of projectResults) {
          if (pr.status !== 'fulfilled') continue
          const { bugs, components } = pr.value
          totalSeen += bugs.length

          bugs.forEach((bug: Bug) => {
            const compName = components.find((c: Component) => c.id === bug.component_id)?.name || 'Uncategorized'
            const existing = componentMap.get(compName) || { total: 0, resolved: 0, open: 0 }
            existing.total++
            if (DONE_STATUSES.has(bug.status)) {
              existing.resolved++
              totalResolved++
            } else {
              existing.open++
            }
            componentMap.set(compName, existing)
          })
        }

        setTotalBugs(totalSeen)
        setResolvedBugs(totalResolved)
        setOpenBugs(totalSeen - totalResolved)

        const healthList: ComponentHealth[] = Array.from(componentMap.entries())
          .map(([name, data]): ComponentHealth => {
            const pct = data.total ? Math.round((data.resolved / data.total) * 100) : 0
            return {
              name,
              bugs: data.total,
              open: data.open,
              resolved: data.resolved,
              pct,
              risk: data.open > data.resolved ? 'High' : data.open > 0 ? 'Medium' : 'Low',
              color: pct >= 80 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444',
            }
          })
          .sort((a, b) => b.bugs - a.bugs)

        setComponentHealth(healthList)
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const metrics = [
    { label: 'Total Bugs', value: totalBugs, accent: 'text-stone-900 dark:text-white', hint: 'Across your projects' },
    { label: 'Open', value: openBugs, accent: 'text-orange-600 dark:text-orange-400', hint: 'Still in progress' },
    { label: 'Resolved', value: resolvedBugs, accent: 'text-emerald-600 dark:text-emerald-400', hint: 'Done & closed' },
    { label: 'Components', value: componentHealth.length, accent: 'text-stone-900 dark:text-white', hint: 'Tracked areas' },
  ]

  // Health score breakdown — explainable, not arbitrary
  const resolutionRate = totalBugs > 0 ? Math.round((resolvedBugs / totalBugs) * 100) : 0
  const healthFactors = [
    { label: 'Resolution Rate', value: resolutionRate, max: 100, contribution: Math.round(resolutionRate * 0.5), positive: true },
    { label: 'Critical Issues', value: componentHealth.filter((c) => c.risk === 'High').length, max: Math.max(componentHealth.length, 1), contribution: -Math.min(25, componentHealth.filter((c) => c.risk === 'High').length * 8), positive: false },
    { label: 'Components Healthy', value: componentHealth.filter((c) => c.pct >= 70).length, max: Math.max(componentHealth.length, 1), contribution: Math.round((componentHealth.filter((c) => c.pct >= 70).length / Math.max(componentHealth.length, 1)) * 25), positive: true },
  ]
  const healthScore = Math.max(0, Math.min(100, 50 + healthFactors.reduce((sum, f) => sum + f.contribution, 0)))

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <Link href="/" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span className="text-stone-900 dark:text-white font-medium">Reports</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Reports & Health
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Component health breakdown and a snapshot of your bug pipeline.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{m.label}</div>
            <div className={`text-3xl font-bold mt-1 ${m.accent}`}>
              {loading ? (
                <div className="h-8 w-12 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
              ) : (
                m.value
              )}
            </div>
            <div className="text-xs text-stone-400 dark:text-stone-500 mt-2">{m.hint}</div>
          </div>
        ))}
      </div>

      {/* Health Score Breakdown — Explainable */}
      {!loading && totalBugs > 0 && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base text-stone-900 dark:text-white">Project Health Score</h2>
            <div className="text-3xl font-bold">
              <span className={healthScore >= 70 ? 'text-emerald-600 dark:text-emerald-400' : healthScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}>
                {healthScore}
              </span>
              <span className="text-sm text-stone-400 dark:text-stone-500 font-normal">/100</span>
            </div>
          </div>

          <div className="text-xs text-stone-500 dark:text-stone-400 mb-3">How this score is computed:</div>

          <div className="space-y-2">
            {healthFactors.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <span className="text-xs font-medium text-stone-600 dark:text-stone-400 w-36 shrink-0">{f.label}</span>
                <div className="flex-1 h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${f.positive ? 'bg-emerald-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(100, Math.abs(f.contribution) * 2)}%` }}
                  />
                </div>
                <span className={`text-xs font-bold w-12 text-right ${f.contribution >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {f.contribution >= 0 ? '+' : ''}{f.contribution}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center justify-between">
            <span className="text-xs text-stone-400">50 (base) + factors</span>
            <span className={`text-sm font-bold ${healthScore >= 70 ? 'text-emerald-600 dark:text-emerald-400' : healthScore >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
              HEALTH: {healthScore}
            </span>
          </div>
        </div>
      )}

      {/* Component Health Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-sm overflow-hidden">
        <div className="p-6 pb-3 flex items-center justify-between">
          <h2 className="font-bold text-base text-stone-900 dark:text-white">Component Health</h2>
          {!loading && componentHealth.length > 0 && (
            <span className="text-xs text-stone-400">
              Sorted by volume · Risk follows open vs resolved
            </span>
          )}
        </div>
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4">
                <div className="h-4 w-28 bg-stone-200 dark:bg-stone-800 rounded" />
                <div className="flex-1 h-3 bg-stone-200 dark:bg-stone-800 rounded" />
                <div className="h-4 w-12 bg-stone-200 dark:bg-stone-800 rounded" />
              </div>
            ))}
          </div>
        ) : componentHealth.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-stone-50 dark:bg-stone-800 text-stone-400 flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-7 h-7">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <p className="text-sm font-medium text-stone-500 dark:text-stone-400">
              No component data found
            </p>
            <p className="text-xs text-stone-400 mt-1">
              Components will appear here once bugs are assigned to them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#eee9e2] dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30">
                  <th className="py-3 px-6 font-semibold text-stone-400 uppercase tracking-wider">Component</th>
                  <th className="py-3 px-4 font-semibold text-stone-400 uppercase tracking-wider text-center">Total</th>
                  <th className="py-3 px-4 font-semibold text-stone-400 uppercase tracking-wider text-center">Open</th>
                  <th className="py-3 px-4 font-semibold text-stone-400 uppercase tracking-wider text-center">Resolved</th>
                  <th className="py-3 px-4 font-semibold text-stone-400 uppercase tracking-wider min-w-[140px]">% Resolved</th>
                  <th className="py-3 px-6 font-semibold text-stone-400 uppercase tracking-wider text-center">Risk</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9e2] dark:divide-stone-800">
                {componentHealth.map((c) => (
                  <tr key={c.name} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors">
                    <td className="py-3.5 px-6">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                        <span className="font-medium text-stone-900 dark:text-white">{c.name}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-stone-700 dark:text-stone-300">{c.bugs}</td>
                    <td className="py-3.5 px-4 text-center text-stone-700 dark:text-stone-300">{c.open}</td>
                    <td className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400">{c.resolved}</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                          />
                        </div>
                        <span className="w-9 text-right font-semibold text-stone-600 dark:text-stone-300">{c.pct}%</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        c.risk === 'High' ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                        : c.risk === 'Medium' ? 'bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400'
                        : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400'
                      }`}>
                        {c.risk}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}