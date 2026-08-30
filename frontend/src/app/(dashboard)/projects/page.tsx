'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Project } from '@/lib/types'

interface ProjectStats {
  total_bugs: number
  open_bugs: number
  closed_bugs: number
  resolved_bugs: number
  bugs_by_severity: Record<string, number>
  bugs_by_priority: Record<string, number>
  bugs_by_status: Record<string, number>
  recent_activity: number
  member_count: number
}

interface ProjectWithStats extends Project {
  stats?: ProjectStats
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    setLoading(true)
    try {
      const res = await api.getProjects()
      const projs: Project[] = res?.data || []

      // Server-computed stats (single authoritative source): total/open/resolved,
      // member count and 7-day activity straight from the database.
      const statsRows = await Promise.all(
        projs.map((p) =>
          api
            .getProjectStats(p.id)
            .then((s) => ({ id: p.id, stats: s as ProjectStats }))
            .catch(() => null)
        )
      )
      const statsById = new Map(
        statsRows.filter((r): r is { id: string; stats: ProjectStats } => Boolean(r)).map((r) => [r.id, r.stats])
      )

      setProjects(projs.map((p) => ({ ...p, stats: statsById.get(p.id) })))
    } catch {
      // Silent fail
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await api.createProject({ name: newName.trim(), description: newDesc.trim() || undefined })
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      loadProjects()
    } catch {
      // Silent fail
    } finally {
      setCreating(false)
    }
  }

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
            Manage your projects, view health, and track team activity.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-md shadow-orange-500/20 transition-colors cursor-pointer"
        >
          {showCreate ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {/* Create Project Form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">Project Name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="My Awesome Project"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1">Description (optional)</label>
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="A brief description of the project"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800 text-sm text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-md transition-colors disabled:opacity-50 cursor-pointer"
            >
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      )}

      {/* Project Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="animate-pulse bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 space-y-3">
              <div className="w-1/3 h-5 bg-stone-200 dark:bg-stone-800 rounded" />
              <div className="w-2/3 h-3 bg-stone-200 dark:bg-stone-800 rounded" />
              <div className="flex gap-4 mt-4">
                <div className="h-8 w-16 bg-stone-200 dark:bg-stone-800 rounded" />
                <div className="h-8 w-16 bg-stone-200 dark:bg-stone-800 rounded" />
                <div className="h-8 w-16 bg-stone-200 dark:bg-stone-800 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-12 text-center border border-[#eee9e2] dark:border-stone-800">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white">No projects yet</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 mb-4">Create your first project to start tracking bugs.</p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold transition-colors cursor-pointer"
          >
            + Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const s = p.stats
            const total = s?.total_bugs ?? 0
            const open = s?.open_bugs ?? 0
            const resolved = s?.resolved_bugs ?? 0
            const members = s?.member_count ?? 0
            const recent = s?.recent_activity ?? 0
            const health = total > 0 ? Math.round((resolved / total) * 100) : null
            const healthColor =
              health === null
                ? 'text-stone-400'
                : health >= 70
                  ? 'text-emerald-600'
                  : health >= 40
                    ? 'text-amber-600'
                    : 'text-red-600'

            return (
              <Link
                key={p.id}
                href="/bugs"
                className="block bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm hover:border-orange-500/40 dark:hover:border-orange-500/40 transition-all group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base text-stone-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                      {p.name}
                    </h3>
                    {p.description && (
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">{p.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className={`text-lg font-bold ${healthColor}`}>
                      {health === null ? '—' : `${health}%`}
                    </div>
                    <div className="text-[10px] text-stone-400 uppercase tracking-wider">Health</div>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 mt-4 pt-3 border-t border-stone-100 dark:border-stone-800">
                  <div className="text-center">
                    <div className="text-sm font-bold text-stone-900 dark:text-white">{total}</div>
                    <div className="text-[10px] text-stone-400">Issues</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-orange-600 dark:text-orange-400">{open}</div>
                    <div className="text-[10px] text-stone-400">Open</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{resolved}</div>
                    <div className="text-[10px] text-stone-400">Resolved</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-bold text-stone-900 dark:text-white">{members}</div>
                    <div className="text-[10px] text-stone-400">Members</div>
                  </div>
                </div>

                <div className="text-xs text-stone-400 mt-3">
                  {total > 0
                    ? `${recent} activity events this week · created ${new Date(p.created_at).toLocaleDateString()}`
                    : `No issues yet · created ${new Date(p.created_at).toLocaleDateString()}`}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}