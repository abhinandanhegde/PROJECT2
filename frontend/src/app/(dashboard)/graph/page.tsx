'use client'

import React from 'react'
import Link from 'next/link'

export default function GraphPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <Link href="/" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span className="text-stone-900 dark:text-white font-medium">Graph</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Bug Dependency Graph
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          Visualize relationships between bugs — blocks, depends-on, and related issues.
        </p>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-sm p-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-8 h-8">
            <circle cx="6" cy="6" r="3" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="18" cy="18" r="3" />
            <circle cx="6" cy="18" r="3" />
            <line x1="8.5" x2="15.5" y1="7.5" y2="16.5" />
            <line x1="6" x2="6" y1="9" y2="15" />
            <line x1="18" x2="18" y1="9" y2="15" />
          </svg>
        </div>
        <h2 className="text-lg font-bold text-stone-900 dark:text-white mb-2">Dependency Graph</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400 max-w-md mx-auto">
          Interactive node-graph visualization of bug dependencies. See which bugs block others,
          trace regression chains, and identify isolated vs interconnected issues.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">blocks</div>
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">depends_on</div>
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">related_to</div>
        </div>
      </div>
    </div>
  )
}
