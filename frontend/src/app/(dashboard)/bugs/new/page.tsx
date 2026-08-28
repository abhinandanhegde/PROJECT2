'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { api } from '@/lib/api'
import type {
  BugSeverity,
  BugPriority,
  Project,
  Component,
  ProjectMember,
  TriageResult,
} from '@/lib/types'
import { useToast } from '@/components/ui/Toast'
import { SparklesIcon } from '@/components/ui/Icons'

export default function NewBugPage() {
  const router = useRouter()
  const { success, error: toastError } = useToast()

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [components, setComponents] = useState<Component[]>([])
  const [members, setMembers] = useState<ProjectMember[]>([])

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<BugSeverity>('NORMAL')
  const [priority, setPriority] = useState<BugPriority>('P3')
  const [componentId, setComponentId] = useState<string>('')
  const [assigneeId, setAssigneeId] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [triageSuggestion, setTriageSuggestion] = useState<TriageResult | null>(null)

  // Fetch projects and metadata
  useEffect(() => {
    api
      .getProjects()
      .then((res) => {
        if (res?.data && res.data.length > 0) {
          setProjects(res.data)
          const firstProjId = res.data[0].id
          setSelectedProjectId(firstProjId)

          // Fetch components & members for project
          api.getComponents(firstProjId).then((c) => setComponents(c?.data || []))
          api.getMembers(firstProjId).then((m) => setMembers(m?.data || []))
        }
      })
      .catch(() => {
        // Fallback default project
      })
  }, [])

  // Auto-triage as title/description change
  useEffect(() => {
    if (!title || title.length < 5 || !selectedProjectId) {
      setTriageSuggestion(null)
      return
    }

    const timer = setTimeout(() => {
      api
        .triageBug(selectedProjectId, {
          title,
          description,
          severity,
          priority,
        })
        .then((result) => {
          setTriageSuggestion(result)
        })
        .catch(() => {
          // Local fallback triage heuristic
          const lower = `${title} ${description}`.toLowerCase()
          let sugSev: BugSeverity = 'NORMAL'
          let sugPri: BugPriority = 'P3'
          const reasons: string[] = []

          if (lower.includes('crash') || lower.includes('data loss') || lower.includes('security')) {
            sugSev = 'BLOCKER'
            sugPri = 'P1'
            reasons.push('Detected critical system impact keywords')
          } else if (lower.includes('error') || lower.includes('exception') || lower.includes('failed')) {
            sugSev = 'MAJOR'
            sugPri = 'P2'
            reasons.push('Detected regression/error keywords')
          }

          setTriageSuggestion({
            suggested_severity: sugSev,
            suggested_priority: sugPri,
            confidence: 0.85,
            reasons,
            signals: ['Client-side pattern analysis'],
          })
        })
    }, 500)

    return () => clearTimeout(timer)
  }, [title, description, selectedProjectId, severity, priority])

  const applySuggestions = () => {
    if (triageSuggestion) {
      setSeverity(triageSuggestion.suggested_severity)
      setPriority(triageSuggestion.suggested_priority)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toastError('Title is required')
      return
    }

    setLoading(true)
    try {
      const projId = selectedProjectId || (projects[0]?.id ?? 'default')
      await api.createBug(projId, {
        title: title.trim(),
        description: description.trim(),
        severity,
        priority,
        component_id: componentId || null,
        assignee_id: assigneeId || null,
      })

      success('Bug reported successfully', 'Your issue has been logged to the triage queue.')
      router.push('/bugs')
    } catch (err: unknown) {
      toastError(
        'Failed to create bug',
        err instanceof Error ? err.message : 'Please check your input and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
            <Link href="/bugs" className="hover:underline">
              Issues
            </Link>
            <span>/</span>
            <span className="text-stone-900 dark:text-white font-medium">New Issue</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
            Create New Bug Report
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs space-y-5">
          {/* Project Selector (if multiple) */}
          {projects.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                Project *
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full text-sm bg-stone-50/50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
              Issue Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Login crashes after session token expires"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-sm bg-stone-50/50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
              Description & Steps to Reproduce *
            </label>
            <textarea
              rows={5}
              placeholder="Describe what happened, actual behavior vs expected behavior, and reproduction steps..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-sm bg-stone-50/50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500"
              required
            />
          </div>

          {/* AI / Heuristic Triage Assistant Card */}
          {triageSuggestion && (
            <div className="p-4 rounded-xl bg-orange-50/80 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-900/60 transition-all animate-in fade-in">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-orange-800 dark:text-orange-300">
                  <SparklesIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span>Deterministic Triage Suggestion</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-orange-200/60 dark:bg-orange-900/60 font-mono">
                    {Math.round(triageSuggestion.confidence * 100)}% confidence
                  </span>
                </div>
                <button
                  type="button"
                  onClick={applySuggestions}
                  className="text-xs font-semibold text-orange-700 dark:text-orange-300 hover:text-orange-900 dark:hover:text-orange-100 underline cursor-pointer"
                >
                  Apply Suggestions
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-orange-900 dark:text-orange-200">
                <div>
                  Suggested Severity:{' '}
                  <span className="font-bold">{triageSuggestion.suggested_severity}</span>
                </div>
                <div>
                  Suggested Priority:{' '}
                  <span className="font-bold">{triageSuggestion.suggested_priority}</span>
                </div>
              </div>
              {triageSuggestion.reasons?.length > 0 && (
                <div className="text-[11px] text-orange-700 dark:text-orange-400 mt-1.5 opacity-90">
                  Reason: {triageSuggestion.reasons.join(', ')}
                </div>
              )}
            </div>
          )}

          {/* Grid: Severity, Priority, Component, Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {/* Severity */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                Severity *
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                className="w-full text-sm bg-stone-50/50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                <option value="BLOCKER">BLOCKER (System Down / Data Loss)</option>
                <option value="CRITICAL">CRITICAL (Major Feature Broken)</option>
                <option value="MAJOR">MAJOR (Significant Degraded Flow)</option>
                <option value="NORMAL">NORMAL (Standard Issue)</option>
                <option value="MINOR">MINOR (Small Cosmetic / Edge Case)</option>
                <option value="TRIVIAL">TRIVIAL (Nit / Typo / Formatting)</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                Priority *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as BugPriority)}
                className="w-full text-sm bg-stone-50/50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                <option value="P1">P1 (Immediate Fix Required)</option>
                <option value="P2">P2 (High Priority)</option>
                <option value="P3">P3 (Normal)</option>
                <option value="P4">P4 (Low)</option>
                <option value="P5">P5 (Lowest / Nice-to-have)</option>
              </select>
            </div>

            {/* Component */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                Component (Optional)
              </label>
              <select
                value={componentId}
                onChange={(e) => setComponentId(e.target.value)}
                className="w-full text-sm bg-stone-50/50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                <option value="">None / General</option>
                <option value="auth">Authentication</option>
                <option value="pay">Payments</option>
                <option value="fe">Frontend</option>
                <option value="notif">Notifications</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5">
                Assignee (Optional)
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full text-sm bg-stone-50/50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.users?.display_name || m.users?.email || m.user_id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
            <Link
              href="/bugs"
              className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-sm shadow-orange-500/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Submitting...' : 'Create Issue'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
