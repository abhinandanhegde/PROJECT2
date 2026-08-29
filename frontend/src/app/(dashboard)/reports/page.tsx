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
  risk: 'High' | 'Medium' | 'Low'
  color: string
}

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
        const [projRes, statsRes] = await Promise.allSettled([
          api.getProjects(),
          api.getDashboardStats(),
        ])

        const projects = projRes.status === 'fulfilled' ? projRes.value?.data || [] : []
        const stats = statsRes.status === 'fulfilled' ? statsRes.value : null

        if (stats) {
          setTotalBugs(stats.total_bugs_reported || 0)
          setOpenBugs(stats.open_assigned || 0)
        }

        // Build component health from bugs across projects
        const componentMap = new Map<string, { total: number; resolved: number; open: number }>()
        let totalResolved = 0

        // Process projects in parallel
        const projectResults = await Promise.allSettled(
          projects.map(async (proj: Project) => {
            const [bugRes, compRes] = await Promise.allSettled([
              api.getBugs(proj.id, { per_page: '200' }),
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

          bugs.forEach((bug: Bug) => {
            const compName = components.find((c: Component) => c.id === bug.component_id)?.name || 'Uncategorized'
            const existing = componentMap.get(compName) || { total: 0, resolved: 0, open: 0 }
            existing.total++
            if (['RESOLVED', 'VERIFIED', 'CLOSED'].includes(bug.status)) {
              existing.resolved++
              totalResolved++
            } else {
              existing.open++
            }
            componentMap.set(compName, existing)
          })
        }

        setResolvedBugs(totalResolved)

        // Convert to ComponentHealth array
        const healthList: ComponentHealth[] = Array.from(componentMap.entries())
          .map(([name, data]): ComponentHealth => ({
            name,
            bugs: data.total,
            open: data.open,
            resolved: data.resolved,
            risk: (data.open > data.resolved ? 'High' : data.open > 0 ? 'Medium' : 'Low') as ComponentHealth['risk'],
            color: data.open > data.resolved ? 'bg-red-500' : data.open > 0 ? 'bg-orange-500' : 'bg-emerald-500',
          }))
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
          Component health breakdown and project summaries.
        </p>
      </div>

      {/* Component Health Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-sm overflow-hidden">
        <div className="p-6 pb-3">
          <h2 className="font-bold text-base text-stone-900 dark:text-white">Component Health</h2>
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
          <div className="p-6 text-center text-xs text-stone-400">
            No component data found. Components will appear here once bugs are assigned to components.
          </div>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#eee9e2] dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30">
                <th className="py-3 px-6 font-semibold text-stone-400 uppercase tracking-wider">Component</th>
                <th className="py-3 px-4 font-semibold text-stone-400 uppercase tracking-wider text-center">Total</th>
                <th className="py-3 px-4 font-semibold text-stone-400 uppercase tracking-wider text-center">Open</th>
                <th className="py-3 px-4 font-semibold text-stone-400 uppercase tracking-wider text-center">Resolved</th>
                <th className="py-3 px-4 font-semibold text-stone-400 uppercase tracking-wider text-center">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eee9e2] dark:divide-stone-800">
              {componentHealth.map((c) => (
                <tr key={c.name} className="hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors">
                  <td className="py-3.5 px-6 font-medium text-stone-900 dark:text-white">{c.name}</td>
                  <td className="py-3.5 px-4 text-center font-semibold text-stone-700 dark:text-stone-300">{c.bugs}</td>
                  <td className="py-3.5 px-4 text-center text-stone-700 dark:text-stone-300">{c.open}</td>
                  <td className="py-3.5 px-4 text-center text-emerald-600 dark:text-emerald-400">{c.resolved}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
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
        )}
      </div>

      {/* Summary Cards */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
        <h2 className="font-bold text-base text-stone-900 dark:text-white mb-4">Project Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">
              {loading ? '—' : totalBugs}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Total Bugs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {loading ? '—' : openBugs}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Currently Assigned</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {loading ? '—' : resolvedBugs}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">
              {loading ? '—' : componentHealth.length}
            </div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Components</div>
          </div>
        </div>
      </div>
    </div>
  )
}
