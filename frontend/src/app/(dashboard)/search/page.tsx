'use client'

import React, { useState, useEffect, Suspense, useMemo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Bug } from '@/lib/types'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchIcon } from '@/components/ui/Icons'

function SearchContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q') || ''

  const [searchTerm, setSearchTerm] = useState(initialQuery)
  const debouncedTerm = useDebounce(searchTerm, 300)
  const [results, setResults] = useState<Bug[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  // Demo fallback dataset
  const fallbackDataset: Bug[] = useMemo(
    () => [
      {
        id: 'BUG-184',
        project_id: 'default',
        title: 'Login crashes after session expires',
        description:
          'Unhandled promise rejection when auth token expires in user session interceptor.',
        status: 'NEW',
        severity: 'BLOCKER',
        priority: 'P1',
        reporter_id: 'u1',
        reporter_name: 'Alex Johnson',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'BUG-181',
        project_id: 'default',
        title: 'API returns 500 on payment process',
        description:
          'Stripe webhook signature validation fails on concurrent callback events.',
        status: 'CONFIRMED',
        severity: 'CRITICAL',
        priority: 'P1',
        reporter_id: 'u2',
        reporter_name: 'Mike Ross',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'BUG-178',
        project_id: 'default',
        title: 'UI freezes on dashboard refresh',
        description:
          'Large dataset SVG chart render causes UI jank on safari mobile browser.',
        status: 'IN_PROGRESS',
        severity: 'MAJOR',
        priority: 'P2',
        reporter_id: 'u1',
        reporter_name: 'Alex Johnson',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'BUG-175',
        project_id: 'default',
        title: 'Email notifications not sent',
        description:
          'SMTP connection timeout on worker nodes when sending batch alerts.',
        status: 'NEW',
        severity: 'NORMAL',
        priority: 'P2',
        reporter_id: 'u2',
        reporter_name: 'Mike Ross',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    []
  )

  useEffect(() => {
    if (debouncedTerm.trim()) {
      // Sync URL
      router.replace(`/search?q=${encodeURIComponent(debouncedTerm.trim())}`)
      setLoading(true)
      setHasSearched(true)

      api
        .searchBugs(debouncedTerm.trim())
        .then((res) => {
          if (res?.data && res.data.length > 0) {
            setResults(res.data)
          } else {
            // Search locally on fallback
            const term = debouncedTerm.toLowerCase()
            const filtered = fallbackDataset.filter(
              (b) =>
                b.title.toLowerCase().includes(term) ||
                b.id.toLowerCase().includes(term) ||
                (b.description && b.description.toLowerCase().includes(term))
            )
            setResults(filtered)
          }
        })
        .catch(() => {
          const term = debouncedTerm.toLowerCase()
          const filtered = fallbackDataset.filter(
            (b) =>
              b.title.toLowerCase().includes(term) ||
              b.id.toLowerCase().includes(term) ||
              (b.description && b.description.toLowerCase().includes(term))
          )
          setResults(filtered)
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setResults([])
      setHasSearched(false)
      router.replace('/search')
    }
  }, [debouncedTerm, router, fallbackDataset])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          Search Bugs & Knowledge
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          Instant keyword search across all bug titles, descriptions, and error codes
        </p>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-stone-400">
          <SearchIcon className="w-5 h-5" />
        </div>
        <input
          type="text"
          placeholder="Search by keyword, error code, component, or title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          className="w-full pl-12 pr-4 py-3.5 text-base bg-white dark:bg-stone-900 border border-[#eee9e2] dark:border-stone-800 rounded-2xl shadow-2xs focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 text-stone-900 dark:text-white placeholder-stone-400 transition-all"
        />
      </div>

      {/* Search Results */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="animate-pulse bg-white dark:bg-stone-900 p-5 rounded-2xl border border-[#eee9e2] dark:border-stone-800 space-y-2"
            >
              <div className="w-24 h-4 bg-stone-200 dark:bg-stone-800 rounded" />
              <div className="w-2/3 h-5 bg-stone-200 dark:bg-stone-800 rounded" />
              <div className="w-full h-4 bg-stone-200 dark:bg-stone-800 rounded" />
            </div>
          ))}
        </div>
      ) : hasSearched && results.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-12 text-center border border-[#eee9e2] dark:border-stone-800">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-3">
            <SearchIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white">
            No matching issues found
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
            We couldn&apos;t find any issues matching &ldquo;{debouncedTerm}&rdquo;. Try using different terms or check for typos.
          </p>
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-3">
          <div className="text-xs font-semibold text-stone-500 dark:text-stone-400 px-1">
            Found {results.length} matching {results.length === 1 ? 'issue' : 'issues'}:
          </div>
          {results.map((bug) => (
            <Link
              key={bug.id}
              href={`/bugs/${bug.id}`}
              className="block bg-white dark:bg-stone-900 p-5 rounded-2xl border border-[#eee9e2] dark:border-stone-800 hover:border-orange-500/40 dark:hover:border-orange-500/40 shadow-2xs transition-all group cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="font-mono text-xs font-bold text-orange-600 dark:text-orange-400 group-hover:underline">
                  {bug.id}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
                  {bug.status}
                </span>
              </div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                {bug.title}
              </h3>
              {bug.description && (
                <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-1">
                  {bug.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-xs text-stone-400">
          Type above to search through all issues and error reports.
        </div>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading search...</div>}>
      <SearchContent />
    </Suspense>
  )
}
