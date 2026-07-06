'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Users, AlertTriangle,
  ChevronDown, ChevronUp, Eye, XCircle, CheckCircle2,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import Link from 'next/link'

interface FrictionPoint {
  event: string
  type: 'confusion' | 'slowness' | 'broken'
  evidence: string
}

interface SessionReplay {
  id: string
  original_session_id: string
  session_outcome: 'converted' | 'signed_up_no_action' | 'abandoned_at_step' | 'bounced'
  abandoned_at_event: string | null
  total_events: number
  session_duration_seconds: number | null
  events_sequence: Array<{ event_name: string; relative_ts: number; page_path: string | null }>
  friction_points: FrictionPoint[] | null
  emotional_journey: string | null
  comparison_to_personas: Array<{ divergence: string; implication: string }> | null
  finding_ids: string[]
  replayed_at: string
}

const OUTCOME_LABELS: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  converted: { label: 'Converted', color: 'text-emerald-400', icon: CheckCircle2 },
  abandoned_at_step: { label: 'Abandoned', color: 'text-red-400', icon: XCircle },
  signed_up_no_action: { label: 'No Action', color: 'text-amber-400', icon: Eye },
  bounced: { label: 'Bounced', color: 'text-zinc-500', icon: XCircle },
}

const FRICTION_COLORS: Record<string, string> = {
  confusion: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  slowness: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  broken: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionReplay[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [outcomeFilter, setOutcomeFilter] = useState('all')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const loadSessions = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (outcomeFilter !== 'all') params.set('outcome', outcomeFilter)
      const res = await fetch(`/api/admin/audits/sessions?${params}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setSessions(json.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [outcomeFilter])

  useEffect(() => {
    if (authorized) loadSessions()
  }, [authorized, loadSessions])

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <WolfLoader variant="spinner" size={24} mode="system" />
      </div>
    )
  }

  const abandoned = sessions.filter(s => s.session_outcome === 'abandoned_at_step')
  const converted = sessions.filter(s => s.session_outcome === 'converted')
  const bounced = sessions.filter(s => s.session_outcome === 'bounced')
  const abandonRate = sessions.length > 0
    ? ((abandoned.length / sessions.length) * 100).toFixed(0)
    : 'N/A'

  // Friction heatmap: count friction by event
  const frictionHeatmap = new Map<string, number>()
  for (const s of sessions) {
    for (const fp of s.friction_points ?? []) {
      frictionHeatmap.set(fp.event, (frictionHeatmap.get(fp.event) ?? 0) + 1)
    }
  }
  const topFriction = [...frictionHeatmap.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

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
            <Users className="h-6 w-6 text-violet-400" />
            User Session Replays
          </h1>
          <p className="text-sm text-muted-foreground">
            Real user journeys analyzed weekly. Where do they actually get stuck?
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total replayed" value={sessions.length} color="text-zinc-300" />
        <StatCard label="Converted" value={converted.length} color="text-emerald-400" />
        <StatCard label="Abandoned" value={abandoned.length} color="text-red-400" />
        <StatCard label="Bounced" value={bounced.length} color="text-zinc-500" />
        <StatCard label="Abandon rate" value={`${abandonRate}%`} color="text-amber-400" />
      </div>

      {/* Friction Heatmap */}
      {topFriction.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 text-amber-400">
            <AlertTriangle className="h-4 w-4" />
            Friction Heatmap (top events)
          </h2>
          <div className="space-y-2">
            {topFriction.map(([event, count]) => {
              const maxCount = topFriction[0][1]
              const pct = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={event} className="flex items-center gap-3">
                  <span className="text-xs text-zinc-400 w-40 truncate font-mono">{event}</span>
                  <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500/60 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-500 w-8 text-right">{count}x</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">Filter:</span>
        {['all', 'abandoned_at_step', 'converted', 'signed_up_no_action', 'bounced'].map(o => (
          <button
            key={o}
            onClick={() => setOutcomeFilter(o)}
            className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
              outcomeFilter === o
                ? 'bg-violet-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {o === 'all' ? 'All' : OUTCOME_LABELS[o]?.label ?? o}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <WolfLoader variant="spinner" size={24} mode="system" />
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No session replays yet.</p>
          <p className="text-xs mt-1">Sessions are replayed every Wednesday from analytics events.</p>
        </div>
      )}

      {/* Session Cards */}
      {!loading && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map(s => {
            const isOpen = expanded.has(s.id)
            const outcomeInfo = OUTCOME_LABELS[s.session_outcome]
            const OutcomeIcon = outcomeInfo?.icon ?? Eye

            return (
              <div
                key={s.id}
                className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg overflow-hidden"
              >
                {/* Header */}
                <button
                  onClick={() => toggle(s.id)}
                  className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <OutcomeIcon className={`h-4 w-4 ${outcomeInfo?.color ?? 'text-zinc-500'}`} />
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-zinc-300">
                          {s.original_session_id.slice(0, 8)}...
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${outcomeInfo?.color ?? 'text-zinc-500'} bg-zinc-800`}>
                          {outcomeInfo?.label ?? s.session_outcome}
                        </span>
                        {s.abandoned_at_event && (
                          <span className="text-xs text-red-400/70">
                            @ {s.abandoned_at_event}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>{s.total_events} events</span>
                        <span>|</span>
                        <span>{s.session_duration_seconds != null ? `${s.session_duration_seconds}s` : 'N/A'}</span>
                        <span>|</span>
                        <span>{(s.friction_points ?? []).length} friction points</span>
                      </div>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
                </button>

                {/* Expanded */}
                {isOpen && (
                  <div className="border-t border-zinc-800/50 p-4 space-y-4">
                    {/* Emotional Journey */}
                    {s.emotional_journey && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-1">Emotional Journey</h3>
                        <p className="text-sm text-zinc-300 italic">&ldquo;{s.emotional_journey}&rdquo;</p>
                      </div>
                    )}

                    {/* Friction Points */}
                    {(s.friction_points ?? []).length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Friction Points</h3>
                        <div className="space-y-1.5">
                          {(s.friction_points ?? []).map((fp, i) => (
                            <div
                              key={i}
                              className={`text-xs px-2.5 py-1.5 rounded border ${FRICTION_COLORS[fp.type] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                            >
                              <span className="font-bold">[{fp.type}]</span>{' '}
                              <span className="font-mono">{fp.event}</span>
                              {fp.evidence && <span className="text-zinc-400"> &mdash; {fp.evidence}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Events Timeline */}
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Events Timeline</h3>
                      <div className="space-y-0.5 max-h-48 overflow-y-auto">
                        {(s.events_sequence ?? []).map((ev, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-zinc-600 w-12 text-right font-mono">+{ev.relative_ts}s</span>
                            <span className="text-zinc-300 font-mono">{ev.event_name}</span>
                            {ev.page_path && (
                              <span className="text-zinc-600">{ev.page_path}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Persona Comparison */}
                    {(s.comparison_to_personas ?? []).length > 0 && (
                      <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">vs Personas</h3>
                        <div className="space-y-1">
                          {(s.comparison_to_personas ?? []).map((c, i) => (
                            <div key={i} className="text-xs text-zinc-400">
                              <span className="text-violet-400">{c.divergence}</span>
                              {c.implication && <span> &rarr; {c.implication}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-xs text-zinc-600">
                      Replayed: {new Date(s.replayed_at).toLocaleDateString()}
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

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
