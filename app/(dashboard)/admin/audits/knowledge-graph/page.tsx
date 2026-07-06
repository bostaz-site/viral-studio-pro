'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Network, Shield, ChevronDown, ChevronUp, Brain } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { createClient } from '@/lib/supabase/client'

interface KNode {
  id: string
  node_type: string
  name: string
  description: string
  importance_score: number
  is_protected: boolean
  source_count: number
  last_referenced_at: string | null
}

interface KEdge {
  id: string
  relationship: string
  strength: number
  source_node: { name: string; node_type: string } | null
  target_node: { name: string; node_type: string } | null
}

interface Insight {
  id: string
  insight_type: string
  insight_text: string
  confidence: number
  derived_from: string
  created_at: string
}

const TYPE_COLORS: Record<string, string> = {
  feature: 'bg-blue-500/15 text-blue-400',
  business_goal: 'bg-green-500/15 text-green-400',
  tool: 'bg-amber-500/15 text-amber-400',
  platform: 'bg-purple-500/15 text-purple-400',
  state: 'bg-red-500/15 text-red-400',
  codebase_area: 'bg-cyan-500/15 text-cyan-400',
  metric: 'bg-indigo-500/15 text-indigo-400',
}

export default function KnowledgeGraphPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [nodes, setNodes] = useState<KNode[]>([])
  const [insights, setInsights] = useState<Insight[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState<'importance' | 'sources'>('importance')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [edges, setEdges] = useState<{ outgoing: KEdge[]; incoming: KEdge[] }>({ outgoing: [], incoming: [] })

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const loadData = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any)
      .from('knowledge_nodes')
      .select('*')
      .order(sortBy === 'importance' ? 'importance_score' : 'source_count', { ascending: false })
      .limit(100)

    if (typeFilter) query = query.eq('node_type', typeFilter)

    const { data } = await query
    setNodes(data ?? [])

    const { data: ins } = await (supabase as any)
      .from('founder_profile')
      .select('*')
      .order('confidence', { ascending: false })
      .limit(20)
    setInsights(ins ?? [])

    setLoading(false)
  }, [typeFilter, sortBy])

  useEffect(() => {
    if (authorized) loadData()
  }, [authorized, loadData])

  const loadEdges = async (nodeId: string) => {
    const supabase = createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabase as any

    const { data: out } = await s
      .from('knowledge_edges')
      .select('id, relationship, strength, target_node_id')
      .eq('source_node_id', nodeId)

    const { data: inc } = await s
      .from('knowledge_edges')
      .select('id, relationship, strength, source_node_id')
      .eq('target_node_id', nodeId)

    // Enrich with node names
    const allNodeIds = [
      ...(out ?? []).map((e: { target_node_id: string }) => e.target_node_id),
      ...(inc ?? []).map((e: { source_node_id: string }) => e.source_node_id),
    ]

    const { data: relatedNodes } = allNodeIds.length > 0
      ? await s.from('knowledge_nodes').select('id, name, node_type').in('id', allNodeIds)
      : { data: [] }

    const nodeMap = new Map((relatedNodes ?? []).map((n: { id: string; name: string; node_type: string }) => [n.id, n]))

    setEdges({
      outgoing: (out ?? []).map((e: { id: string; relationship: string; strength: number; target_node_id: string }) => ({
        ...e,
        source_node: null,
        target_node: nodeMap.get(e.target_node_id) ?? null,
      })),
      incoming: (inc ?? []).map((e: { id: string; relationship: string; strength: number; source_node_id: string }) => ({
        ...e,
        source_node: nodeMap.get(e.source_node_id) ?? null,
        target_node: null,
      })),
    })
  }

  const handleExpand = (nodeId: string) => {
    if (expandedId === nodeId) {
      setExpandedId(null)
    } else {
      setExpandedId(nodeId)
      loadEdges(nodeId)
    }
  }

  if (!authorized) {
    return <div className="flex items-center justify-center h-64"><WolfLoader variant="spinner" size={24} mode="system" /></div>
  }

  const nodeTypes = [...new Set(nodes.map((n) => n.node_type))].sort()
  const protectedNodes = nodes.filter((n) => n.is_protected)

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Network className="h-6 w-6 text-cyan-400" /> Knowledge Graph
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{nodes.length} nodes indexed</p>
      </div>

      {/* Founder Insights */}
      {insights.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Brain className="h-4 w-4 text-purple-400" /> Founder Profile Insights
          </h2>
          <div className="space-y-2">
            {insights.map((i) => (
              <div key={i.id} className="text-sm text-muted-foreground">
                <span className="text-xs bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded mr-2">{i.insight_type}</span>
                {i.insight_text}
                <span className="text-xs text-zinc-500 ml-2">conf {i.confidence}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Protected Nodes */}
      {protectedNodes.length > 0 && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-2">
            <Shield className="h-4 w-4 text-red-400" /> Protected Nodes ({protectedNodes.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {protectedNodes.map((n) => (
              <span key={n.id} className="text-xs bg-red-500/15 text-red-400 px-2 py-1 rounded-lg">
                {n.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={() => setTypeFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${!typeFilter ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-muted-foreground hover:text-white'}`}>
          All
        </button>
        {nodeTypes.map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${typeFilter === t ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-muted-foreground hover:text-white'}`}>
            {t.replace('_', ' ')}
          </button>
        ))}
        <div className="w-px bg-border mx-1 h-6" />
        <button onClick={() => setSortBy('importance')} className={`px-3 py-1.5 rounded-lg text-xs ${sortBy === 'importance' ? 'text-white' : 'text-muted-foreground'}`}>
          by importance
        </button>
        <button onClick={() => setSortBy('sources')} className={`px-3 py-1.5 rounded-lg text-xs ${sortBy === 'sources' ? 'text-white' : 'text-muted-foreground'}`}>
          by references
        </button>
      </div>

      {/* Nodes list */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><WolfLoader variant="spinner" size={20} mode="system" /></div>
      ) : nodes.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No nodes found. Run the bootstrap script first.</div>
      ) : (
        <div className="space-y-2">
          {nodes.map((n) => {
            const expanded = expandedId === n.id
            return (
              <div key={n.id} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${TYPE_COLORS[n.node_type] ?? 'bg-zinc-500/15 text-zinc-400'}`}>
                      {n.node_type}
                    </span>
                    <span className="font-medium text-sm truncate">{n.name}</span>
                    {n.is_protected && <Shield className="h-3 w-3 text-red-400 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-muted-foreground font-mono">imp:{n.importance_score}</span>
                    <span className="text-xs text-muted-foreground font-mono">ref:{n.source_count ?? 0}</span>
                    <button onClick={() => handleExpand(n.id)} className="text-muted-foreground hover:text-white">
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    <p className="text-sm text-muted-foreground">{n.description}</p>

                    {edges.outgoing.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-500 mb-1">Outgoing edges ({edges.outgoing.length})</h4>
                        {edges.outgoing.map((e) => (
                          <div key={e.id} className="text-xs text-muted-foreground ml-2">
                            -- <span className="text-cyan-400">{e.relationship}</span> --&gt; {e.target_node?.name ?? '?'} <span className="text-zinc-600">({e.target_node?.node_type})</span> <span className="text-zinc-600">str:{e.strength}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {edges.incoming.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-zinc-500 mb-1">Incoming edges ({edges.incoming.length})</h4>
                        {edges.incoming.map((e) => (
                          <div key={e.id} className="text-xs text-muted-foreground ml-2">
                            {e.source_node?.name ?? '?'} <span className="text-zinc-600">({e.source_node?.node_type})</span> -- <span className="text-cyan-400">{e.relationship}</span> --&gt; this
                          </div>
                        ))}
                      </div>
                    )}

                    {edges.outgoing.length === 0 && edges.incoming.length === 0 && (
                      <p className="text-xs text-zinc-500">No edges connected to this node.</p>
                    )}
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
