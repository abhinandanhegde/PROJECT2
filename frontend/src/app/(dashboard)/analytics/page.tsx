'use client'

import React from 'react'
import Link from 'next/link'

export default function AnalyticsPage() {
  const metrics = [
    { label: 'Mean Time to Resolve', value: '3.2 days', change: '-18%', positive: true },
    { label: 'Bugs per Sprint', value: '24', change: '+5%', positive: false },
    { label: 'First Response Time', value: '4.5 hrs', change: '-22%', positive: true },
    { label: 'Reopen Rate', value: '8%', change: '-3%', positive: true },
  ]

  const severityDistribution = [
    { name: 'BLOCKER', count: 3, pct: 5, color: 'bg-red-600' },
    { name: 'CRITICAL', count: 12, pct: 20, color: 'bg-red-400' },
    { name: 'MAJOR', count: 18, pct: 30, color: 'bg-orange-500' },
    { name: 'NORMAL', count: 20, pct: 33, color: 'bg-blue-400' },
    { name: 'MINOR', count: 6, pct: 10, color: 'bg-stone-400' },
    { name: 'TRIVIAL', count: 1, pct: 2, color: 'bg-stone-300' },
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
          Key metrics and trends across your bug tracking pipeline.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-white dark:bg-stone-900 rounded-2xl p-5 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
            <div className="text-xs font-medium text-stone-500 dark:text-stone-400">{m.label}</div>
            <div className="text-2xl font-bold text-stone-900 dark:text-white mt-2">{m.value}</div>
            <div className={`text-xs font-semibold mt-2 ${m.positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {m.change} vs last month
            </div>
          </div>
        ))}
      </div>

      {/* Severity Distribution */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
        <h2 className="font-bold text-base text-stone-900 dark:text-white mb-4">Severity Distribution</h2>
        <div className="space-y-3">
          {severityDistribution.map((s) => (
            <div key={s.name} className="flex items-center gap-3">
              <span className="w-20 text-xs font-semibold text-stone-600 dark:text-stone-400">{s.name}</span>
              <div className="flex-1 h-3 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
              </div>
              <span className="w-12 text-right text-xs text-stone-500 dark:text-stone-400">{s.count}</span>
              <span className="w-10 text-right text-xs font-semibold text-stone-700 dark:text-stone-300">{s.pct}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
