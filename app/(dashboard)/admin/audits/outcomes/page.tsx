'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Loader2, Target, CheckCircle2,
  XCircle, HelpCircle, TrendingUp, TrendingDown,
} from 'lucide-react'
import Link from 'next/link'

interface Outcome {
  id: string
  finding_id: string | null
  cluster_id: string | null
  fix_pr_url: string | null
  fix_merged_at: string
  measurement_window_days: number
  predicted_impact_revenue: number | null
  predicted_impact_conversion: number | null
  predicted_impact_ux: number | null
  actual_metric_before: number | null
  actual_metric_after: number | null
  actual_lift_percent: number | null
  actual_revenue_delta: number | null
  did_it_work: boolean | null
  confidence_in_attribution: number | null
  notes: string | null
  measured_at: string | null
  created_at: string
}

export default function OutcomesPage() {
  const router = useRouter()
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(d => {
        if (!d.isAdmin) { router.push('/dashboard'); return }
        setAuthorized(true)
      })
      .catch(() => router.push('/dashboard'))
  }, [router])

  const loadOutcomes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/audits/outcomes', { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setOutcomes(json.data)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authorized) loadOutcomes()
  }, [authorized, loadOutcomes])

  if (!authorized) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const worked = outcomes.filter(o => o.did_it_work === true)
  const failed = outcomes.filter(o => o.did_it_work === false)
  const inconclusive = outcomes.filter(o => o.did_it_work === null)
  const successRate = worked.length + failed.length > 0
    ? ((worked.length / (worked.length + failed.length)) * 100).toFixed(0)
    : 'N/A'

  // Calibration: avg predicted vs actual
  const withData = outcomes.filter(o => o.predicted_impact_conversion != null && o.actual_lift_percent != null)
  let calibrationMsg = ''
  if (withData.length > 0) {
    const avgPred = withData.reduce((s, o) => s + (o.predicted_impact_conversion ?? 0), 0) / withData.length
    const avgActual = withData.reduce((s, o) => s + (o.actual_lift_percent ?? 0), 0) / withData.length
    const diff = avgPred !== 0 ? ((avgPred - avgActual) / avgPred * 100) : 0
    calibrationMsg = `Predictions ${diff > 0 ? 'overestimate' : 'underestimate'} by ${Math.abs(diff).toFixed(0)}% on average`
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
            <Target className="h-6 w-6 text-emerald-400" />
            Outcome Measurements
          </h1>
          <p className="text-sm text-muted-foreground">
            Did our fixes actually work? Learning loop.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total measured" value={outcomes.length} color="text-zinc-300" />
        <StatCard label="Worked" value={worked.length} color="text-emerald-400" />
        <StatCard label="Failed" value={failed.length} color="text-red-400" />
        <StatCard label="Success rate" value={`${successRate}%`} color="text-blue-400" />
      </div>

      {calibrationMsg && (
        <div className="text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-lg p-3">
          {calibrationMsg} ({withData.length} data points)
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && outcomes.length === 0 && (
        <div className="text-center py-12 text-zinc-500">
          <Target className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No outcome measurements yet.</p>
          <p className="text-xs mt-1">Outcomes are measured 7 days after a fix is merged.</p>
        </div>
      )}

      {/* Outcome List */}
      {!loading && outcomes.length > 0 && (
        <div className="space-y-4">
          {/* Winners */}
          {worked.length > 0 && (
            <Section title="Worked" icon={CheckCircle2} color="text-emerald-400">
              {worked.map(o => <OutcomeCard key={o.id} outcome={o} />)}
            </Section>
          )}

          {/* Failed */}
          {failed.length > 0 && (
            <Section title="Did not work" icon={XCircle} color="text-red-400">
              {failed.map(o => <OutcomeCard key={o.id} outcome={o} />)}
            </Section>
          )}

          {/* Inconclusive */}
          {inconclusive.length > 0 && (
            <Section title="Inconclusive" icon={HelpCircle} color="text-zinc-500">
              {inconclusive.map(o => <OutcomeCard key={o.id} outcome={o} />)}
            </Section>
          )}
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

function Section({ title, icon: Icon, color, children }: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5 ${color}`}>
        <Icon className="h-4 w-4" />
        {title}
      </h2>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

function OutcomeCard({ outcome }: { outcome: Outcome }) {
  const lift = outcome.actual_lift_percent
  const isPositive = lift != null && lift > 0

  return (
    <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Fixed: {new Date(outcome.fix_merged_at).toLocaleDateString()}</span>
            <span>|</span>
            <span>Window: {outcome.measurement_window_days}d</span>
            {outcome.confidence_in_attribution != null && (
              <>
                <span>|</span>
                <span>Attribution: {outcome.confidence_in_attribution}/10</span>
              </>
            )}
          </div>
          {outcome.notes && (
            <p className="text-xs text-zinc-500 italic">{outcome.notes}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Before → After */}
          {outcome.actual_metric_before != null && outcome.actual_metric_after != null && (
            <div className="text-right">
              <p className="text-xs text-zinc-500">
                {Number(outcome.actual_metric_before).toFixed(1)} &rarr; {Number(outcome.actual_metric_after).toFixed(1)}
              </p>
              <div className={`flex items-center gap-0.5 text-sm font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {lift != null ? `${lift > 0 ? '+' : ''}${lift.toFixed(1)}%` : 'N/A'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
