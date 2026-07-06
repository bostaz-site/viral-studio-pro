'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Sparkles, Code2, Zap, TrendingUp,
  ChevronDown, ChevronUp, ArrowRight, X,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import Link from 'next/link'

interface Opportunity {
  id: string
  file_path: string
  component_description: string
  current_implementation: string
  proposed_ai_solution: string
  ai_capability: string
  predicted_lift_metric: string | null
  predicted_lift_value: number | null
  estimated_effort_hours: number | null
  code_sketch: string | null
  impact_score: number
  confidence_score: number
  status: string
  shipped_at: string | null
  measured_lift: number | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  proposed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  in_progress: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  shipped: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  discarded: 'bg-zinc-500/15 text-zinc-500 border-zinc-500/30',
}

const AI_CAPABILITY_LABELS: Record<string, string> = {
  claude_vision: 'Claude Vision',
  claude_text: 'Claude Text',
  whisper_v3: 'Whisper v3',
  elevenlabs: 'ElevenLabs',
  gpt4_vision: 'GPT-4 Vision',
  gemini_video: 'Gemini Video',
  custom_ml: 'Custom ML',
}

export default function AIMultiplierPage() {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [statusFilter, setStatusFilter] = useState('proposed')
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

  const loadOpportunities = useCallback(async () => {
    setLoading(true)
    try {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const res = await fetch(`/api/admin/audits/ai-multiplier${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setOpportunities(json.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (authorized) loadOpportunities()
  }, [authorized, loadOpportunities])

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/audits/ai-multiplier?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setOpportunities(prev =>
      prev.map(o => o.id === id ? { ...o, status } : o)
    )
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <WolfLoader variant="spinner" size={24} mode="system" />
      </div>
    )
  }

  const statusTabs = [
    { key: 'proposed', label: 'Proposed' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'discarded', label: 'Discarded' },
    { key: '', label: 'All' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/audits"
          className="p-1.5 rounded-lg hover:bg-zinc-800/50 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-400" />
            AI Multiplier
          </h1>
          <p className="text-sm text-muted-foreground">
            AI upgrade opportunities across the codebase
          </p>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-px">
        {statusTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setStatusFilter(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              statusFilter === t.key
                ? 'bg-zinc-800/60 text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <WolfLoader variant="spinner" size={24} mode="system" />
        </div>
      )}

      {!loading && opportunities.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No opportunities in this category yet.</p>
          <p className="text-xs mt-1">The AI Multiplier runs on Tuesday and Saturday nights.</p>
        </div>
      )}

      {/* Opportunity Cards */}
      <div className="space-y-3">
        {opportunities.map(opp => {
          const priorityScore = opp.impact_score * opp.confidence_score / (opp.estimated_effort_hours ?? 1)
          const isExpanded = expandedId === opp.id

          return (
            <div
              key={opp.id}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : opp.id)}
                className="w-full p-4 text-left hover:bg-zinc-800/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[opp.status]}`}>
                        {opp.status}
                      </span>
                      <span className="text-xs text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded">
                        {AI_CAPABILITY_LABELS[opp.ai_capability] ?? opp.ai_capability}
                      </span>
                    </div>
                    <p className="font-medium text-sm">{opp.component_description}</p>
                    <p className="text-xs text-zinc-500 font-mono">{opp.file_path}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-zinc-400">
                        <Zap className="h-3 w-3 text-amber-400" />
                        {opp.impact_score}/10
                      </div>
                      <p className="text-xs text-zinc-500">
                        {opp.estimated_effort_hours ?? '?'}h effort
                      </p>
                      <p className="text-[10px] text-zinc-600">
                        priority: {priorityScore.toFixed(1)}
                      </p>
                    </div>
                    {isExpanded
                      ? <ChevronUp className="h-4 w-4 text-zinc-500" />
                      : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                  </div>
                </div>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-zinc-800/50 pt-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-zinc-400 mb-1">Current Implementation</p>
                      <p className="text-xs text-zinc-300 bg-zinc-800/40 rounded p-2">
                        {opp.current_implementation}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-zinc-400 mb-1">Proposed AI Solution</p>
                      <p className="text-xs text-zinc-300 bg-zinc-800/40 rounded p-2">
                        {opp.proposed_ai_solution}
                      </p>
                    </div>
                  </div>

                  {opp.predicted_lift_value != null && (
                    <div className="flex items-center gap-2 text-xs">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-zinc-300">
                        Predicted lift: <span className="text-emerald-400 font-medium">
                          +{opp.predicted_lift_value}%
                        </span> on {opp.predicted_lift_metric}
                      </span>
                      <span className="text-zinc-600">
                        (confidence: {opp.confidence_score}/10)
                      </span>
                    </div>
                  )}

                  {opp.code_sketch && (
                    <div>
                      <p className="text-xs font-medium text-zinc-400 mb-1 flex items-center gap-1">
                        <Code2 className="h-3 w-3" /> Code Sketch
                      </p>
                      <pre className="text-xs text-zinc-300 bg-zinc-950 border border-zinc-800 rounded-lg p-3 overflow-x-auto font-mono">
                        {opp.code_sketch}
                      </pre>
                    </div>
                  )}

                  {/* Actions */}
                  {opp.status === 'proposed' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => updateStatus(opp.id, 'in_progress')}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 transition-colors"
                      >
                        <ArrowRight className="h-3 w-3" /> Start
                      </button>
                      <button
                        onClick={() => updateStatus(opp.id, 'discarded')}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-500/15 text-zinc-400 hover:bg-zinc-500/25 transition-colors"
                      >
                        <X className="h-3 w-3" /> Discard
                      </button>
                    </div>
                  )}
                  {opp.status === 'in_progress' && (
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => updateStatus(opp.id, 'shipped')}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                      >
                        Ship
                      </button>
                      <button
                        onClick={() => updateStatus(opp.id, 'discarded')}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-zinc-500/15 text-zinc-400 hover:bg-zinc-500/25 transition-colors"
                      >
                        <X className="h-3 w-3" /> Discard
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

