'use client'

import { XCircle, AlertTriangle, Info, X } from 'lucide-react'

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

interface AlertsTableProps {
  alerts: Alert[]
  onDismiss: (ids: string[]) => void
  dismissingIds: Set<string>
}

function formatTimeAgo(iso: string): string {
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h ago`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `${diffD}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const SEVERITY_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  critical: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  important: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  info: { icon: Info, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
}

const CATEGORY_COLORS: Record<string, string> = {
  webhook: 'bg-amber-500/15 text-amber-400',
  stripe: 'bg-indigo-500/15 text-indigo-400',
  mailbox: 'bg-sky-500/15 text-sky-400',
  affiliate: 'bg-emerald-500/15 text-emerald-400',
  crm: 'bg-green-500/15 text-green-400',
  compliance: 'bg-orange-500/15 text-orange-400',
  ai_insight: 'bg-amber-500/15 text-amber-400',
  app: 'bg-zinc-500/15 text-zinc-400',
}

export function AlertsTable({ alerts, onDismiss, dismissingIds }: AlertsTableProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-center text-zinc-500 text-sm py-12">
        No alerts found. System is healthy.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map(alert => {
        const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info
        const Icon = config.icon
        const isDismissed = alert.dismissed_at != null
        const isDismissing = dismissingIds.has(alert.id)

        return (
          <div
            key={alert.id}
            className={`${config.bg} border ${config.border} rounded-lg p-4 ${isDismissed ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Icon className={`h-5 w-5 ${config.color} flex-shrink-0 mt-0.5`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-medium ${config.color}`}>
                      {alert.title}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${CATEGORY_COLORS[alert.category] || 'bg-zinc-700 text-zinc-400'}`}>
                      {alert.category}
                    </span>
                    {alert.notified && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">
                        emailed
                      </span>
                    )}
                  </div>
                  {alert.description && (
                    <p className="text-xs text-zinc-400 mt-1">{alert.description}</p>
                  )}
                  <span className="text-[10px] text-zinc-500 mt-1 block">
                    {formatTimeAgo(alert.detected_at)}
                    {alert.dismissed_at && ` — dismissed ${formatTimeAgo(alert.dismissed_at)}`}
                  </span>
                </div>
              </div>

              {!isDismissed && (
                <button
                  onClick={() => onDismiss([alert.id])}
                  disabled={isDismissing}
                  className="p-1.5 rounded hover:bg-zinc-700/50 text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 disabled:opacity-50"
                  title="Dismiss"
                >
                  <X className={`h-4 w-4 ${isDismissing ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
