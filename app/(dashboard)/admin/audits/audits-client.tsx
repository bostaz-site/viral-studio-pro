'use client'

import { useState } from 'react'
import {
  Flame, RotateCcw, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronUp, Loader2, BarChart3, Search,
  Brain, Sparkles, GitMerge,
} from 'lucide-react'
import Link from 'next/link'
import type { Finding, MetricSnapshot } from './page'

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  normal: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  low: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const SEVERITY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  normal: 'bg-yellow-500',
  low: 'bg-zinc-500',
}

const AGENT_LABELS: Record<string, string> = {
  output: 'Output',
  acquisition: 'Acquisition',
  activation: 'Activation',
  retention: 'Retention',
  technical: 'Technical',
}

const STATUS_ACTIONS = [
  { value: 'fixed', label: 'Fixed', color: 'text-emerald-400 hover:bg-emerald-500/15' },
  { value: 'doing', label: 'Doing', color: 'text-blue-400 hover:bg-blue-500/15' },
  { value: 'later', label: 'Later', color: 'text-amber-400 hover:bg-amber-500/15' },
  { value: 'ignore', label: 'Ignore', color: 'text-zinc-500 hover:bg-zinc-500/15' },
]

interface AuditsClientProps {
  findings: Finding[]
  metrics: MetricSnapshot[]
  loading: boolean
  tab: 'today' | 'open' | 'history' | 'metrics'
  setTab: (t: 'today' | 'open' | 'history' | 'metrics') => void
  agentFilter: string
  setAgentFilter: (v: string) => void
  severityFilter: string
  setSeverityFilter: (v: string) => void
  updateStatus: (id: string, status: string) => Promise<void>
}

export function AuditsClient({
  findings, metrics, loading, tab, setTab,
  agentFilter, setAgentFilter, severityFilter, setSeverityFilter,
  updateStatus,
}: AuditsClientProps) {
  const today = new Date()
  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })
  const dateStr = today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const newFindings = findings.filter(f => f.cycle_count === 1 && f.status === 'open')
  const recurringFindings = findings.filter(f => f.cycle_count > 1 && f.status === 'open')
  const fixedFindings = findings.filter(f => f.status === 'fixed')

  const agents = [...new Set(findings.map(f => f.agent_type))]
  const personas = [...new Set(findings.filter(f => f.persona).map(f => f.persona!))]

  const tabs = [
    { key: 'today' as const, label: 'Today', icon: Flame },
    { key: 'open' as const, label: 'Open findings', icon: AlertTriangle },
    { key: 'history' as const, label: 'History', icon: RotateCcw },
    { key: 'metrics' as const, label: 'Metrics', icon: BarChart3 },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">
            Morning Brief &mdash; {dateStr} ({dayName})
          </h1>
          {tab === 'today' && agents.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Agents: {agents.map(a => AGENT_LABELS[a] || a).join(', ')}
              {personas.length > 0 && ` | Personas: ${personas.join(', ')}`}
            </p>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            href="/admin/audits/clusters"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
          >
            <GitMerge className="h-3.5 w-3.5" />
            Root Causes
          </Link>
          <Link
            href="/admin/audits/meta"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors"
          >
            <Brain className="h-3.5 w-3.5" />
            Meta-Agent
          </Link>
          <Link
            href="/admin/audits/ai-multiplier"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors"
          >
            <Sparkles className="h-3.5 w-3.5" />
            AI Multiplier
          </Link>
          <Link
            href="/admin/audits/outcomes"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Outcomes
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border pb-px">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === t.key
                ? 'bg-zinc-800/60 text-foreground border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800/30'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.key === 'today' && newFindings.length > 0 && (
              <span className="ml-1 text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">
                {newFindings.length}
              </span>
            )}
            {t.key === 'open' && (
              <span className="ml-1 text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                {findings.filter(f => f.status === 'open').length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      {tab !== 'metrics' && (
        <div className="flex gap-3">
          <select
            value={agentFilter}
            onChange={e => setAgentFilter(e.target.value)}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500"
          >
            <option value="">All agents</option>
            {Object.entries(AGENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={e => setSeverityFilter(e.target.value)}
            className="bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500"
          >
            <option value="">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Content */}
      {!loading && tab !== 'metrics' && (
        <div className="space-y-8">
          {/* Today view: grouped sections */}
          {tab === 'today' && (
            <>
              {/* Summary badges */}
              <div className="flex gap-3 flex-wrap">
                <SummaryBadge icon={Flame} label="New" count={newFindings.length} color="text-red-400 bg-red-500/10" />
                <SummaryBadge icon={RotateCcw} label="Recurring" count={recurringFindings.length} color="text-amber-400 bg-amber-500/10" />
                <SummaryBadge icon={CheckCircle2} label="Fixed" count={fixedFindings.length} color="text-emerald-400 bg-emerald-500/10" />
              </div>

              {newFindings.length > 0 && (
                <FindingsSection title="New" findings={newFindings} updateStatus={updateStatus} />
              )}
              {recurringFindings.length > 0 && (
                <FindingsSection title="Recurring" findings={recurringFindings} updateStatus={updateStatus} />
              )}
              {fixedFindings.length > 0 && (
                <FindingsSection title="Fixed today" findings={fixedFindings} updateStatus={updateStatus} />
              )}
              {findings.length === 0 && (
                <EmptyState message="No findings for today. All clear!" />
              )}
            </>
          )}

          {/* Open / History: flat list */}
          {(tab === 'open' || tab === 'history') && (
            <>
              {findings.length > 0 ? (
                <div className="space-y-3">
                  {findings.map(f => (
                    <FindingCard key={f.id} finding={f} updateStatus={updateStatus} />
                  ))}
                </div>
              ) : (
                <EmptyState message={tab === 'open' ? 'No open findings!' : 'No findings found.'} />
              )}
            </>
          )}
        </div>
      )}

      {/* Metrics tab */}
      {!loading && tab === 'metrics' && (
        <MetricsView metrics={metrics} />
      )}
    </div>
  )
}

function SummaryBadge({ icon: Icon, label, count, color }: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  count: number
  color: string
}) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-800 ${color}`}>
      <Icon className="h-4 w-4" />
      <span className="text-sm font-medium">{label}</span>
      <span className="text-lg font-bold">{count}</span>
    </div>
  )
}

function FindingsSection({ title, findings, updateStatus }: {
  title: string
  findings: Finding[]
  updateStatus: (id: string, status: string) => Promise<void>
}) {
  return (
    <div>
      <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">{title}</h2>
      <div className="space-y-3">
        {findings.map(f => (
          <FindingCard key={f.id} finding={f} updateStatus={updateStatus} />
        ))}
      </div>
    </div>
  )
}

function FindingCard({ finding, updateStatus }: {
  finding: Finding
  updateStatus: (id: string, status: string) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)

  const handleStatus = async (status: string) => {
    setUpdating(true)
    await updateStatus(finding.id, status)
    setUpdating(false)
  }

  const severityClass = SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.low
  const dotClass = SEVERITY_DOT[finding.severity] || SEVERITY_DOT.low

  return (
    <div className={`rounded-xl border ${severityClass} p-4 transition-all`}>
      <div className="flex items-start gap-3">
        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${dotClass}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wide opacity-70">
              {finding.severity}
            </span>
            <span className="text-xs text-zinc-500">&middot;</span>
            <span className="text-xs text-zinc-400">
              {AGENT_LABELS[finding.agent_type] || finding.agent_type}
            </span>
            {finding.persona && (
              <>
                <span className="text-xs text-zinc-500">&middot;</span>
                <span className="text-xs text-zinc-400">{finding.persona}</span>
              </>
            )}
            {finding.cycle_count > 1 && (
              <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">
                x{finding.cycle_count}
              </span>
            )}
            {finding.status !== 'open' && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                finding.status === 'fixed' ? 'bg-emerald-500/20 text-emerald-400'
                  : finding.status === 'doing' ? 'bg-blue-500/20 text-blue-400'
                  : finding.status === 'later' ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-zinc-500/20 text-zinc-400'
              }`}>
                {finding.status}
              </span>
            )}
          </div>

          <h3 className="text-sm font-semibold mt-1">{finding.title}</h3>

          {finding.location && (
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{finding.location}</p>
          )}

          {/* Expand/collapse */}
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-2 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Less' : 'Details'}
          </button>

          {expanded && (
            <div className="mt-3 space-y-2 text-sm text-zinc-300">
              <p>{finding.description}</p>
              {finding.suggested_fix && (
                <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
                  <p className="text-xs font-bold text-zinc-400 mb-1">Suggested fix</p>
                  <p className="text-xs text-zinc-300">{finding.suggested_fix}</p>
                </div>
              )}
              {finding.screenshot_url && (
                <div className="mt-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={finding.screenshot_url}
                    alt="Screenshot"
                    className="rounded-lg border border-zinc-800 max-w-full max-h-64 object-contain"
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {finding.status === 'open' && (
            <div className="flex gap-2 mt-3">
              {STATUS_ACTIONS.map(action => (
                <button
                  key={action.value}
                  onClick={() => handleStatus(action.value)}
                  disabled={updating}
                  className={`text-xs font-medium px-3 py-1 rounded-lg border border-zinc-700/50 transition-colors ${action.color} disabled:opacity-50`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricsView({ metrics }: { metrics: MetricSnapshot[] }) {
  // Group by metric_name
  const grouped = metrics.reduce<Record<string, MetricSnapshot[]>>((acc, m) => {
    if (!acc[m.metric_name]) acc[m.metric_name] = []
    acc[m.metric_name].push(m)
    return acc
  }, {})

  const metricNames = Object.keys(grouped).sort()

  if (metricNames.length === 0) {
    return <EmptyState message="No metrics snapshots yet. Agents will start recording after the first nightly run." />
  }

  return (
    <div className="space-y-6">
      {metricNames.map(name => {
        const snapshots = grouped[name]
        const latest = snapshots[snapshots.length - 1]
        const first = snapshots[0]
        const change = snapshots.length >= 2
          ? ((Number(latest.metric_value) - Number(first.metric_value)) / Math.max(Number(first.metric_value), 0.01)) * 100
          : null

        return (
          <div key={name} className="rounded-xl border border-zinc-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold">{name.replace(/_/g, ' ')}</h3>
                {latest.metric_unit && (
                  <span className="text-xs text-zinc-500">({latest.metric_unit})</span>
                )}
              </div>
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums">{Number(latest.metric_value).toFixed(1)}</p>
                {change !== null && (
                  <p className={`text-xs font-medium ${change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}% over {snapshots.length}d
                  </p>
                )}
              </div>
            </div>

            {/* Simple sparkline via bars */}
            <div className="flex items-end gap-px h-12">
              {snapshots.map((s, i) => {
                const vals = snapshots.map(x => Number(x.metric_value))
                const max = Math.max(...vals, 1)
                const min = Math.min(...vals, 0)
                const range = max - min || 1
                const height = ((Number(s.metric_value) - min) / range) * 100

                return (
                  <div
                    key={i}
                    className="flex-1 bg-primary/30 hover:bg-primary/50 rounded-t transition-colors"
                    style={{ height: `${Math.max(height, 4)}%` }}
                    title={`${s.snapshot_date}: ${Number(s.metric_value).toFixed(1)}`}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <Search className="h-8 w-8 mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
