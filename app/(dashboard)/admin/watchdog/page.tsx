'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldAlert, AlertCircle, Loader2 } from 'lucide-react'
import { HealthOverview } from './_components/health-overview'
import { AlertsTable } from './_components/alerts-table'

interface Alert {
  id: string
  severity: string
  category: string
  title: string
  description: string | null
  metadata: Record<string, unknown>
  detected_at: string
  dismissed_at: string | null
  resolved_at: string | null
  notified: boolean
}

type Tab = 'active' | 'dismissed'
type SeverityFilter = '' | 'critical' | 'important' | 'info'

export default function WatchdogPage() {
  const router = useRouter()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('active')
  const [severity, setSeverity] = useState<SeverityFilter>('')
  const [counts, setCounts] = useState({ critical: 0, important: 0, info: 0 })
  const [health, setHealth] = useState({ webhooks: 'unknown' })
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set())

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ tab })
      if (severity) params.set('severity', severity)

      const res = await fetch(`/api/admin/watchdog?${params}`, { cache: 'no-store' })
      const json = await res.json()

      if (res.status === 403 || res.status === 401) {
        router.push('/dashboard')
        return
      }

      if (json.data) {
        setAlerts(json.data.alerts || [])
        setCounts(json.data.counts || { critical: 0, important: 0, info: 0 })
        setHealth(json.data.health || { webhooks: 'unknown' })
      } else {
        setError(json.error || 'Failed to load alerts')
      }
    } catch {
      setError('Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [tab, severity, router])

  useEffect(() => {
    loadAlerts()
  }, [loadAlerts])

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(loadAlerts, 60_000)
    return () => clearInterval(interval)
  }, [loadAlerts])

  const handleDismiss = async (ids: string[]) => {
    setDismissingIds(prev => new Set([...prev, ...ids]))
    try {
      await fetch('/api/admin/watchdog/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertIds: ids }),
      })
      await loadAlerts()
    } catch {
      // silent
    } finally {
      setDismissingIds(prev => {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      })
    }
  }

  const totalActive = counts.critical + counts.important + counts.info

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-sm text-red-400">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-zinc-100">Watchdog</h1>
          {totalActive > 0 && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              counts.critical > 0
                ? 'bg-red-500 text-white'
                : 'bg-amber-500 text-black'
            }`}>
              {totalActive}
            </span>
          )}
        </div>
        <button
          onClick={loadAlerts}
          disabled={loading}
          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Health overview */}
      <HealthOverview counts={counts} health={health} />

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-zinc-800 pb-0">
        {(['active', 'dismissed'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-1 pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t === 'active' ? `Active (${totalActive})` : 'Dismissed'}
          </button>
        ))}

        {/* Severity filter */}
        <div className="ml-auto flex gap-1">
          {(['', 'critical', 'important', 'info'] as SeverityFilter[]).map(s => (
            <button
              key={s || 'all'}
              onClick={() => setSeverity(s)}
              className={`px-2.5 py-1 rounded text-xs transition-colors ${
                severity === s
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : (
        <AlertsTable
          alerts={alerts}
          onDismiss={handleDismiss}
          dismissingIds={dismissingIds}
        />
      )}
    </div>
  )
}
