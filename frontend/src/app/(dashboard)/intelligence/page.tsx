'use client'

import React, { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Bug, TriageResult, DuplicateResult, RiskResult } from '@/lib/types'
import { bugRef } from '@/lib/types'

interface IntelState {
  bugs: Bug[]
  triage: Map<string, TriageResult>
  duplicates: Map<string, DuplicateResult>
  risks: Map<string, RiskResult>
  impact: { criticalPath: string[]; totalBlocking: number; nodes: Record<string, { unblocked: number; blockedBy: number; isCritical: boolean }> }
  loading: boolean
}

export default function IntelligencePage() {
  const [state, setState] = useState<IntelState>({
    bugs: [],
    triage: new Map(),
    duplicates: new Map(),
    risks: new Map(),
    impact: { criticalPath: [], totalBlocking: 0, nodes: {} },
    loading: true,
  })

  const loadAll = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }))

    try {
      const [projRes, graphRes] = await Promise.allSettled([
        api.getProjects(),
        api.getGraph(),
      ])

      const projs = (projRes.status === 'fulfilled' ? (projRes.value as { data?: { id: string }[] })?.data : []) || []
      if (projs.length === 0) { setState((s) => ({ ...s, loading: false })); return }
      const projectId = projs[0].id

      // Extract impact from graph
      const graphData = graphRes.status === 'fulfilled' ? (graphRes.value as Record<string, unknown>) : null
      const impactInfo = {
        criticalPath: (graphData?.impact as Record<string, unknown>)?.critical_path_ids as string[] || [],
        totalBlocking: (graphData?.impact as Record<string, unknown>)?.total_blocking_edges as number || 0,
        nodes: {} as Record<string, { unblocked: number; blockedBy: number; isCritical: boolean }>,
      }
      const graphNodes = (graphData?.data as Record<string, unknown>)?.nodes as Array<Record<string, unknown>> | undefined
      if (graphNodes) {
        const criticalSet = new Set(impactInfo.criticalPath)
        for (const n of graphNodes) {
          impactInfo.nodes[n.id as string] = {
            unblocked: (n.unblocked_count as number) || 0,
            blockedBy: (n.blocked_by_count as number) || 0,
            isCritical: criticalSet.has(n.id as string),
          }
        }
      }

      // Get all bugs (1 call)
      const bugsRes = await api.getBugs(projectId, { per_page: '100' }).catch(() => null)
      const bugs = (bugsRes?.data as Bug[]) || []

      if (bugs.length === 0) {
        setState({ bugs: [], triage: new Map(), duplicates: new Map(), risks: new Map(), impact: impactInfo, loading: false })
        return
      }

      // Run ALL intelligence in parallel — triage + duplicates + risk for top 8 bugs
      const topBugs = bugs.slice(0, 8)

      const [triageResults, dupResults, riskResults] = await Promise.all([
        Promise.allSettled(
          topBugs.map((b) =>
            api.triage(projectId, { title: b.title, description: b.description, severity: b.severity, priority: b.priority })
          )
        ),
        Promise.allSettled(
          topBugs.map((b) =>
            api.findDuplicates(projectId, { title: b.title, description: b.description, threshold: 0.3, limit: 3 })
          )
        ),
        Promise.allSettled(
          topBugs.map((b) =>
            api.analyzeRisk(projectId, b.id)
          )
        ),
      ])

      const triageMap = new Map<string, TriageResult>()
      const dupMap = new Map<string, DuplicateResult>()
      const riskMap = new Map<string, RiskResult>()

      topBugs.forEach((b, i) => {
        if (triageResults[i].status === 'fulfilled') triageMap.set(b.id, triageResults[i].value as TriageResult)
        if (dupResults[i].status === 'fulfilled') {
          const dupResult = dupResults[i].value as DuplicateResult
          if (dupResult.candidates && dupResult.candidates.length > 0) dupMap.set(b.id, dupResult)
        }
        if (riskResults[i].status === 'fulfilled') riskMap.set(b.id, riskResults[i].value as RiskResult)
      })

      setState({ bugs, triage: triageMap, duplicates: dupMap, risks: riskMap, impact: impactInfo, loading: false })
    } catch {
      setState((s) => ({ ...s, loading: false }))
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  if (state.loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-stone-200 dark:bg-stone-800 rounded animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-64 bg-stone-100 dark:bg-stone-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const bugsWithTriage = state.bugs.filter((b) => state.triage.has(b.id))
  const bugsWithDups = state.bugs.filter((b) => state.duplicates.has(b.id))
  const bugsWithRisk = state.bugs.filter((b) => state.risks.has(b.id))

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel?.toUpperCase()) {
      case 'CRITICAL': case 'HIGH': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50'
      case 'MEDIUM': return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50'
      case 'LOW': case 'MINIMAL': return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50'
      default: return 'text-stone-500 dark:text-stone-400 bg-stone-100 dark:bg-stone-800'
    }
  }

  const getSevDotColor = (sev: string) => {
    switch (sev) {
      case 'BLOCKER': case 'CRITICAL': return '#ef4444'
      case 'MAJOR': return '#f97316'
      case 'NORMAL': return '#3b82f6'
      default: return '#a8a29e'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
          🧠 Intelligence Center
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          Deterministic triage, duplicate detection, risk analysis — zero AI, instant results
        </p>
      </div>

      {/* Impact Summary Bar */}
      {state.impact.totalBlocking > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30 rounded-2xl p-4 border border-orange-200 dark:border-orange-900/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">⚡</span>
            <h3 className="text-xs font-bold text-orange-800 dark:text-orange-300 uppercase tracking-wider">Impact Analysis</h3>
          </div>
          <div className="flex flex-wrap gap-4 sm:gap-6 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-stone-600 dark:text-stone-400">
                <span className="font-bold text-stone-900 dark:text-white">{state.impact.totalBlocking}</span> blocking edges
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-stone-600 dark:text-stone-400">
                Critical path: <span className="font-bold text-stone-900 dark:text-white">{state.impact.criticalPath.length}</span> bugs
              </span>
            </div>
            {state.impact.criticalPath.length > 0 && (
              <span className="font-mono text-orange-600 dark:text-orange-400">
                {state.impact.criticalPath.map((id) => {
                  const n = state.bugs.find((b) => b.id === id)
                  return n ? bugRef(n) : id.slice(0, 8)
                }).join(' → ')}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Triage Queue ── */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="p-5 pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-stone-900 dark:text-white">🎯 Smart Triage</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-400">
                  {bugsWithTriage.length}
                </span>
              </div>
              <Link href="/bugs" className="text-[10px] text-orange-600 dark:text-orange-400 hover:underline">View all →</Link>
            </div>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-[500px] overflow-y-auto">
            {bugsWithTriage.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">No triage data</div>
            ) : (
              bugsWithTriage.map((bug) => {
                const t = state.triage.get(bug.id)!
                return (
                  <Link key={bug.id} href={`/bugs/${bug.id}`} className="block px-5 py-3 hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: getSevDotColor(t.suggested_severity) }} />
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{bugRef(bug)}</span>
                        <span className="text-xs text-stone-600 dark:text-stone-400 truncate max-w-[200px]">{bug.title}</span>
                      </div>
                      <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400">{Math.round(t.confidence * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.suggested_severity === 'BLOCKER' || t.suggested_severity === 'CRITICAL'
                          ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
                          : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
                      }`}>
                        {t.suggested_severity}
                      </span>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        t.suggested_priority === 'P1' ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400' : 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400'
                      }`}>
                        {t.suggested_priority}
                      </span>
                      {t.reasons.length > 0 && (
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 truncate" title={t.reasons.join(' · ')}>
                          ✓ {t.reasons[0]}{t.reasons.length > 1 && ` +${t.reasons.length - 1}`}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* ── Duplicate Detection ── */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="p-5 pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-stone-900 dark:text-white">🔍 Duplicate Detection</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400">
                  {bugsWithDups.length}
                </span>
              </div>
              <span className="text-[10px] text-stone-400">pg_trgm + Jaccard</span>
            </div>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-[500px] overflow-y-auto">
            {bugsWithDups.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">No duplicates found</div>
            ) : (
              bugsWithDups.map((bug) => {
                const dup = state.duplicates.get(bug.id)!
                return (
                  <div key={bug.id} className="px-5 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{bugRef(bug)}</span>
                      <span className="text-xs text-stone-600 dark:text-stone-400 truncate">{bug.title}</span>
                    </div>
                    <div className="space-y-1 ml-4">
                      {dup.candidates.slice(0, 3).map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px]">
                          <div className="w-16 h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.round(c.similarity * 100)}%` }} />
                          </div>
                          <span className="font-bold text-stone-700 dark:text-stone-300">{Math.round(c.similarity * 100)}%</span>
                          <span className="text-orange-600 dark:text-orange-400 font-bold">{bugRef({ id: c.bug_id } as Bug)}</span>
                          <span className="text-stone-500 dark:text-stone-400 truncate">{c.title}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── Risk Analysis ── */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="p-5 pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-stone-900 dark:text-white">⚠️ Risk Analysis</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400">
                  {bugsWithRisk.length}
                </span>
              </div>
              <span className="text-[10px] text-stone-400">7-factor scoring</span>
            </div>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-[500px] overflow-y-auto">
            {bugsWithRisk.length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">No risk data</div>
            ) : (
              bugsWithRisk.map((bug) => {
                const r = state.risks.get(bug.id)!
                return (
                  <Link key={bug.id} href={`/bugs/${bug.id}`} className="block px-5 py-3 hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{bugRef(bug)}</span>
                        <span className="text-xs text-stone-600 dark:text-stone-400 truncate max-w-[180px]">{bug.title}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${getRiskColor(r.risk_level)}`}>
                          {r.risk_level}
                        </span>
                        <span className="text-xs font-mono font-bold text-stone-900 dark:text-white">{r.risk_score}/100</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden ml-4 mt-1">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${r.risk_score || 0}%`,
                        backgroundColor: (r.risk_score || 0) > 70 ? '#ef4444' : (r.risk_score || 0) > 40 ? '#f97316' : '#22c55e',
                      }} />
                    </div>
                    {r.factors && r.factors.length > 0 && (
                      <div className="flex flex-wrap gap-1 ml-4 mt-1.5">
                        {r.factors.slice(0, 3).map((f, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400" title={f.description}>
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                )
              })
            )}
          </div>
        </div>

        {/* ── Dependency Impact ── */}
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-2xs">
          <div className="p-5 pb-3 border-b border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-stone-900 dark:text-white">🔗 Dependency Impact</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400">
                  {Object.keys(state.impact.nodes).length}
                </span>
              </div>
              <Link href="/graph" className="text-[10px] text-orange-600 dark:text-orange-400 hover:underline">View graph →</Link>
            </div>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800 max-h-[500px] overflow-y-auto">
            {Object.keys(state.impact.nodes).length === 0 ? (
              <div className="p-8 text-center text-xs text-stone-400">No dependency data</div>
            ) : (
              Object.entries(state.impact.nodes)
                .sort(([, a], [, b]) => b.unblocked - a.unblocked)
                .slice(0, 10)
                .map(([id, info]) => {
                  const bug = state.bugs.find((b) => b.id === id)
                  if (!bug) return null
                  return (
                    <Link key={id} href={`/bugs/${id}`} className="block px-5 py-3 hover:bg-stone-50/70 dark:hover:bg-stone-800/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-orange-600 dark:text-orange-400">{bugRef(bug)}</span>
                          <span className="text-xs text-stone-600 dark:text-stone-400 truncate max-w-[200px]">{bug.title}</span>
                          {info.isCritical && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                              ⚡ CRITICAL PATH
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          {info.unblocked > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 font-bold">
                              unblocks {info.unblocked}
                            </span>
                          )}
                          {info.blockedBy > 0 && (
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                              blocked by {info.blockedBy}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  )
                })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
