'use client'

import { Shield, Ban, FileText, Trash2, Mail, CheckCircle2 } from 'lucide-react'

interface AuditEntry {
  id: string
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown>
  triggered_by: string | null
  occurred_at: string
}

interface AuditLogViewerProps {
  entries: AuditEntry[]
  loading: boolean
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
  return `${diffD}d ago`
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  contact_blocked_no_source: { icon: Ban, color: 'text-red-400', label: 'Blocked: no source' },
  contact_blocked_suppressed: { icon: Shield, color: 'text-red-400', label: 'Blocked: suppressed' },
  contact_blocked_no_email: { icon: Ban, color: 'text-orange-400', label: 'Blocked: no email' },
  caption_blocked_no_disclosure: { icon: Ban, color: 'text-amber-400', label: 'Blocked: no disclosure' },
  contact_imported_with_source: { icon: CheckCircle2, color: 'text-green-400', label: 'Imported' },
  suppression_added: { icon: Shield, color: 'text-red-400', label: 'Suppression added' },
  suppression_removed: { icon: Trash2, color: 'text-amber-400', label: 'Suppression removed' },
  gdpr_export_requested: { icon: FileText, color: 'text-purple-400', label: 'GDPR export' },
  gdpr_delete_requested: { icon: Trash2, color: 'text-red-400', label: 'GDPR delete' },
  unsubscribe_processed: { icon: Mail, color: 'text-sky-400', label: 'Unsubscribe' },
  contact_validated_ok: { icon: CheckCircle2, color: 'text-green-400', label: 'Validated OK' },
}

export function AuditLogViewer({ entries, loading }: AuditLogViewerProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-zinc-800 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500 text-center py-8">No audit entries found</p>
  }

  return (
    <div className="space-y-1">
      {entries.map(entry => {
        const config = ACTION_CONFIG[entry.action] || { icon: Shield, color: 'text-zinc-400', label: entry.action }
        const Icon = config.icon
        const email = (entry.details as Record<string, string>)?.email
        const blocks = (entry.details as Record<string, string[]>)?.blocks

        return (
          <div key={entry.id} className="flex items-center gap-3 py-2 px-3 rounded hover:bg-zinc-800/50 transition-colors">
            <Icon className={`h-4 w-4 ${config.color} flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
              {email && <span className="text-xs text-zinc-500 ml-2">{email}</span>}
              {blocks && blocks.length > 0 && (
                <p className="text-[10px] text-zinc-600 truncate">{blocks.join('; ')}</p>
              )}
            </div>
            <span className="text-[10px] text-zinc-600 flex-shrink-0">{formatTimeAgo(entry.occurred_at)}</span>
          </div>
        )
      })}
    </div>
  )
}
