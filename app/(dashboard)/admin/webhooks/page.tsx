'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Webhook, AlertCircle, Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { WebhookTable } from './_components/webhook-table'

interface WebhookEvent {
  id: string
  provider: string
  event_id: string
  event_type: string
  received_at: string
  processed_at: string | null
  processing_status: string
  error_message: string | null
  retry_count: number
}

interface WebhookDetail {
  id: string
  provider: string
  event_id: string
  event_type: string
  payload: Record<string, unknown>
  payload_hash: string
  received_at: string
  processed_at: string | null
  processing_status: string
  error_message: string | null
  retry_count: number
}

export default function WebhookHealthPage() {
  const router = useRouter()
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0 })
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProvider, setFilterProvider] = useState('')
  const [filterEventType, setFilterEventType] = useState('')
  const [retryingId, setRetryingId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<WebhookDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const loadWebhooks = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterProvider) params.set('provider', filterProvider)
      if (filterEventType) params.set('event_type', filterEventType)

      const res = await fetch(`/api/admin/webhooks/health?${params}`, { cache: 'no-store' })
      const json = await res.json()

      if (res.status === 403 || res.status === 401) {
        router.push('/dashboard')
        return
      }

      if (json.data) {
        setWebhooks(json.data.webhooks || [])
        setStats(json.data.stats || { total: 0, completed: 0, failed: 0 })
      } else {
        setError(json.error || 'Failed to load webhooks')
      }
    } catch {
      setError('Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterProvider, filterEventType, router])

  useEffect(() => {
    loadWebhooks()
  }, [loadWebhooks])

  const handleRetry = async (id: string) => {
    setRetryingId(id)
    try {
      await fetch('/api/admin/webhooks/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId: id }),
      })
      await loadWebhooks()
    } catch {
      // silent
    } finally {
      setRetryingId(null)
    }
  }

  const handleViewDetail = async (id: string) => {
    setDetailId(id)
    setDetailLoading(true)
    try {
      const res = await fetch(`/api/admin/webhooks/health/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setDetail(json.data)
    } catch {
      // silent
    } finally {
      setDetailLoading(false)
    }
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
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Webhook className="h-5 w-5 text-amber-400" />
          <h1 className="text-lg font-semibold text-zinc-100">Webhook Health Monitor</h1>
        </div>
        <button
          onClick={loadWebhooks}
          disabled={loading}
          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 text-xs rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-zinc-500" />
            <span className="text-xs text-zinc-500">Total</span>
          </div>
          <span className="text-2xl font-bold text-zinc-100">{stats.total}</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span className="text-xs text-zinc-500">Completed</span>
          </div>
          <span className="text-2xl font-bold text-green-400">{stats.completed}</span>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-zinc-500">Failed</span>
          </div>
          <span className="text-2xl font-bold text-red-400">{stats.failed}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">All statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="processing">Processing</option>
          <option value="pending">Pending</option>
        </select>

        <select
          value={filterProvider}
          onChange={e => setFilterProvider(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">All providers</option>
          <option value="instantly">Instantly</option>
          <option value="stripe">Stripe</option>
          <option value="resend">Resend</option>
        </select>

        <select
          value={filterEventType}
          onChange={e => setFilterEventType(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-md px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">All event types</option>
          <option value="email_sent">email_sent</option>
          <option value="email_replied">email_replied</option>
          <option value="email_bounced">email_bounced</option>
          <option value="email_unsubscribed">email_unsubscribed</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <WebhookTable
            webhooks={webhooks}
            onViewDetail={handleViewDetail}
            onRetry={handleRetry}
            retryingId={retryingId}
          />
        </div>
      )}

      {/* Detail modal */}
      {detailId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => { setDetailId(null); setDetail(null) }}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto p-6"
            onClick={e => e.stopPropagation()}
          >
            {detailLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
              </div>
            ) : detail ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-zinc-100">Webhook Detail</h2>
                  <button
                    onClick={() => { setDetailId(null); setDetail(null) }}
                    className="text-zinc-500 hover:text-zinc-300 text-sm"
                  >
                    Close
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500">Provider</span>
                    <p className="text-zinc-300 mt-0.5">{detail.provider}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Event Type</span>
                    <p className="text-zinc-300 mt-0.5">{detail.event_type}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Event ID</span>
                    <p className="text-zinc-300 mt-0.5 break-all">{detail.event_id}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Status</span>
                    <p className="text-zinc-300 mt-0.5">{detail.processing_status}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Received</span>
                    <p className="text-zinc-300 mt-0.5">
                      {new Date(detail.received_at).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Processed</span>
                    <p className="text-zinc-300 mt-0.5">
                      {detail.processed_at ? new Date(detail.processed_at).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Retries</span>
                    <p className="text-zinc-300 mt-0.5">{detail.retry_count}</p>
                  </div>
                  <div>
                    <span className="text-zinc-500">Payload Hash</span>
                    <p className="text-zinc-300 mt-0.5 break-all font-mono text-[10px]">{detail.payload_hash}</p>
                  </div>
                </div>

                {detail.error_message && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <span className="text-xs text-red-400 font-medium">Error</span>
                    <p className="text-xs text-red-300 mt-1 break-all">{detail.error_message}</p>
                  </div>
                )}

                <div>
                  <span className="text-xs text-zinc-500">Payload</span>
                  <pre className="mt-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 overflow-x-auto max-h-60">
                    {JSON.stringify(detail.payload, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-500 text-sm py-8">Not found</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
