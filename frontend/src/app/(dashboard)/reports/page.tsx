'use client'

import React from 'react'
import Link from 'next/link'

export default function ReportsPage() {
  const componentHealth = [
    { name: 'Authentication', bugs: 23, risk: 'High', color: 'bg-red-500', resolved: 15, open: 8 },
    { name: 'Payments', bugs: 15, risk: 'Medium', color: 'bg-orange-500', resolved: 10, open: 5 },
    { name: 'Frontend', bugs: 8, risk: 'Low', color: 'bg-emerald-500', resolved: 7, open: 1 },
    { name: 'Notifications', bugs: 5, risk: 'Low', color: 'bg-emerald-500', resolved: 5, open: 0 },
    { name: 'Database', bugs: 4, risk: 'Medium', color: 'bg-orange-500', resolved: 2, open: 2 },
  ]

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
          Component health breakdown and weekly bug summaries.
        </p>
      </div>

      {/* Component Health Table */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-sm overflow-hidden">
        <div className="p-6 pb-3">
          <h2 className="font-bold text-base text-stone-900 dark:text-white">Component Health</h2>
        </div>
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
      </div>

      {/* Weekly Summary Card */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm">
        <h2 className="font-bold text-base text-stone-900 dark:text-white mb-4">This Week Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">18</div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">New Bugs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">12</div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Resolved</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">3</div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Reopened</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">2.4d</div>
            <div className="text-xs text-stone-500 dark:text-stone-400 mt-1">Avg Resolution</div>
          </div>
        </div>
      </div>
    </div>
  )
}
