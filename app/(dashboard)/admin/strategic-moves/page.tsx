'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Rocket, Target, Lightbulb, DollarSign,
  CheckCircle2, Clock, XCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'

interface StrategicMove {
  id: string
  agent_type: string
  title: string
  description: string
  impact: number
  effort: number
  confidence: number
  evidence: string
  category: string
  proposed_week_of: string
  status: string
  shipped_at: string | null
  outcome_metric: string | null
  outcome_value: number | null
  created_at: string
}

const AGENT_LABELS: Record<string, { label: string; icon: typeof Rocket }> = {
  strategist: { label: 'Strategist', icon: Target },
  ai_scout: { label: 'AI Scout', icon: Lightbulb },
  revenue: { label: 'Revenue', icon: DollarSign },
}

const STATUS_STYLES: Record<string, string> = {
  proposed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  in_progress: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  shipped: 'bg-green-500/15 text-green-400 border-green-500/30',
  discarded: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  parked: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
}

const CATEGORY_BADGE: Record<string, string> = {
  feature: 'bg-indigo-500/20 text-indigo-300',
  optimization: 'bg-cyan-500/20 text-cyan-300',
  integration: 'bg-amber-500/20 text-amber-300',
  pivot: 'bg-red-500/20 text-red-300',
}

export default function StrategicMovesPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [moves, setMoves] = useState<StrategicMove[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('proposed')
  const [agentFilter, setAgentFilter] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const loadMoves = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ status: statusFilter })
      if (agentFilter) params.set('agent', agentFilter)
      const res = await fetch(`/api/admin/strategic-moves?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setMoves(json.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [statusFilter, agentFilter])

  useEffect(() => {
    if (authorized) loadMoves()
  }, [authorized, loadMoves])

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/strategic-moves/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setMoves(prev => prev.map(m => m.id === id ? { ...m, status, shipped_at: status === 'shipped' ? new Date().toISOString() : m.shipped_at } : m))
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <WolfLoader variant="spinner" size={24} mode="system" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Rocket className="h-6 w-6 text-blue-400" /> Strategic Moves
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Proposed by Strategist, AI Scout, and Revenue agents</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['proposed', 'in_progress', 'shipped', 'parked', 'all'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              statusFilter === s ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-muted-foreground hover:text-white'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
        <div className="w-px bg-border mx-1" />
        {['', 'strategist', 'ai_scout', 'revenue'].map((a) => (
          <button
            key={a}
            onClick={() => setAgentFilter(a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              agentFilter === a ? 'bg-white/10 border-white/20 text-white' : 'border-transparent text-muted-foreground hover:text-white'
            }`}
          >
            {a ? AGENT_LABELS[a]?.label ?? a : 'All agents'}
          </button>
        ))}
      </div>

      {/* Moves list */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <WolfLoader variant="spinner" size={20} mode="system" />
        </div>
      ) : moves.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No moves found for this filter</div>
      ) : (
        <div className="space-y-3">
          {moves.map((m) => {
            const AgentIcon = AGENT_LABELS[m.agent_type]?.icon ?? Rocket
            const expanded = expandedId === m.id
            return (
              <div key={m.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <AgentIcon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm truncate">{m.title}</h3>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[m.status] ?? STATUS_STYLES.proposed}`}>
                          {m.status.replace('_', ' ')}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${CATEGORY_BADGE[m.category] ?? CATEGORY_BADGE.feature}`}>
                          {m.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{AGENT_LABELS[m.agent_type]?.label ?? m.agent_type}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Impact / Effort / Confidence */}
                    <div className="flex gap-2 text-xs">
                      <span title="Impact" className="text-green-400 font-mono">I:{m.impact}</span>
                      <span title="Effort" className="text-orange-400 font-mono">E:{m.effort}</span>
                      <span title="Confidence" className="text-blue-400 font-mono">C:{m.confidence}</span>
                    </div>
                    <button onClick={() => setExpandedId(expanded ? null : m.id)} className="text-muted-foreground hover:text-white">
                      {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="space-y-3 pt-2 border-t border-border">
                    <p className="text-sm text-muted-foreground">{m.description}</p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Evidence:</strong> {m.evidence}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Week of: {m.proposed_week_of} | Created: {new Date(m.created_at).toLocaleDateString()}
                    </div>
                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      {m.status !== 'shipped' && (
                        <button onClick={() => updateStatus(m.id, 'shipped')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30">
                          <CheckCircle2 className="h-3 w-3" /> Ship
                        </button>
                      )}
                      {m.status !== 'in_progress' && m.status !== 'shipped' && (
                        <button onClick={() => updateStatus(m.id, 'in_progress')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30">
                          <Clock className="h-3 w-3" /> In Progress
                        </button>
                      )}
                      {m.status !== 'discarded' && m.status !== 'shipped' && (
                        <button onClick={() => updateStatus(m.id, 'discarded')} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30">
                          <XCircle className="h-3 w-3" /> Discard
                        </button>
                      )}
                    </div>
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
