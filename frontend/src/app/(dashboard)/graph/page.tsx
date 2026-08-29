'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import type { Bug, Relationship } from '@/lib/types'
import { shortBugId } from '@/lib/types'

interface GraphNode {
  id: string
  title: string
  status: string
  severity: string
  x: number
  y: number
  vx: number
  vy: number
}

interface GraphEdge {
  source: string
  target: string
  type: 'blocks' | 'depends_on' | 'related_to'
}

const STATUS_COLORS: Record<string, string> = {
  NEW: '#ea580c',
  CONFIRMED: '#f59e0b',
  IN_PROGRESS: '#3b82f6',
  RESOLVED: '#10b981',
  VERIFIED: '#6366f1',
  CLOSED: '#6b7280',
  REOPENED: '#ef4444',
}

const EDGE_COLORS: Record<string, string> = {
  blocks: '#ef4444',
  depends_on: '#f59e0b',
  related_to: '#94a3b8',
}

const SEVERITY_COLORS: Record<string, string> = {
  BLOCKER: '#dc2626',
  CRITICAL: '#ef4444',
  MAJOR: '#f97316',
  NORMAL: '#3b82f6',
  MINOR: '#6b7280',
  TRIVIAL: '#a1a1aa',
}

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 900, height: 500 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      setDimensions({ width: rect.width || 900, height: 500 })
    }
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const projRes = await api.getProjects().catch(() => null)
        const projects = projRes?.data || []

        const allNodes: GraphNode[] = []
        const allEdges: GraphEdge[] = []
        const nodeSet = new Set<string>()

        const allBugIds: string[] = []
        for (const proj of projects) {
          try {
            const bugRes = await api.getBugs(proj.id, { per_page: '50' })
            const bugs: Bug[] = bugRes?.data || []

            bugs.forEach((bug) => {
              if (!nodeSet.has(bug.id)) {
                nodeSet.add(bug.id)
                allNodes.push({
                  id: bug.id,
                  title: bug.title,
                  status: bug.status,
                  severity: bug.severity,
                  x: Math.random() * 800 + 50,
                  y: Math.random() * 400 + 50,
                  vx: 0,
                  vy: 0,
                })
                allBugIds.push(bug.id)
              }
            })
          } catch {
            // Skip failed projects
          }
        }

        setNodes(allNodes)

        // Batch-fetch ALL relationships in parallel — not N+1
        const relResults = await Promise.allSettled(
          allBugIds.map((bid) => api.getRelationships(bid))
        )
        const edgeSet = new Set<string>()
        for (const r of relResults) {
          if (r.status !== 'fulfilled') continue
          const rels: Relationship[] = r.value?.data || []
          for (const rel of rels) {
            const key = `${rel.source_bug_id}-${rel.target_bug_id}-${rel.relationship_type}`
            if (!edgeSet.has(key)) {
              edgeSet.add(key)
              allEdges.push({
                source: rel.source_bug_id,
                target: rel.target_bug_id,
                type: rel.relationship_type as GraphEdge['type'],
              })
            }
          }
        }
        setEdges(allEdges)
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Simple force simulation
  useEffect(() => {
    if (nodes.length === 0) return

    let frameId: number
    const currentNodes = [...nodes]
    const edgeList = edges

    // Run for a fixed number of frames then stop
    let frameCount = 0
    function runFrames() {
      if (frameCount > 120) return
      frameCount++
      const { width, height } = dimensions
      const centerX = width / 2
      const centerY = height / 2

      for (let i = 0; i < currentNodes.length; i++) {
        const node = currentNodes[i]
        node.vx += (centerX - node.x) * 0.001
        node.vy += (centerY - node.y) * 0.001
        for (let j = 0; j < currentNodes.length; j++) {
          if (i === j) continue
          const other = currentNodes[j]
          const dx = node.x - other.x
          const dy = node.y - other.y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 2000 / (dist * dist)
          node.vx += (dx / dist) * force
          node.vy += (dy / dist) * force
        }
        for (const edge of edgeList) {
          let other: GraphNode | undefined
          if (edge.source === node.id) other = currentNodes.find((n) => n.id === edge.target)
          if (edge.target === node.id) other = currentNodes.find((n) => n.id === edge.source)
          if (other) {
            const dx = other.x - node.x
            const dy = other.y - node.y
            const dist = Math.sqrt(dx * dx + dy * dy) || 1
            const force = (dist - 120) * 0.005
            node.vx += (dx / dist) * force
            node.vy += (dy / dist) * force
          }
        }
        node.vx *= 0.9
        node.vy *= 0.9
        node.x += node.vx
        node.y += node.vy
        node.x = Math.max(40, Math.min(width - 40, node.x))
        node.y = Math.max(40, Math.min(height - 40, node.y))
      }
      setNodes([...currentNodes])
      frameId = requestAnimationFrame(runFrames)
    }

    frameId = requestAnimationFrame(runFrames)
    return () => cancelAnimationFrame(frameId)
  }, [nodes.length, edges.length, dimensions])

  const handleNodeClick = useCallback((id: string) => {
    setSelectedNode((prev) => (prev === id ? null : id))
  }, [])

  // Filter edges connected to selected node
  const highlightedEdges = selectedNode
    ? edges.filter((e) => e.source === selectedNode || e.target === selectedNode)
    : edges

  const connectedNodeIds = new Set(
    highlightedEdges.flatMap((e) => [e.source, e.target])
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
          <Link href="/" className="hover:underline">Dashboard</Link>
          <span>/</span>
          <span className="text-stone-900 dark:text-white font-medium">Graph</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">
              Bug Dependency Graph
            </h1>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              Interactive visualization of bug relationships — blocks, depends-on, and related issues.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold text-stone-400 uppercase mr-1">Edges:</span>
            <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">blocks</div>
            <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">depends_on</div>
            <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">related_to</div>
            <span className="text-stone-300 mx-1">|</span>
            <span className="text-[10px] font-semibold text-stone-400 uppercase mr-1">Rings:</span>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-red-500" /><span className="text-[10px] text-stone-500">Critical</span></div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-orange-500" /><span className="text-[10px] text-stone-500">Major</span></div>
            <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full border-2 border-blue-500" /><span className="text-[10px] text-stone-500">Normal</span></div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-sm p-12 text-center animate-pulse">
          <div className="h-8 w-48 bg-stone-200 dark:bg-stone-800 rounded mx-auto" />
          <div className="h-4 w-64 bg-stone-200 dark:bg-stone-800 rounded mx-auto mt-4" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-sm p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 dark:bg-orange-950/50 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
              <circle cx="6" cy="6" r="3" />
              <circle cx="18" cy="6" r="3" />
              <circle cx="18" cy="18" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="8.5" x2="15.5" y1="7.5" y2="16.5" />
              <line x1="6" x2="6" y1="9" y2="15" />
              <line x1="18" x2="18" y1="9" y2="15" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-stone-900 dark:text-white">No bugs found</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Create bugs and add relationships to see the dependency graph.
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-[#eee9e2] dark:border-stone-800 shadow-sm overflow-hidden" ref={containerRef}>
          <svg
            width={dimensions.width}
            height={dimensions.height}
            className="w-full cursor-grab active:cursor-grabbing"
            viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
          >
            {/* Edges */}
            {highlightedEdges.map((edge, idx) => {
              const source = nodes.find((n) => n.id === edge.source)
              const target = nodes.find((n) => n.id === edge.target)
              if (!source || !target) return null

              const color = EDGE_COLORS[edge.type] || '#94a3b8'
              const isHighlighted = selectedNode && (edge.source === selectedNode || edge.target === selectedNode)

              // Arrow calculation
              const dx = target.x - source.x
              const dy = target.y - source.y
              const dist = Math.sqrt(dx * dx + dy * dy) || 1
              const endX = target.x - (dx / dist) * 20
              const endY = target.y - (dy / dist) * 20
              const startX = source.x + (dx / dist) * 20
              const startY = source.y + (dy / dist) * 20

              // Midpoint for label
              const midX = (source.x + target.x) / 2
              const midY = (source.y + target.y) / 2

              return (
                <g key={`${edge.source}-${edge.target}-${idx}`}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={color}
                    strokeWidth={isHighlighted ? 2.5 : 1.5}
                    strokeOpacity={selectedNode ? (isHighlighted ? 1 : 0.15) : 0.6}
                    markerEnd={`url(#arrow-${edge.type})`}
                  />
                  {isHighlighted && (
                    <text
                      x={midX}
                      y={midY - 6}
                      textAnchor="middle"
                      fontSize="9"
                      fill={color}
                      fontWeight="600"
                    >
                      {edge.type.replace('_', ' ')}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Arrow markers */}
            <defs>
              <marker id="arrow-blocks" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6" fill="#ef4444" />
              </marker>
              <marker id="arrow-depends_on" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6" fill="#f59e0b" />
              </marker>
              <marker id="arrow-related_to" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <path d="M0,0 L8,3 L0,6" fill="#94a3b8" />
              </marker>
            </defs>

            {/* Nodes */}
            {nodes.map((node) => {
              const color = STATUS_COLORS[node.status] || '#6b7280'
              const isSelected = selectedNode === node.id
              const isConnected = connectedNodeIds.has(node.id)
              const isDimmed = selectedNode && !isSelected && !isConnected

              return (
                <g
                  key={node.id}
                  onClick={() => handleNodeClick(node.id)}
                  className="cursor-pointer"
                  style={{ opacity: isDimmed ? 0.2 : 1, transition: 'opacity 0.2s' }}
                >
                  {/* Glow for selected */}
                  {isSelected && (
                    <circle cx={node.x} cy={node.y} r={24} fill={color} opacity={0.15} />
                  )}
                  {/* Severity ring */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isSelected ? 22 : 18}
                    fill="none"
                    stroke={SEVERITY_COLORS[node.severity] || '#6b7280'}
                    strokeWidth={isSelected ? 2.5 : 2}
                    strokeOpacity={isDimmed ? 0.15 : 0.7}
                  />
                  {/* Status circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isSelected ? 18 : 14}
                    fill={color}
                    stroke={isSelected ? '#fff' : 'transparent'}
                    strokeWidth={isSelected ? 3 : 0}
                    style={{ transition: 'r 0.2s, stroke 0.2s' }}
                  />
                  {/* Node label */}
                  <text
                    x={node.x}
                    y={node.y + 1}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="8"
                    fontWeight="700"
                    fill="white"
                    style={{ pointerEvents: 'none' }}
                  >
                    {shortBugId(node.id)}
                  </text>
                  {/* Title below */}
                  <text
                    x={node.x}
                    y={node.y + (isSelected ? 30 : 26)}
                    textAnchor="middle"
                    fontSize="8"
                    fill="#6b7280"
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.title.length > 20 ? node.title.slice(0, 20) + '...' : node.title}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Selected node info panel */}
          {selectedNode && (() => {
            const node = nodes.find((n) => n.id === selectedNode)
            if (!node) return null
            const connectedEdges = edges.filter(
              (e) => e.source === selectedNode || e.target === selectedNode
            )
            return (
              <div className="p-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[node.status] }} />
                      <span className="font-mono font-bold text-sm text-orange-600 dark:text-orange-400">{shortBugId(node.id)}</span>
                      <span className="text-xs text-stone-500">•</span>
                      <span className="text-xs text-stone-600 dark:text-stone-300 font-medium">{node.title}</span>
                    </div>
                    <div className="text-xs text-stone-400 mt-1">
                      Status: {node.status} • Severity: {node.severity} • {connectedEdges.length} relationship{connectedEdges.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <Link
                    href={`/bugs/${node.id}`}
                    className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold transition-colors"
                  >
                    View Bug →
                  </Link>
                </div>
                {connectedEdges.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {connectedEdges.map((e) => {
                      const otherId = e.source === selectedNode ? e.target : e.source
                      const direction = e.source === selectedNode ? '→' : '←'
                      return (
                        <button
                          key={`${e.source}-${e.target}-${e.type}`}
                          onClick={() => handleNodeClick(otherId)}
                          className="px-2 py-1 rounded-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 text-xs font-medium text-stone-700 dark:text-stone-300 hover:border-orange-500 transition-colors"
                        >
                          {direction} {shortBugId(otherId)} ({e.type})
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}

      {/* Stats bar */}
      {nodes.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">{nodes.length}</div>
            <div className="text-xs text-stone-500 mt-1">Bug Nodes</div>
          </div>
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 text-center">
            <div className="text-2xl font-bold text-stone-900 dark:text-white">{edges.length}</div>
            <div className="text-xs text-stone-500 mt-1">Relationships</div>
          </div>
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 text-center">
            <div className="text-2xl font-bold text-red-500">{edges.filter((e) => e.type === 'blocks').length}</div>
            <div className="text-xs text-stone-500 mt-1">Blocking</div>
          </div>
          <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 text-center">
            <div className="text-2xl font-bold text-amber-500">{edges.filter((e) => e.type === 'depends_on').length}</div>
            <div className="text-xs text-stone-500 mt-1">Dependencies</div>
          </div>
        </div>
      )}
    </div>
  )
}
