'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, AlertCircle, Loader2 } from 'lucide-react'
import { SuppressionStats } from './_components/suppression-stats'
import { AuditLogViewer } from './_components/audit-log-viewer'
import { RecentBlocks } from './_components/recent-blocks'
import { GdprRequests } from './_components/gdpr-requests'

interface AuditEntry {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  triggered_by: string | null
  occurred_at: string
}

type ActionFilter = '' | 'contact_blocked_no_source' | 'contact_blocked_suppressed' | 'suppression_added' | 'gdpr_export_requested' | 'gdpr_delete_requested' | 'unsubscribe_processed'

export default function CompliancePage() {
  const router = useRouter()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState<ActionFilter>('')
  const [stats, setStats] = useState({ blocksToday: 0, blocksThisWeek: 0, gdprPending: 0 })
  const [totalSuppressed, setTotalSuppressed] = useState(0)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (actionFilter) params.set('action', actionFilter)

      const [auditRes, suppressionRes] = await Promise.all([
        fetch(`/api/admin/compliance/audit?${params}`, { cache: 'no-store' }),
        fetch('/api/admin/suppression?limit=1', { cache: 'no-store' }),
      ])

      if (auditRes.status === 403 || auditRes.status === 401) {
        router.push('/dashboard')
        return
      }

      const auditJson = await auditRes.json()
      if (auditJson.data) {
        setEntries(auditJson.data.entries || [])
        setStats(auditJson.data.stats || { blocksToday: 0, blocksThisWeek: 0, gdprPending: 0 })
      }

      const suppJson = await suppressionRes.json()
      if (suppJson.data?.stats?.total) {
        setTotalSuppressed(suppJson.data.stats.total)
      }
    } catch {
      setError('Failed to load compliance data')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, router])

  useEffect(() => { loadData() }, [loadData])

  const handleGdprExport = async (email: string) => {
    const res = await fetch('/api/admin/compliance/gdpr-export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const json = await res.json()
    if (json.data) {
      // Download as JSON
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gdpr-export-${email}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      await loadData()
    }
  }

  const handleGdprDelete = async (email: string) => {
    const res = await fetch('/api/admin/compliance/gdpr-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, confirm: true }),
    })
    if (!res.ok) throw new Error('Failed')
    await loadData()
  }

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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-5 w-5 text-amber-400" />
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Compliance</h1>
            <p className="text-xs text-zinc-500">CAN-SPAM / CASL / GDPR / FTC</p>
          </div>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      <SuppressionStats
        totalSuppressed={totalSuppressed}
        blocksToday={stats.blocksToday}
        blocksThisWeek={stats.blocksThisWeek}
        gdprPending={stats.gdprPending}
      />

      {/* Two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentBlocks entries={entries} />
        <GdprRequests onExport={handleGdprExport} onDelete={handleGdprDelete} />
      </div>

      {/* Audit log */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-zinc-300">Audit Log</h3>
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as ActionFilter)}
            className="bg-zinc-950 border border-zinc-700 rounded-md px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          >
            <option value="">All actions</option>
            <option value="contact_blocked_no_source">Blocked: no source</option>
            <option value="contact_blocked_suppressed">Blocked: suppressed</option>
            <option value="suppression_added">Suppression added</option>
            <option value="gdpr_export_requested">GDPR export</option>
            <option value="gdpr_delete_requested">GDPR delete</option>
            <option value="unsubscribe_processed">Unsubscribe</option>
          </select>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : (
          <AuditLogViewer entries={entries} loading={false} />
        )}
      </div>
    </div>
  )
}
