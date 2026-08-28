'use client'

import React from 'react'
import Link from 'next/link'

export default function TeamsPage() {
  const teamMembers = [
    { name: 'Rahul Sharma', role: 'Developer', issues: 18, avatar: 'RS' },
    { name: 'Priya Singh', role: 'Developer', issues: 12, avatar: 'PS' },
    { name: 'Mike Ross', role: 'QA', issues: 8, avatar: 'MR' },
    { name: 'Alex Johnson', role: 'Admin', issues: 6, avatar: 'AJ' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <Link href="/" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span className="text-stone-900 dark:text-white font-medium">Teams</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Team Members
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          View team workload and current bug assignments.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {teamMembers.map((m) => (
          <div key={m.name} className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm text-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-700 to-stone-500 text-white flex items-center justify-center font-bold text-sm mx-auto">
              {m.avatar}
            </div>
            <h3 className="font-bold text-sm text-stone-900 dark:text-white mt-3">{m.name}</h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{m.role}</p>
            <div className="mt-3 text-2xl font-bold text-stone-900 dark:text-white">{m.issues}</div>
            <div className="text-xs text-stone-400">assigned issues</div>
          </div>
        ))}
      </div>
    </div>
  )
}
