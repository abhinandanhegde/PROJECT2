'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { ProjectMember, Bug } from '@/lib/types'

interface TeamMemberDisplay {
  userId: string
  name: string
  email: string
  role: string
  assignedBugs: number
  reportedBugs: number
  workload: number
  avatar: string
  projects: string[]
}

// Workload = weighted open assigned work (by priority), so who is carrying the
// most unresolved work is visible at a glance.
const OPEN_STATUSES = new Set(['NEW', 'CONFIRMED', 'IN_PROGRESS', 'REOPENED'])
const PRIORITY_WEIGHT: Record<string, number> = { P1: 5, P2: 4, P3: 3, P4: 2, P5: 1 }

export default function TeamsPage() {
  const [members, setMembers] = useState<TeamMemberDisplay[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const projRes = await api.getProjects().catch(() => null)
        const projects = projRes?.data || []

        const memberMap = new Map<string, TeamMemberDisplay>()

        for (const proj of projects) {
          try {
            const [memRes, bugRes] = await Promise.allSettled([
              api.getMembers(proj.id),
              api.getBugs(proj.id, { per_page: '100' }),
            ])

            const mems: ProjectMember[] = memRes.status === 'fulfilled' ? memRes.value?.data || [] : []
            const bugs: Bug[] = bugRes.status === 'fulfilled' ? bugRes.value?.data || [] : []

            for (const m of mems) {
              const existing = memberMap.get(m.user_id)
              const userName = m.users?.display_name || m.users?.email?.split('@')[0] || 'Unknown'
              const userEmail = m.users?.email || ''
              const initials = userName.split(' ').map((n) => n.charAt(0)).join('').toUpperCase().slice(0, 2)

              // Count bugs assigned and reported by this member; workload from
              // unresolved assigned work weighted by priority.
              const assigned = bugs.filter((b) => b.assignee_id === m.user_id)
              const assignedCount = assigned.length
              const reportedCount = bugs.filter((b) => b.reporter_id === m.user_id).length
              const workload = assigned.reduce(
                (sum, b) =>
                  OPEN_STATUSES.has(b.status) ? sum + (PRIORITY_WEIGHT[b.priority] ?? 1) : sum,
                0
              )

              if (existing) {
                existing.projects.push(proj.name)
                existing.assignedBugs += assignedCount
                existing.reportedBugs += reportedCount
                existing.workload += workload
                const roleOrder = ['REPORTER', 'QA', 'DEVELOPER', 'ADMIN']
                if (roleOrder.indexOf(m.role) > roleOrder.indexOf(existing.role)) {
                  existing.role = m.role
                }
              } else {
                memberMap.set(m.user_id, {
                  userId: m.user_id,
                  name: userName,
                  email: userEmail,
                  role: m.role,
                  assignedBugs: assignedCount,
                  reportedBugs: reportedCount,
                  workload: workload,
                  avatar: initials,
                  projects: [proj.name],
                })
              }
            }
          } catch {
            // Skip failed projects
          }
        }

        setMembers(Array.from(memberMap.values()).sort((a, b) => b.assignedBugs - a.assignedBugs))
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalMembers = members.length
  const totalAssigned = members.reduce((sum, m) => sum + m.assignedBugs, 0)
  const maxWorkload = Math.max(1, ...members.map((m) => m.workload))

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
          View team workload, roles, and bug assignments across all projects.
        </p>
      </div>

      {/* Summary stats */}
      {!loading && members.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">{totalMembers}</div>
            <div className="text-xs text-stone-500 mt-1">Team Members</div>
          </div>
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{totalAssigned}</div>
            <div className="text-xs text-stone-500 mt-1">Total Assigned</div>
          </div>
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">{totalMembers > 0 ? Math.round(totalAssigned / totalMembers) : 0}</div>
            <div className="text-xs text-stone-500 mt-1">Avg per Member</div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm animate-pulse text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-stone-200 dark:bg-stone-800 mx-auto" />
              <div className="h-4 w-24 bg-stone-200 dark:bg-stone-800 rounded mx-auto" />
              <div className="h-3 w-16 bg-stone-200 dark:bg-stone-800 rounded mx-auto" />
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl p-12 text-center border border-[#eee9e2] dark:border-stone-800">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white">No team members yet</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Create a project and add members to see them here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {members.map((m) => {
            const roleColors: Record<string, string> = {
              ADMIN: 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300',
              DEVELOPER: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
              QA: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
              REPORTER: 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
            }

            const workloadPct = m.workload > 0 ? Math.round((m.workload / maxWorkload) * 100) : 0

            return (
              <div key={m.userId} className="bg-white dark:bg-stone-900 rounded-2xl p-6 border border-[#eee9e2] dark:border-stone-800 shadow-sm text-center">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-stone-700 to-stone-500 text-white flex items-center justify-center font-bold text-sm mx-auto">
                  {m.avatar}
                </div>
                <h3 className="font-bold text-sm text-stone-900 dark:text-white mt-3">{m.name}</h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">{m.email}</p>
                <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleColors[m.role] || roleColors.REPORTER}`}>
                  {m.role}
                </span>

                {/* Bug counts */}
                <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-stone-100 dark:border-stone-800">
                  <div>
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{m.assignedBugs}</div>
                    <div className="text-[10px] text-stone-400">Assigned</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{m.reportedBugs}</div>
                    <div className="text-[10px] text-stone-400">Reported</div>
                  </div>
                </div>

                {/* Workload bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-stone-400 mb-1">
                    <span>Workload</span>
                    <span>{workloadPct}%</span>
                  </div>
                  <div className="h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        workloadPct > 40 ? 'bg-red-500' : workloadPct > 20 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.min(workloadPct, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Projects */}
                {m.projects.length > 0 && (
                  <div className="mt-3 flex flex-wrap justify-center gap-1">
                    {m.projects.map((p) => (
                      <span key={p} className="px-2 py-0.5 rounded text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
