'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, ChevronDown, ChevronUp, ExternalLink,
  ArrowLeft, AlertTriangle, Bug, Eye, EyeOff,
} from 'lucide-react'
import Link from 'next/link'

interface ProductionError {
  id: string
  source: string
  error_type: string
  error_message: string
  stack_trace: string | null
  affected_file: string | null
  affected_line: number | null
  occurrence_count: number
  affected_users_count: number | null
  first_seen_at: string
  last_seen_at: string
  cluster_signature: string
  status: string
  sentry_issue_id: string | null
  sentry_url: string | null
  ai_root_cause: string | null
  ai_suggested_fix: string | null
  finding_id: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-red-500/15 text-red-400 border-red-500/30',
  investigated: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  fixed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  ignored: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  expected: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const STATUS_ACTIONS = [
  { value: 'investigated', label: 'Investigated', color: 'text-blue-400 hover:bg-blue-500/15' },
  { value: 'fixed', label: 'Fixed', color: 'text-emerald-400 hover:bg-emerald-500/15' },
  { value: 'ignored', label: 'Ignore', color: 'text-zinc-500 hover:bg-zinc-500/15' },
  { value: 'expected', label: 'Expected', color: 'text-amber-400 hover:bg-amber-500/15' },
]

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  normal: 'text-yellow-400',
}

function getSeverityLabel(count: number): { label: string; color: string } {
  if (count >= 100) return { label: 'CRITICAL', color: SEVERITY_COLOR.critical }
  if (count >= 20) return { label: 'HIGH', color: SEVERITY_COLOR.high }
  return { label: 'NORMAL', color: SEVERITY_COLOR.normal }
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return `${Math.floor(diff / (1000 * 60))}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ProductionErrorsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [errors, setErrors] = useState<ProductionError[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('new')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [stats, setStats] = useState<{ totalNew: number; totalAll: number }>({ totalNew: 0, totalAll: 0 })

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const loadErrors = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/audits/production-errors?status=${statusFilter}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) {
        setErrors(json.data.errors ?? [])
        setStats(json.data.stats ?? { totalNew: 0, totalAll: 0 })
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (authorized) loadErrors()
  }, [authorized, loadErrors])

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/admin/audits/production-errors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    setErrors(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalOccurrences = errors.reduce((s, e) => s + e.occurrence_count, 0)
  const totalUsers = errors.reduce((s, e) => s + (e.affected_users_count ?? 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/audits" className="text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Bug className="h-6 w-6 text-red-400" />
            Production Errors
          </h1>
          <p className="text-sm text-muted-foreground">
            {stats.totalNew} new errors | {stats.totalAll} total tracked
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Errors shown</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{errors.length}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Total occurrences</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{totalOccurrences.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide">Users affected</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{totalUsers.toLocaleString()}</p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {['new', 'investigated', 'fixed', 'ignored', 'expected', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === s
                ? 'bg-zinc-700/50 text-foreground border-zinc-600'
                : 'text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
            }`}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!loading && errors.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          {statusFilter === 'new'
            ? 'No new production errors. Production errors agent runs nightly.'
            : `No errors with status "${statusFilter}".`}
        </div>
      )}

      {/* Error list */}
      {!loading && errors.length > 0 && (
        <div className="space-y-3">
          {errors.map((err) => {
            const sev = getSeverityLabel(err.occurrence_count)
            const isExpanded = expandedId === err.id

            return (
              <div key={err.id} className={`rounded-xl border p-4 transition-all ${STATUS_COLORS[err.status] || STATUS_COLORS.new}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Top line: severity + source + timing */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`text-xs font-bold uppercase tracking-wide ${sev.color}`}>
                        {sev.label}
                      </span>
                      <span className="text-xs text-zinc-500">&middot;</span>
                      <span className="text-xs text-zinc-400 uppercase">{err.source}</span>
                      <span className="text-xs text-zinc-500">&middot;</span>
                      <span className="text-xs text-zinc-400">
                        {err.occurrence_count.toLocaleString()}x
                      </span>
                      {err.affected_users_count != null && err.affected_users_count > 0 && (
                        <>
                          <span className="text-xs text-zinc-500">&middot;</span>
                          <span className="text-xs text-zinc-400">
                            {err.affected_users_count} users
                          </span>
                        </>
                      )}
                      <span className="text-xs text-zinc-500 ml-auto">{timeAgo(err.last_seen_at)}</span>
                    </div>

                    {/* Error type + message */}
                    <h3 className="text-sm font-semibold">
                      <span className="text-zinc-400 font-mono">{err.error_type}:</span>{' '}
                      {err.error_message.length > 120 ? err.error_message.slice(0, 120) + '...' : err.error_message}
                    </h3>

                    {err.affected_file && (
                      <p className="text-xs text-zinc-500 font-mono mt-0.5">
                        {err.affected_file}{err.affected_line ? `:${err.affected_line}` : ''}
                      </p>
                    )}

                    {/* Expand toggle */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : err.id)}
                      className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-2 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isExpanded ? 'Hide details' : 'Show details'}
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        {err.stack_trace && (
                          <div>
                            <p className="text-xs font-semibold text-zinc-400 mb-1">Stack trace</p>
                            <pre className="text-xs text-zinc-500 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                              {err.stack_trace}
                            </pre>
                          </div>
                        )}
                        {err.ai_root_cause && (
                          <div>
                            <p className="text-xs font-semibold text-zinc-400 mb-1">AI Root Cause</p>
                            <p className="text-xs text-zinc-300">{err.ai_root_cause}</p>
                          </div>
                        )}
                        {err.ai_suggested_fix && (
                          <div>
                            <p className="text-xs font-semibold text-zinc-400 mb-1">Suggested Fix</p>
                            <p className="text-xs text-zinc-300">{err.ai_suggested_fix}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span>First seen: {new Date(err.first_seen_at).toLocaleString()}</span>
                          <span>Last seen: {new Date(err.last_seen_at).toLocaleString()}</span>
                          {err.sentry_url && (
                            <a
                              href={err.sentry_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                            >
                              Open in Sentry <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Status actions */}
                    {err.status !== 'fixed' && (
                      <div className="flex gap-2 mt-3">
                        {STATUS_ACTIONS.filter(a => a.value !== err.status).map(action => (
                          <button
                            key={action.value}
                            onClick={() => updateStatus(err.id, action.value)}
                            className={`text-xs font-medium px-3 py-1 rounded-lg border border-zinc-700/50 transition-colors ${action.color}`}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Count badge */}
                  <div className="shrink-0 w-16 h-16 rounded-xl bg-zinc-900/50 border border-zinc-800 flex flex-col items-center justify-center">
                    <span className={`text-lg font-bold tabular-nums ${sev.color}`}>
                      {err.occurrence_count >= 1000
                        ? `${(err.occurrence_count / 1000).toFixed(1)}k`
                        : err.occurrence_count}
                    </span>
                    <span className="text-[9px] text-zinc-500 uppercase">hits</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
