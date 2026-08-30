'use client'

import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { bugRef } from '@/lib/types'

interface GraphNode {
  id: string
  number?: number | null
  title: string
  status: string
  severity: string
  projectId: string
  projectName: string
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

interface GraphNodePayload {
  id: string
  number?: number | null
  title: string
  status: string
  severity: string
  project_id: string
  project_name: string
}

interface GraphEdgePayload {
  source_bug_id: string
  target_bug_id: string
  relationship_type: string
}

// Graph is kept intentionally small: only bugs that participate in a
// dependency, capped so the visualization stays readable at a glance.
const MAX_NODES = 42

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

// A single synchronous layout pass. Nodes are grouped by project; the whole
// graph settles instantly and is drawn statically — no animation loop.
function computeCenters(ids: string[], width: number, height: number) {
  const centers = new Map<string, { x: number; y: number }>()
  if (ids.length === 0) return centers

  const cols = ids.length > 4 ? 3 : ids.length > 1 ? 2 : 1
  const rows = Math.ceil(ids.length / cols)
  const padX = Math.max(120, width * 0.2)
  const padY = Math.max(90, height * 0.2)
  ids.forEach((id, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x =
      cols === 1
        ? width / 2
        : padX + (col / (cols - 1)) * (width - padX * 2)
    const y = padY + (row / Math.max(1, rows - 1)) * (height - padY * 2)
    centers.set(id, { x, y })
  })
  return centers
}

// Runs the force model to completion in one synchronous pass (no animation)
// and returns nodes that are already settled — the graph renders fixed.
function settleLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number
): GraphNode[] {
  if (nodes.length === 0) return nodes

  // Vertical headroom reserved above each cluster for its project label pill,
  // so top-row pills never collide with the discs beneath them.
  const HEADROOM = 74
  const work = nodes.map((n) => ({ ...n }))
  const nodeIdx = new Map(work.map((n, i) => [n.id, i]))
  const centers = computeCenters(
    Array.from(new Set(work.map((n) => n.projectId))),
    width,
    height
  )

  const edgePairs: Array<[number, number]> = []
  for (const e of edges) {
    const s = nodeIdx.get(e.source)
    const t = nodeIdx.get(e.target)
    if (s !== undefined && t !== undefined && s !== t) edgePairs.push([s, t])
  }

  for (let iter = 0; iter < 300; iter++) {
    let maxMove = 0
    for (let i = 0; i < work.length; i++) {
      const node = work[i]
      const gc = centers.get(node.projectId)
      if (gc) {
        node.vx += (gc.x - node.x) * 0.006
        node.vy += (gc.y - node.y) * 0.006
      }
      for (let j = 0; j < work.length; j++) {
        if (i === j) continue
        const other = work[j]
        const dx = node.x - other.x
        const dy = node.y - other.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = 2200 / (dist * dist)
        node.vx += (dx / dist) * force
        node.vy += (dy / dist) * force
      }
    }
    for (const [si, ti] of edgePairs) {
      const node = work[si]
      const other = work[ti]
      const dx = other.x - node.x
      const dy = other.y - node.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const force = (dist - 100) * 0.005
      node.vx += (dx / dist) * force
      node.vy += (dy / dist) * force
    }
    for (let i = 0; i < work.length; i++) {
      const node = work[i]
      node.vx *= 0.9
      node.vy *= 0.9
      node.x += node.vx
      node.y += node.vy
      node.x = Math.max(40, Math.min(width - 40, node.x))
      node.y = Math.max(HEADROOM, Math.min(height - HEADROOM, node.y))
      const move = Math.abs(node.vx) + Math.abs(node.vy)
      if (move > maxMove) maxMove = move
    }
    if (maxMove < 0.03) break
  }

  // Hard de-collision pass: guarantee every node is clearly separated so the
  // discs and their labels never overlap, regardless of cluster density.
  const MIN_DIST = 42
  for (let sweep = 0; sweep < 24; sweep++) {
    let moved = false
    for (let i = 0; i < work.length; i++) {
      for (let j = i + 1; j < work.length; j++) {
        const a = work[i]
        const b = work[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist > MIN_DIST) continue
        if (dist < 0.001) {
          a.x -= 0.5
          b.x += 0.5
          moved = true
          continue
        }
        const push = (MIN_DIST - dist) / 2
        a.x -= (dx / dist) * push
        a.y -= (dy / dist) * push
        b.x += (dx / dist) * push
        b.y += (dy / dist) * push
        moved = true
      }
    }
    if (!moved) break
  }
  for (const n of work) {
    n.x = Math.max(40, Math.min(width - 40, n.x))
    n.y = Math.max(HEADROOM, Math.min(height - HEADROOM, n.y))
  }
  return work.map((n) => ({ ...n, vx: 0, vy: 0 }))
}

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [edges, setEdges] = useState<GraphEdge[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [dimensions, setDimensions] = useState({ width: 900, height: 520 })
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const update = () => {
      const rect = el.getBoundingClientRect()
      if (rect.width) setDimensions((d) => ({ ...d, width: rect.width }))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [loading, nodes.length])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Single round trip: the backend returns all visible nodes + edges.
        const graphRes = await api.getGraph().catch(() => null)
        const graph: { nodes?: GraphNodePayload[]; edges?: GraphEdgePayload[] } =
          graphRes?.data || {}

        const rawNodes = graph.nodes || []

        // Only bugs involved in a dependency are drawn — the rest is clutter.
        const degree = new Map<string, number>()
        for (const e of graph.edges || []) {
          degree.set(e.source_bug_id, (degree.get(e.source_bug_id) || 0) + 1)
          degree.set(e.target_bug_id, (degree.get(e.target_bug_id) || 0) + 1)
        }

        let kept = rawNodes.filter((n) => (degree.get(n.id) || 0) > 0)
        if (kept.length > MAX_NODES) {
          kept = [...kept]
            .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
            .slice(0, MAX_NODES)
        }
        const keptIds = new Set(kept.map((n) => n.id))

        // Place every bug near its project's cluster, then settle the whole
        // layout synchronously — the graph paints already-still.
        const centers = computeCenters(
          Array.from(new Set(kept.map((n) => n.project_id))),
          dimensions.width,
          dimensions.height
        )
        const allNodes: GraphNode[] = kept.map((b) => {
          const c = centers.get(b.project_id)
          return {
            id: b.id,
            title: b.title,
            status: b.status,
            severity: b.severity,
            projectId: b.project_id,
            projectName: b.project_name,
            x: (c?.x ?? 450) + (Math.random() - 0.5) * 90,
            y: (c?.y ?? 260) + (Math.random() - 0.5) * 90,
            vx: 0,
            vy: 0,
          }
        })

        const allEdges: GraphEdge[] = (graph.edges || [])
          .filter(
            (e) =>
              e.source_bug_id !== e.target_bug_id &&
              keptIds.has(e.source_bug_id) &&
              keptIds.has(e.target_bug_id)
          )
          .map((e) => ({
            source: e.source_bug_id,
            target: e.target_bug_id,
            type: e.relationship_type as GraphEdge['type'],
          }))

        setNodes(settleLayout(allNodes, allEdges, dimensions.width, dimensions.height))
        setEdges(allEdges)
      } catch {
        // Silent fail
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Stable key of the projects shown (node positions change, ids don't) — used
  // to re-layout once when a project is added/removed, without re-triggering on
  // every node tick.
  const projectIdsKey = useMemo(
    () => Array.from(new Set(nodes.map((n) => n.projectId))).sort().join('|'),
    [nodes]
  )

  // Static (re)layout: only re-runs when the canvas size or the set of
  // projects changes. No animation — nodes stay exactly where they settle.
  useEffect(() => {
    if (nodes.length === 0) return
    setNodes(settleLayout(nodes, edges, dimensions.width, dimensions.height))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions.width, dimensions.height, projectIdsKey])

  const handleNodeClick = useCallback((id: string) => {
    setSelectedNode((prev) => (prev === id ? null : id))
  }, [])

  // O(1) lookups for the render path (rebuilt per nodes tick)
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])

  // Live cluster centroid + project name, drawn as a label above each group
  // Project label position: centered horizontally on the cluster, but raised
// above its topmost node so the pill never sits on top of the discs.
const projectLabels = useMemo(() => {
    const acc = new Map<string, { x: number; y: number; minY: number; n: number; name: string }>()
    for (const n of nodes) {
      const c = acc.get(n.projectId) || { x: 0, y: 0, minY: Infinity, n: 0, name: n.projectName }
      c.x += n.x
      c.y += n.y
      c.n++
      c.minY = Math.min(c.minY, n.y)
      acc.set(n.projectId, c)
    }
    const out: { id: string; x: number; y: number; name: string; n: number }[] = []
    for (const [id, c] of acc)
      out.push({ id, x: c.x / c.n, y: Math.max(22, c.minY - 46), name: c.name, n: c.n })
    return out
  }, [nodes])

  // Filter edges connected to selected node
  const highlightedEdges = selectedNode
    ? edges.filter((e) => e.source === selectedNode || e.target === selectedNode)
    : edges

  const connectedNodeIds = new Set(
    highlightedEdges.flatMap((e) => [e.source, e.target])
  )

  const shownStatuses = Array.from(new Set(nodes.map((n) => n.status))).sort()
  const shownProjects = new Set(nodes.map((n) => n.projectName)).size

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
              Bug relationships at a glance — grouped by project, one dot per bug, arrows for dependencies.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold text-stone-400 uppercase mr-1">Edges:</span>
            <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">blocks</div>
            <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">depends on</div>
            <div className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-stone-100 text-stone-700 border border-stone-200">related</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          <span className="text-[10px] font-semibold text-stone-400 uppercase">Bug status:</span>
          {shownStatuses.map((s) => (
            <div key={s} className="flex items-center gap-1">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] || '#6b7280' }} />
              <span className="text-[10px] text-stone-500">{s.replace('_', ' ')}</span>
            </div>
          ))}
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
          <h3 className="text-base font-bold text-stone-900 dark:text-white">No dependencies yet</h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            Add relationships (blocks, depends on, related) between bugs to see the graph come to life.
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
            <defs>
              <filter id="node-shadow" x="-60%" y="-60%" width="220%" height="220%">
                <feDropShadow dx="0" dy="1.5" stdDeviation="2" floodColor="#000" floodOpacity="0.25" />
              </filter>
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

            {/* Project group labels */}
            {projectLabels.map((p) => (
              <g key={p.id}>
                <rect
                  x={p.x - 100}
                  y={p.y}
                  width={200}
                  height={18}
                  rx={9}
                  fill="#f5f5f4"
                  opacity={0.95}
                />
                <text
                  x={p.x + 8}
                  y={p.y + 13.5}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill="#57534e"
                >
                  {p.name}
                </text>
                <circle cx={p.x - 90} cy={p.y + 9} r={6} fill="#d6d3d1" />
                <text
                  x={p.x - 90}
                  y={p.y + 11.5}
                  textAnchor="middle"
                  fontSize="7"
                  fontWeight="800"
                  fill="#44403c"
                >
                  {p.n}
                </text>
              </g>
            ))}

            {/* Edges */}
            {highlightedEdges.map((edge, idx) => {
              const source = nodeById.get(edge.source)
              const target = nodeById.get(edge.target)
              if (!source || !target) return null

              const color = EDGE_COLORS[edge.type] || '#94a3b8'
              const isHighlighted = selectedNode && (edge.source === selectedNode || edge.target === selectedNode)

              const dx = target.x - source.x
              const dy = target.y - source.y
              const dist = Math.sqrt(dx * dx + dy * dy) || 1
              const endX = target.x - (dx / dist) * 18
              const endY = target.y - (dy / dist) * 18

              return (
                <line
                  key={`${edge.source}-${edge.target}-${idx}`}
                  x1={source.x}
                  y1={source.y}
                  x2={endX}
                  y2={endY}
                  stroke={color}
                  strokeWidth={isHighlighted ? 2.5 : 1.5}
                  strokeOpacity={selectedNode ? (isHighlighted ? 1 : 0.15) : 0.6}
                  markerEnd={`url(#arrow-${edge.type})`}
                />
              )
            })}

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
                  <title>{`${bugRef(node)} — ${node.title} (${node.status.replace('_', ' ')})`}</title>
                  {isSelected && (
                    <circle cx={node.x} cy={node.y} r={19} fill={color} opacity={0.18} />
                  )}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isSelected ? 18 : 15}
                    fill={color}
                    stroke={isSelected ? '#fff' : 'rgba(255,255,255,0.85)'}
                    strokeWidth={isSelected ? 2.75 : 1.75}
                    filter="url(#node-shadow)"
                    style={{ transition: 'r 0.2s, stroke 0.2s' }}
                  />
                  <text
                    x={node.x}
                    y={node.y + 0.5}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="8.5"
                    fontWeight="800"
                    fill="white"
                    paintOrder="stroke"
                    stroke="rgba(0,0,0,0.4)"
                    strokeWidth={2}
                    style={{ pointerEvents: 'none', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {node.number != null ? `#${node.number}` : node.id.slice(0, 6)}
                  </text>
                </g>
              )
            })}
          </svg>

          {/* Selected node info panel */}
          {selectedNode && (() => {
            const node = nodeById.get(selectedNode)
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
                      <span className="font-mono font-bold text-sm text-orange-600 dark:text-orange-400">{bugRef(node)}</span>
                      <span className="text-xs text-stone-500">•</span>
                      <span className="text-xs text-stone-600 dark:text-stone-300 font-medium">{node.title}</span>
                    </div>
                    <div className="text-xs text-stone-400 mt-1">
                      Project: {node.projectName} • Status: {node.status} • {connectedEdges.length} relationship{connectedEdges.length !== 1 ? 's' : ''}
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
                          {direction} {bugRef(nodeById.get(otherId) ?? { id: otherId })} ({e.type.replace('_', ' ')})
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
        <>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Showing {nodes.length} bugs with dependencies across {shownProjects} project{shownProjects !== 1 ? 's' : ''} — bugs without relationships are hidden to keep the view simple.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-stone-900 rounded-2xl p-4 border border-[#eee9e2] dark:border-stone-800 text-center">
              <div className="text-2xl font-bold text-stone-900 dark:text-white">{nodes.length}</div>
              <div className="text-xs text-stone-500 mt-1">Connected Bugs</div>
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
        </>
      )}
    </div>
  )
}