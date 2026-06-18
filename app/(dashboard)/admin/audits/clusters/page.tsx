'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2, ChevronDown, ChevronUp, ExternalLink,
  GitPullRequest, ArrowLeft,
} from 'lucide-react'
import Link from 'next/link'

interface Cluster {
  id: string
  cluster_name: string
  root_cause_description: string
  impact_summary: string
  finding_ids: string[]
  findings_count: number
  total_severity_score: number
  estimated_effort_hours: number
  estimated_impact: number
  confidence_score: number
  status: string
  fix_pr_url: string | null
  fixed_at: string | null
  created_at: string
}

interface Finding {
  id: string
  severity: string
  agent_type: string
  title: string
  location: string | null
  status: string
}

const STATUS_COLORS: Record<string, string> = {
  identified: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  in_progress: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  fixed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  discarded: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
}

const STATUS_ACTIONS = [
  { value: 'in_progress', label: 'Start', color: 'text-blue-400 hover:bg-blue-500/15' },
  { value: 'fixed', label: 'Fixed', color: 'text-emerald-400 hover:bg-emerald-500/15' },
  { value: 'discarded', label: 'Discard', color: 'text-zinc-500 hover:bg-zinc-500/15' },
]

export default function ClustersPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [clusters, setClusters] = useState<Cluster[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('identified')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [drillFindings, setDrillFindings] = useState<Finding[]>([])
  const [drillLoading, setDrillLoading] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const loadClusters = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/audits/clusters?status=${statusFilter}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setClusters(json.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (authorized) loadClusters()
  }, [authorized, loadClusters])

  const loadDrill = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }
    setExpandedId(id)
    setDrillLoading(true)
    try {
      const res = await fetch(`/api/admin/audits/clusters/${id}`, { cache: 'no-store' })
      const json = await res.json()
      setDrillFindings(json.data?.findings ?? [])
    } catch { setDrillFindings([]) } finally {
      setDrillLoading(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/admin/audits/clusters/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setClusters(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const totalFindings = clusters.reduce((s, c) => s + c.findings_count, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/audits" className="text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Root Cause Clusters</h1>
          <p className="text-sm text-muted-foreground">
            {clusters.length} clusters compressing {totalFindings} findings
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {['identified', 'in_progress', 'fixed', 'all'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === s
                ? 'bg-zinc-700/50 text-foreground border-zinc-600'
                : 'text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700'
            }`}
          >
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Cluster list */}
      {!loading && clusters.length === 0 && (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No clusters found. Root cause detector runs nightly.
        </div>
      )}

      {!loading && clusters.length > 0 && (
        <div className="space-y-3">
          {clusters.map((c) => (
            <div key={c.id} className={`rounded-xl border p-4 transition-all ${STATUS_COLORS[c.status] || STATUS_COLORS.identified}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {/* Header row */}
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-xs font-bold uppercase tracking-wide opacity-70">
                      {c.status.replace('_', ' ')}
                    </span>
                    <span className="text-xs text-zinc-500">&middot;</span>
                    <span className="text-xs text-zinc-400">
                      Impact {c.estimated_impact}/10
                    </span>
                    <span className="text-xs text-zinc-500">&middot;</span>
                    <span className="text-xs text-zinc-400">
                      Effort ~{c.estimated_effort_hours}h
                    </span>
                    <span className="text-xs text-zinc-500">&middot;</span>
                    <span className="text-xs text-zinc-400">
                      Confidence {c.confidence_score}/10
                    </span>
                  </div>

                  {/* Title + count */}
                  <h3 className="text-sm font-semibold">{c.cluster_name}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Fixes <strong className="text-foreground">{c.findings_count}</strong> findings
                    {c.fix_pr_url && (
                      <a href={c.fix_pr_url} target="_blank" rel="noopener noreferrer" className="ml-2 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
                        <GitPullRequest className="h-3 w-3" /> PR
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </p>

                  <p className="text-xs text-zinc-500 mt-1">{c.root_cause_description}</p>

                  {/* Drill-down toggle */}
                  <button
                    onClick={() => loadDrill(c.id)}
                    className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 mt-2 transition-colors"
                  >
                    {expandedId === c.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {expandedId === c.id ? 'Hide' : 'Show'} findings
                  </button>

                  {/* Drill-down findings */}
                  {expandedId === c.id && (
                    <div className="mt-3 space-y-1">
                      {drillLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : drillFindings.length === 0 ? (
                        <p className="text-xs text-zinc-600">No linked findings</p>
                      ) : (
                        drillFindings.map(f => (
                          <div key={f.id} className="text-xs px-2 py-1 rounded bg-zinc-900/50 border border-zinc-800 flex items-center gap-2">
                            <span className={`font-bold uppercase ${
                              f.severity === 'critical' ? 'text-red-400'
                              : f.severity === 'high' ? 'text-orange-400'
                              : f.severity === 'normal' ? 'text-yellow-400'
                              : 'text-zinc-500'
                            }`}>
                              {f.severity}
                            </span>
                            <span className="text-zinc-400">{f.agent_type}</span>
                            <span className="text-zinc-300 truncate">{f.title}</span>
                            {f.location && <span className="text-zinc-600 font-mono ml-auto shrink-0">{f.location}</span>}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {c.status !== 'fixed' && c.status !== 'discarded' && (
                    <div className="flex gap-2 mt-3">
                      {STATUS_ACTIONS.filter(a => a.value !== c.status).map(action => (
                        <button
                          key={action.value}
                          onClick={() => updateStatus(c.id, action.value)}
                          className={`text-xs font-medium px-3 py-1 rounded-lg border border-zinc-700/50 transition-colors ${action.color}`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Score badge */}
                <div className="shrink-0 w-14 h-14 rounded-xl bg-zinc-900/50 border border-zinc-800 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold tabular-nums">{c.findings_count}</span>
                  <span className="text-[9px] text-zinc-500 uppercase">fixes</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
