'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronUp, ArrowLeft, Beaker,
  AlertTriangle, Check, X, Clock, Zap, DollarSign,
  Brain, Target, Shield, Play,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import Link from 'next/link'

interface DeepDive {
  id: string
  feature_area: string
  cycle_number: number
  status: string
  confidence: number | null
  estimated_effort_hours: number | null
  kill_switch_severity: number | null
  kill_switch_scenario: string | null
  target_metric: string
  metric_clarity_score: number | null
  final_recommendation: string | null
  total_cost_usd: number | null
  total_duration_seconds: number | null
  user_action: string | null
  auto_pr_url: string | null
  created_at: string
  deliverable_completed_at: string | null
}

interface QueueEntry {
  id: string
  feature_area: string
  current_cycle: number
  next_scheduled_at: string
  priority: number
  forced_next: boolean
  last_dived_at: string | null
}

interface MonthStats {
  totalDives: number
  completedDives: number
  totalCost: number
  avgConfidence: number
}

interface AgentStatus {
  status: string
  last_heartbeat_at: string | null
  hostname: string | null
  total_executions: number
  last_error: string | null
  last_error_at: string | null
}

interface CouncilResponse {
  llm_provider: string
  llm_model: string
  response_solution: string
  response_rationale: string | null
  response_concerns: string | null
  cost_usd: number | null
  duration_ms: number | null
}

const STATUS_COLORS: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  running: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  shipped: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  discarded: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  queued: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  executing: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  pr_ready: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  pr_ready_failed: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const STATUS_LABELS: Record<string, string> = {
  executing: 'Auto-executing',
  pr_ready: 'PR ready',
  pr_ready_failed: 'Execute failed',
}

const LLM_COLORS: Record<string, string> = {
  claude: 'text-orange-400',
  openai: 'text-emerald-400',
  gemini: 'text-blue-400',
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return `${Math.floor(diff / (1000 * 60))}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function timeUntil(date: string): string {
  const diff = new Date(date).getTime() - Date.now()
  if (diff <= 0) return 'now'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 24) return `in ${hours}h`
  return `in ${Math.floor(hours / 24)}d`
}

export default function LabPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [dives, setDives] = useState<DeepDive[]>([])
  const [queue, setQueue] = useState<QueueEntry[]>([])
  const [stats, setStats] = useState<MonthStats>({ totalDives: 0, completedDives: 0, totalCost: 0, avgConfidence: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('completed')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [council, setCouncil] = useState<CouncilResponse[]>([])
  const [councilLoading, setCouncilLoading] = useState(false)
  const [runningCycle, setRunningCycle] = useState(false)
  const [cycleMessage, setCycleMessage] = useState<string | null>(null)
  const [agent, setAgent] = useState<AgentStatus | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/lab?status=${statusFilter}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) {
        setDives(json.data.dives ?? [])
        setQueue(json.data.queue ?? [])
        setStats(json.data.monthStats ?? { totalDives: 0, completedDives: 0, totalCost: 0, avgConfidence: 0 })
        setAgent(json.data.agentStatus ?? null)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => { if (authorized) load() }, [authorized, load])

  const expandDive = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    setCouncilLoading(true)
    try {
      const res = await fetch(`/api/admin/lab/${id}`, { cache: 'no-store' })
      const json = await res.json()
      setCouncil(json.data?.council ?? [])
    } catch { setCouncil([]) } finally { setCouncilLoading(false) }
  }

  const handleAction = async (diveId: string, action: string) => {
    await fetch('/api/admin/lab', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diveId, action }),
    })
    setDives(prev => prev.map(d => d.id === diveId ? { ...d, user_action: action, status: action === 'discarded' ? 'discarded' : d.status } : d))
  }

  const forceQueue = async (area: string) => {
    await fetch('/api/admin/lab', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceArea: area }),
    })
    load()
  }

  const triggerRunCycle = async () => {
    setRunningCycle(true)
    setCycleMessage(null)
    try {
      const res = await fetch('/api/admin/lab', { method: 'POST' })
      const json = await res.json()
      if (res.status === 409) {
        setCycleMessage(json.error || 'Cycle already in progress')
      } else if (json.data?.via === 'manual') {
        setCycleMessage(json.data.message)
      } else if (json.data?.started) {
        setCycleMessage(`Cycle started (${json.data.via}). Check Discord in ~75 min.`)
        setTimeout(() => load(), 10000)
      } else {
        setCycleMessage('Cycle triggered')
      }
    } catch {
      setCycleMessage('Failed to trigger cycle')
    } finally {
      setRunningCycle(false)
    }
  }

  const hasRunningDive = dives.some(d => d.status === 'running')

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <WolfLoader variant="spinner" size={24} mode="system" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin/audits" className="text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Beaker className="h-6 w-6 text-cyan-400" />
              The Lab <span className="text-xs text-zinc-500 font-normal ml-1">V3</span>
            </h1>
            <p className="text-sm text-muted-foreground">
              Product Decision Intelligence — 9 features, manual trigger
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <button
            onClick={triggerRunCycle}
            disabled={runningCycle || hasRunningDive}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-lg bg-cyan-500 hover:bg-cyan-600 text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {runningCycle ? (
              <><WolfLoader variant="spinner" size={16} mode="system" /> Starting...</>
            ) : hasRunningDive ? (
              <><WolfLoader variant="spinner" size={16} mode="system" /> Cycle in progress</>
            ) : (
              <><Play className="h-4 w-4" /> Run Cycle</>
            )}
          </button>
          {cycleMessage && (
            <p className="text-xs text-zinc-400 max-w-[300px] text-right">{cycleMessage}</p>
          )}
          {agent && (
            <AgentBadge agent={agent} />
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide flex items-center gap-1"><Brain className="h-3 w-3" /> Dives this month</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{stats.completedDives}<span className="text-sm text-zinc-500">/{stats.totalDives}</span></p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide flex items-center gap-1"><Target className="h-3 w-3" /> Avg confidence</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{stats.avgConfidence.toFixed(1)}<span className="text-sm text-zinc-500">/10</span></p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide flex items-center gap-1"><DollarSign className="h-3 w-3" /> Cost this month</p>
          <p className="text-2xl font-bold tabular-nums mt-1">${stats.totalCost.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide flex items-center gap-1"><Clock className="h-3 w-3" /> Queue</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{queue.length} <span className="text-sm text-zinc-500">features</span></p>
        </div>
      </div>

      {/* Queue */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
          <Zap className="h-4 w-4 text-amber-400" /> Queue — Next up
        </h2>
        <div className="flex gap-2 flex-wrap">
          {queue.slice(0, 5).map(q => (
            <div key={q.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/30 text-xs">
              <span className="font-semibold text-zinc-300">{q.feature_area}</span>
              <span className="text-zinc-500">#{q.current_cycle}</span>
              {q.forced_next && <span className="text-amber-400 font-bold">NEXT</span>}
              <button
                onClick={() => forceQueue(q.feature_area)}
                className="text-cyan-400 hover:text-cyan-300 ml-1"
                title="Jump queue"
              >
                <Zap className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['completed', 'executing', 'pr_ready', 'running', 'failed', 'shipped', 'discarded', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === s
                ? 'bg-zinc-700/50 text-foreground border-zinc-600'
                : 'text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <WolfLoader variant="spinner" size={24} mode="system" />
        </div>
      )}

      {/* Empty state */}
      {!loading && dives.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No deep dives yet. Click <span className="text-cyan-400 font-medium">Run Cycle</span> above to start.
        </div>
      )}

      {/* Deep dive cards */}
      {!loading && dives.length > 0 && (
        <div className="space-y-3">
          {dives.map(dive => {
            const isExpanded = expandedId === dive.id
            const killBadge = (dive.kill_switch_severity ?? 0) >= 7

            return (
              <div key={dive.id} className={`rounded-xl border p-4 transition-all ${STATUS_COLORS[dive.status] || STATUS_COLORS.queued}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Top line */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-bold uppercase tracking-wide opacity-70">
                        {STATUS_LABELS[dive.status] ?? dive.status}
                      </span>
                      <span className="text-xs text-zinc-500">&middot;</span>
                      <span className="text-xs text-zinc-400">Cycle #{dive.cycle_number}</span>
                      {dive.confidence && (
                        <>
                          <span className="text-xs text-zinc-500">&middot;</span>
                          <span className="text-xs text-zinc-400">Confidence: {dive.confidence}/10</span>
                        </>
                      )}
                      {dive.estimated_effort_hours && (
                        <>
                          <span className="text-xs text-zinc-500">&middot;</span>
                          <span className="text-xs text-zinc-400">{dive.estimated_effort_hours}h effort</span>
                        </>
                      )}
                      {killBadge && (
                        <span className="text-xs font-bold text-red-400 flex items-center gap-0.5">
                          <Shield className="h-3 w-3" /> HIGH RISK
                        </span>
                      )}
                      <span className="text-xs text-zinc-500 ml-auto">{timeAgo(dive.created_at)}</span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm font-semibold">{dive.feature_area}</h3>
                    {dive.target_metric && (
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">
                        Target: {dive.target_metric}
                        {dive.metric_clarity_score && ` (clarity: ${dive.metric_clarity_score}/10)`}
                      </p>
                    )}

                    {/* Recommendation preview */}
                    {dive.final_recommendation && (
                      <p className="text-xs text-zinc-400 mt-1.5 line-clamp-2">
                        {dive.final_recommendation}
                      </p>
                    )}

                    {/* Expand toggle */}
                    <button
                      onClick={() => expandDive(dive.id)}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-2 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isExpanded ? 'Hide details' : 'Show council + details'}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        {/* Kill switch */}
                        {dive.kill_switch_scenario && (
                          <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                            <p className="text-xs font-semibold text-red-400 flex items-center gap-1 mb-1">
                              <AlertTriangle className="h-3 w-3" /> Kill Switch (severity: {dive.kill_switch_severity}/10)
                            </p>
                            <p className="text-xs text-zinc-300">{dive.kill_switch_scenario}</p>
                          </div>
                        )}

                        {/* Council responses */}
                        {councilLoading ? (
                          <WolfLoader variant="spinner" size={16} mode="system" />
                        ) : council.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-zinc-400">Multi-LLM Council</p>
                            {council.map(c => (
                              <div key={c.llm_provider} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-bold uppercase ${LLM_COLORS[c.llm_provider] || 'text-zinc-400'}`}>
                                    {c.llm_provider}
                                  </span>
                                  <span className="text-[10px] text-zinc-600">{c.llm_model}</span>
                                  {c.cost_usd != null && (
                                    <span className="text-[10px] text-zinc-600 ml-auto">${c.cost_usd.toFixed(4)}</span>
                                  )}
                                </div>
                                <p className="text-xs text-zinc-300">{c.response_solution}</p>
                                {c.response_concerns && (
                                  <p className="text-[11px] text-zinc-500 mt-1">Concerns: {c.response_concerns}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Cost + duration */}
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          {dive.total_cost_usd != null && <span>Cost: ${dive.total_cost_usd.toFixed(4)}</span>}
                          {dive.total_duration_seconds != null && <span>Duration: {Math.round(dive.total_duration_seconds / 60)}min</span>}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    {dive.status === 'completed' && !dive.user_action && (
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleAction(dive.id, 'accepted')}
                          className="text-xs font-medium px-3 py-1 rounded-lg border border-zinc-700/50 text-emerald-400 hover:bg-emerald-500/15 transition-colors flex items-center gap-1"
                        >
                          <Check className="h-3 w-3" /> Accept
                        </button>
                        <button
                          onClick={() => handleAction(dive.id, 'later')}
                          className="text-xs font-medium px-3 py-1 rounded-lg border border-zinc-700/50 text-amber-400 hover:bg-amber-500/15 transition-colors flex items-center gap-1"
                        >
                          <Clock className="h-3 w-3" /> Later
                        </button>
                        <button
                          onClick={() => handleAction(dive.id, 'discarded')}
                          className="text-xs font-medium px-3 py-1 rounded-lg border border-zinc-700/50 text-zinc-500 hover:bg-zinc-500/15 transition-colors flex items-center gap-1"
                        >
                          <X className="h-3 w-3" /> Discard
                        </button>
                      </div>
                    )}
                    {dive.status === 'executing' && (
                      <div className="flex items-center gap-2 mt-2 text-xs text-violet-400">
                        <WolfLoader variant="spinner" size={12} mode="system" />
                        Claude Code is auto-executing... PR incoming in 5-15 min
                      </div>
                    )}
                    {dive.status === 'pr_ready' && dive.auto_pr_url && (
                      <a
                        href={dive.auto_pr_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:text-orange-300 mt-2"
                      >
                        Review PR on GitHub <span className="text-[10px]">&rarr;</span>
                      </a>
                    )}
                    {dive.user_action && dive.status !== 'executing' && dive.status !== 'pr_ready' && dive.status !== 'pr_ready_failed' && (
                      <p className="text-xs text-zinc-500 mt-2">
                        Action: <span className="font-medium text-zinc-400">{dive.user_action}</span>
                      </p>
                    )}
                  </div>

                  {/* Confidence badge */}
                  {dive.confidence && (
                    <div className="shrink-0 w-14 h-14 rounded-xl bg-zinc-900/50 border border-zinc-800 flex flex-col items-center justify-center">
                      <span className="text-lg font-bold tabular-nums">{dive.confidence}</span>
                      <span className="text-[9px] text-zinc-500 uppercase">/10</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AgentBadge({ agent }: { agent: AgentStatus }) {
  const isOnline = (agent.status === 'online' || agent.status === 'busy') &&
    agent.last_heartbeat_at &&
    (Date.now() - new Date(agent.last_heartbeat_at).getTime()) < 5 * 60 * 1000

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-red-400">
        <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
        Agent offline
        {agent.last_heartbeat_at && <span className="text-zinc-500">· last seen {timeAgo(agent.last_heartbeat_at)}</span>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-green-400">
      <span className={`inline-block w-2 h-2 rounded-full ${agent.status === 'busy' ? 'bg-amber-400 animate-pulse' : 'bg-green-500'}`} />
      {agent.status === 'busy' ? 'Agent busy' : 'Agent online'}
      {agent.hostname && <span className="text-zinc-500">· {agent.hostname}</span>}
      {agent.total_executions > 0 && <span className="text-zinc-500">· {agent.total_executions} runs</span>}
    </div>
  )
}
