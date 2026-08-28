'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Project } from '@/lib/types'

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getProjects()
      .then((res) => setProjects(res?.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <Link href="/" className="hover:underline">Dashboard</Link>
            <span>/</span>
            <span className="text-stone-900 dark:text-white font-medium">Projects</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Projects
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Manage your projects and their team members.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="animate-pulse bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 space-y-3">
              <div className="w-1/3 h-5 bg-stone-200 dark:bg-stone-800 rounded" />
              <div className="w-2/3 h-3 bg-stone-200 dark:bg-stone-800 rounded" />
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-12 text-center border border-[#eee9e2] dark:border-stone-800">
          <h3 className="text-base font-bold text-stone-900 dark:text-white">No projects yet</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Create your first project to start tracking bugs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link key={p.id} href={`/bugs`} className="block bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm hover:border-orange-500/40 dark:hover:border-orange-500/40 transition-all">
              <h3 className="font-bold text-base text-stone-900 dark:text-white">{p.name}</h3>
              {p.description && (
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">{p.description}</p>
              )}
              <div className="text-xs text-stone-400 mt-3">
                Created {new Date(p.created_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
