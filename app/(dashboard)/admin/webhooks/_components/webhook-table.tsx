'use client'

import { RefreshCw, ChevronRight, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react'

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

interface WebhookTableProps {
  webhooks: WebhookEvent[]
  onViewDetail: (id: string) => void
  onRetry: (id: string) => void
  retryingId: string | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

const STATUS_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  completed: { icon: CheckCircle2, color: 'text-green-400' },
  failed: { icon: XCircle, color: 'text-red-400' },
  processing: { icon: Clock, color: 'text-amber-400' },
  pending: { icon: Clock, color: 'text-zinc-400' },
  duplicate: { icon: AlertTriangle, color: 'text-zinc-500' },
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  email_sent: 'bg-cyan-500/15 text-cyan-400',
  email_replied: 'bg-green-500/15 text-green-400',
  email_bounced: 'bg-red-500/15 text-red-400',
  email_unsubscribed: 'bg-orange-500/15 text-orange-400',
}

export function WebhookTable({ webhooks, onViewDetail, onRetry, retryingId }: WebhookTableProps) {
  if (webhooks.length === 0) {
    return (
      <div className="text-center text-zinc-500 text-sm py-12">
        No webhook events found
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 text-xs text-zinc-500 uppercase">
            <th className="text-left p-3">Status</th>
            <th className="text-left p-3">Provider</th>
            <th className="text-left p-3">Event Type</th>
            <th className="text-left p-3">Received</th>
            <th className="text-left p-3">Processed</th>
            <th className="text-left p-3">Retries</th>
            <th className="text-right p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {webhooks.map(wh => {
            const statusInfo = STATUS_ICONS[wh.processing_status] || STATUS_ICONS.pending
            const StatusIcon = statusInfo.icon

            return (
              <tr
                key={wh.id}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                onClick={() => onViewDetail(wh.id)}
              >
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                    <span className={`text-xs ${statusInfo.color}`}>
                      {wh.processing_status}
                    </span>
                  </div>
                </td>
                <td className="p-3">
                  <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                    {wh.provider}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded ${EVENT_TYPE_COLORS[wh.event_type] || 'bg-zinc-800 text-zinc-400'}`}>
                    {wh.event_type}
                  </span>
                </td>
                <td className="p-3 text-zinc-400 text-xs">{formatDate(wh.received_at)}</td>
                <td className="p-3 text-zinc-400 text-xs">{formatDate(wh.processed_at)}</td>
                <td className="p-3 text-zinc-400 text-xs">{wh.retry_count}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {wh.processing_status === 'failed' && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          onRetry(wh.id)
                        }}
                        disabled={retryingId === wh.id}
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-amber-400 transition-colors disabled:opacity-50"
                        title="Retry"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${retryingId === wh.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    <ChevronRight className="h-4 w-4 text-zinc-600" />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
