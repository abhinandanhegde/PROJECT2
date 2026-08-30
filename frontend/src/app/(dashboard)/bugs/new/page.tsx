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

const STEPS = ['What', 'Classify', 'Assign', 'Review']

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

  const [step, setStep] = useState(0)
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

  const handleProjectChange = (projId: string) => {
    setSelectedProjectId(projId)
    setComponentId('')
    setAssigneeId('')
    api.getComponents(projId).then((c) => setComponents(c?.data || []))
    api.getMembers(projId).then((m) => setMembers(m?.data || []))
  }

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

  const canProceed = (): boolean => {
    if (step === 0) return title.trim().length > 0 && description.trim().length > 0
    return true
  }

  const next = () => {
    if (!selectedProjectId && !projects[0]?.id) {
      toastError('No project available', 'Refresh the page or create/join a project before reporting a bug.')
      return
    }
    if (!canProceed()) {
      toastError('Please fill in the title and description before continuing')
      return
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const back = () => setStep((s) => Math.max(s - 1, 0))

  const handleSubmit = async () => {
    if (!title.trim()) {
      toastError('Title is required')
      return
    }

    const projId = selectedProjectId || projects[0]?.id
    if (!projId) {
      toastError('No project available', 'Refresh the page or create/join a project before reporting a bug.')
      return
    }

    setLoading(true)
    try {
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

  const severityLabel: Record<BugSeverity, string> = {
    BLOCKER: 'System Down / Data Loss',
    CRITICAL: 'Major Feature Broken',
    MAJOR: 'Significant Degraded Flow',
    NORMAL: 'Standard Issue',
    MINOR: 'Small Cosmetic / Edge Case',
    TRIVIAL: 'Nit / Typo / Formatting',
  }

  const priorityLabel: Record<BugPriority, string> = {
    P1: 'Immediate Fix Required',
    P2: 'High Priority',
    P3: 'Normal',
    P4: 'Low',
    P5: 'Lowest / Nice-to-have',
  }

  const currentComponent = components.find((c) => c.id === componentId)
  const currentAssignee = members.find((m) => m.user_id === assigneeId)
  const currentProject = projects.find((p) => p.id === selectedProjectId)

  const inputCls =
    'w-full text-sm bg-stone-50/50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-xl px-3.5 py-2.5 text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500'
  const labelCls =
    'block text-xs font-semibold text-stone-700 dark:text-stone-300 uppercase tracking-wider mb-1.5'

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
            Report a Bug
          </h1>
        </div>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-between max-w-xl mx-auto">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            {i > 0 && (
              <div
                className={`h-0.5 flex-1 mx-2 rounded-full transition-colors ${
                  i <= step ? 'bg-orange-500' : 'bg-stone-200 dark:bg-stone-700'
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => i <= step && setStep(i)}
              disabled={i > step}
              className={`flex flex-col items-center gap-1.5 ${
                i <= step ? 'cursor-pointer' : 'cursor-default'
              }`}
            >
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step
                    ? 'bg-orange-500 text-white'
                    : i === step
                      ? 'bg-orange-100 dark:bg-orange-900/60 text-orange-700 dark:text-orange-300 ring-2 ring-orange-500'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-600'
                }`}
              >
                {i < step ? '✓' : i + 1}
              </span>
              <span
                className={`text-[11px] font-medium ${
                  i === step
                    ? 'text-stone-900 dark:text-white'
                    : 'text-stone-400 dark:text-stone-600'
                }`}
              >
                {label}
              </span>
            </button>
          </React.Fragment>
        ))}
      </div>

      <div className="bg-white dark:bg-stone-900 p-6 sm:p-8 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs space-y-5">
        {/* ── Step 1: What happened? ─────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                What happened?
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Tell us about the issue you encountered. A clear description helps triage it faster.
              </p>
            </div>

            {projects.length > 1 && (
              <div>
                <label className={labelCls}>Project *</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  className={inputCls}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Issue Title *</label>
              <input
                type="text"
                placeholder="e.g. Login crashes after session token expires"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>Description & Steps to Reproduce *</label>
              <textarea
                rows={6}
                placeholder="What did you expect to happen? What actually happened? How can we reproduce it (steps, environment, inputs)?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls}
              />
              <p className="text-xs text-stone-400 dark:text-stone-600 mt-1.5">
                Tip: mention expected vs actual behavior and numbered reproduction steps.
              </p>
            </div>
          </div>
        )}

        {/* ── Step 2: Classify ───────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                Classify the issue
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Set severity and priority so the team knows what to tackle first.
              </p>
            </div>

            {/* Triage Assistant Card */}
            {triageSuggestion ? (
              <div className="p-4 rounded-xl bg-orange-50/80 dark:bg-orange-950/40 border border-orange-200/80 dark:border-orange-900/60 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-orange-800 dark:text-orange-300">
                    <SparklesIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                    <span>Deterministic Triage Suggestion</span>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-orange-200/60 dark:bg-orange-900/60 font-mono">
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
                  <div className="text-xs text-orange-700 dark:text-orange-400 mt-1.5 opacity-90">
                    Reason: {triageSuggestion.reasons.join(', ')}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/60 border border-stone-200 dark:border-stone-700 text-xs text-stone-500 dark:text-stone-400">
                Fill in a longer title or description on step 1 to get a triage suggestion.
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Severity *</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as BugSeverity)}
                  className={inputCls}
                >
                  <option value="BLOCKER">BLOCKER ({severityLabel.BLOCKER})</option>
                  <option value="CRITICAL">CRITICAL ({severityLabel.CRITICAL})</option>
                  <option value="MAJOR">MAJOR ({severityLabel.MAJOR})</option>
                  <option value="NORMAL">NORMAL ({severityLabel.NORMAL})</option>
                  <option value="MINOR">MINOR ({severityLabel.MINOR})</option>
                  <option value="TRIVIAL">TRIVIAL ({severityLabel.TRIVIAL})</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Priority *</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as BugPriority)}
                  className={inputCls}
                >
                  <option value="P1">P1 ({priorityLabel.P1})</option>
                  <option value="P2">P2 ({priorityLabel.P2})</option>
                  <option value="P3">P3 ({priorityLabel.P3})</option>
                  <option value="P4">P4 ({priorityLabel.P4})</option>
                  <option value="P5">P5 ({priorityLabel.P5})</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Assign ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                Assign & attach context
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Point the issue at the right component and team member.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Component (Optional)</label>
                <select
                  value={componentId}
                  onChange={(e) => setComponentId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">None / General</option>
                  {components.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Assignee (Optional)</label>
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  className={inputCls}
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
          </div>
        )}

        {/* ── Step 4: Review & Submit ────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div>
              <h2 className="text-lg font-bold text-stone-900 dark:text-white">
                Review & submit
              </h2>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Double-check the report before it enters the triage queue.
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
              <div className="px-4 py-3 bg-stone-50 dark:bg-stone-800/60 text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                Issue Summary
              </div>
              <dl className="divide-y divide-stone-100 dark:divide-stone-800">
                <div className="px-4 py-3 flex justify-between gap-4 text-sm">
                  <dt className="text-stone-500 dark:text-stone-400 shrink-0">Project</dt>
                  <dd className="text-stone-900 dark:text-white text-right font-medium">
                    {currentProject?.name || 'No project selected'}
                  </dd>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4 text-sm">
                  <dt className="text-stone-500 dark:text-stone-400 shrink-0">Title</dt>
                  <dd className="text-stone-900 dark:text-white text-right font-medium">
                    {title.trim()}
                  </dd>
                </div>
                <div className="px-4 py-3 text-sm">
                  <dt className="text-stone-500 dark:text-stone-400 mb-1">Description</dt>
                  <dd className="text-stone-900 dark:text-white whitespace-pre-wrap">
                    {description.trim()}
                  </dd>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4 text-sm">
                  <dt className="text-stone-500 dark:text-stone-400 shrink-0">Severity</dt>
                  <dd className="text-stone-900 dark:text-white font-medium">
                    {severity} <span className="text-stone-400">— {severityLabel[severity]}</span>
                  </dd>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4 text-sm">
                  <dt className="text-stone-500 dark:text-stone-400 shrink-0">Priority</dt>
                  <dd className="text-stone-900 dark:text-white font-medium">
                    {priority} <span className="text-stone-400">— {priorityLabel[priority]}</span>
                  </dd>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4 text-sm">
                  <dt className="text-stone-500 dark:text-stone-400 shrink-0">Component</dt>
                  <dd className="text-stone-900 dark:text-white text-right">
                    {currentComponent?.name || 'None / General'}
                  </dd>
                </div>
                <div className="px-4 py-3 flex justify-between gap-4 text-sm">
                  <dt className="text-stone-500 dark:text-stone-400 shrink-0">Assignee</dt>
                  <dd className="text-stone-900 dark:text-white text-right">
                    {currentAssignee?.users?.display_name || 'Unassigned'}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
          {step > 0 ? (
            <button
              type="button"
              onClick={back}
              className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              ← Back
            </button>
          ) : (
            <Link
              href="/bugs"
              className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
            >
              Cancel
            </Link>
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={next}
              className="px-6 py-2.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-sm shadow-orange-500/20 transition-colors cursor-pointer"
            >
              Continue →
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold shadow-sm shadow-orange-500/20 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? 'Submitting...' : 'Create Issue'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
