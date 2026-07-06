'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Brain, TrendingUp, AlertTriangle, Eye } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import Link from 'next/link'

interface MetaReport {
  id: string
  agent_evaluated: string
  evaluation_period_start: string
  evaluation_period_end: string
  performance_score: number
  findings_actioned_rate: number | null
  findings_ignored_rate: number | null
  blind_spots: string[] | null
  ignored_patterns: string[] | null
  proposed_prompt_diff: string | null
  proposed_prompt_full: string | null
  confidence_in_proposal: number | null
  status: string
  created_at: string
}

const SCORE_COLORS: Record<string, string> = {
  excellent: 'text-emerald-400',
  good: 'text-green-400',
  average: 'text-yellow-400',
  poor: 'text-orange-400',
  bad: 'text-red-400',
}

function scoreLabel(score: number) {
  if (score >= 80) return 'excellent'
  if (score >= 60) return 'good'
  if (score >= 40) return 'average'
  if (score >= 20) return 'poor'
  return 'bad'
}

export default function MetaAgentPage() {
  const router = useRouter()
  const [reports, setReports] = useState<MetaReport[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
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

  const loadReports = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/audits/meta', { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setReports(json.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authorized) loadReports()
  }, [authorized, loadReports])

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <WolfLoader variant="spinner" size={24} mode="system" />
      </div>
    )
  }

  // Group latest report per agent
  const latestByAgent = new Map<string, MetaReport>()
  for (const r of reports) {
    if (!latestByAgent.has(r.agent_evaluated)) {
      latestByAgent.set(r.agent_evaluated, r)
    }
  }

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
            <Brain className="h-6 w-6 text-purple-400" />
            Meta-Agent
          </h1>
          <p className="text-sm text-muted-foreground">
            Self-evaluation of audit agent performance
          </p>
        </div>
      </div>

      {/* Agent Performance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...latestByAgent.entries()].map(([agent, report]) => {
          const label = scoreLabel(report.performance_score)
          return (
            <div
              key={agent}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium capitalize">{agent.replace('_', ' ')}</span>
                <span className={`text-2xl font-bold ${SCORE_COLORS[label]}`}>
                  {report.performance_score}
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Actioned</span>
                  <span className="text-emerald-400">
                    {report.findings_actioned_rate != null
                      ? `${(report.findings_actioned_rate * 100).toFixed(0)}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(report.findings_actioned_rate ?? 0) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Ignored</span>
                  <span className="text-red-400">
                    {report.findings_ignored_rate != null
                      ? `${(report.findings_ignored_rate * 100).toFixed(0)}%`
                      : 'N/A'}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className="bg-red-500 h-1.5 rounded-full transition-all"
                    style={{ width: `${(report.findings_ignored_rate ?? 0) * 100}%` }}
                  />
                </div>
              </div>
              {report.confidence_in_proposal != null && report.confidence_in_proposal >= 7 && (
                <div className="text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-lg p-2">
                  Prompt refinement proposed (confidence: {report.confidence_in_proposal}/10)
                </div>
              )}
              <p className="text-xs text-zinc-500">
                Period: {report.evaluation_period_start} to {report.evaluation_period_end}
              </p>
            </div>
          )
        })}
      </div>

      {latestByAgent.size === 0 && !loading && (
        <div className="text-center py-12 text-zinc-500">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No meta-agent reports yet.</p>
          <p className="text-xs mt-1">The meta-agent runs every Sunday night.</p>
        </div>
      )}

      {/* Full History */}
      {reports.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Report History
          </h2>
          <div className="space-y-2">
            {reports.map(r => (
              <div
                key={r.id}
                className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  className="w-full flex items-center justify-between p-3 text-left hover:bg-zinc-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg font-bold ${SCORE_COLORS[scoreLabel(r.performance_score)]}`}>
                      {r.performance_score}
                    </span>
                    <span className="text-sm capitalize">{r.agent_evaluated.replace('_', ' ')}</span>
                    <span className="text-xs text-zinc-500">{r.evaluation_period_start}</span>
                  </div>
                  <Eye className="h-4 w-4 text-zinc-500" />
                </button>

                {expandedId === r.id && (
                  <div className="px-3 pb-3 space-y-2 border-t border-zinc-800/50 pt-2">
                    {r.blind_spots && (r.blind_spots as string[]).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Blind Spots
                        </p>
                        <ul className="text-xs text-zinc-500 mt-1 space-y-0.5">
                          {(r.blind_spots as string[]).map((s, i) => (
                            <li key={i}>- {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.ignored_patterns && (r.ignored_patterns as string[]).length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-zinc-400">Ignored Patterns</p>
                        <ul className="text-xs text-zinc-500 mt-1 space-y-0.5">
                          {(r.ignored_patterns as string[]).map((s, i) => (
                            <li key={i}>- {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {r.proposed_prompt_diff && (
                      <div>
                        <p className="text-xs font-medium text-zinc-400">Proposed Improvement</p>
                        <p className="text-xs text-zinc-300 mt-1 bg-zinc-800/50 rounded p-2">
                          {r.proposed_prompt_diff}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <WolfLoader variant="spinner" size={24} mode="system" />
        </div>
      )}
    </div>
  )
}
