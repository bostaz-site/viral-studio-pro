'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, AlertCircle, RefreshCw } from 'lucide-react'

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

export default function WebhookDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params?.id as string
  const [detail, setDetail] = useState<WebhookDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/admin/webhooks/health/${id}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { if (json.data) setDetail(json.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  const handleRetry = async () => {
    setRetrying(true)
    try {
      await fetch('/api/admin/webhooks/health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookId: id }),
      })
      // Reload
      const res = await fetch(`/api/admin/webhooks/health/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (json.data) setDetail(json.data)
    } catch {
      // silent
    } finally {
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <span className="text-sm text-red-400">Webhook not found</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/admin/webhooks')}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Webhooks
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Webhook Detail</h1>
        {detail.processing_status === 'failed' && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/15 text-amber-400 text-xs rounded-md hover:bg-amber-500/25 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
            Retry
          </button>
        )}
      </div>

      {/* Info grid */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-xs text-zinc-500">Provider</span>
          <p className="text-zinc-200 mt-0.5">{detail.provider}</p>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Event Type</span>
          <p className="text-zinc-200 mt-0.5">{detail.event_type}</p>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Event ID</span>
          <p className="text-zinc-200 mt-0.5 break-all font-mono text-xs">{detail.event_id}</p>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Status</span>
          <p className={`mt-0.5 font-medium ${
            detail.processing_status === 'completed' ? 'text-green-400' :
            detail.processing_status === 'failed' ? 'text-red-400' :
            'text-amber-400'
          }`}>{detail.processing_status}</p>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Received</span>
          <p className="text-zinc-200 mt-0.5">{new Date(detail.received_at).toLocaleString()}</p>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Processed</span>
          <p className="text-zinc-200 mt-0.5">
            {detail.processed_at ? new Date(detail.processed_at).toLocaleString() : '—'}
          </p>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Retries</span>
          <p className="text-zinc-200 mt-0.5">{detail.retry_count}</p>
        </div>
        <div>
          <span className="text-xs text-zinc-500">Payload Hash</span>
          <p className="text-zinc-200 mt-0.5 break-all font-mono text-[10px]">{detail.payload_hash}</p>
        </div>
      </div>

      {/* Error */}
      {detail.error_message && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <span className="text-xs text-red-400 font-medium">Error Message</span>
          <p className="text-sm text-red-300 mt-1 break-all">{detail.error_message}</p>
        </div>
      )}

      {/* Payload */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <span className="text-xs text-zinc-500">Payload</span>
        <pre className="mt-2 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-xs text-zinc-300 overflow-x-auto max-h-96">
          {JSON.stringify(detail.payload, null, 2)}
        </pre>
      </div>
    </div>
  )
}
