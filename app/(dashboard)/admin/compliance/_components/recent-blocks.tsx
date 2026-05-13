'use client'

import { Ban } from 'lucide-react'

interface AuditEntry {
  id: string
  action: string
  details: Record<string, unknown>
  occurred_at: string
}

interface RecentBlocksProps {
  entries: AuditEntry[]
}

function formatTimeAgo(iso: string): string {
  const diffH = Math.round((Date.now() - new Date(iso).getTime()) / 3600000)
  if (diffH < 1) return 'Just now'
  if (diffH < 24) return `${diffH}h ago`
  return `${Math.round(diffH / 24)}d ago`
}

const BLOCK_LABELS: Record<string, string> = {
  contact_blocked_no_source: 'No source URL',
  contact_blocked_suppressed: 'Suppressed',
  contact_blocked_no_email: 'No email',
  caption_blocked_no_disclosure: 'No FTC disclosure',
}

export function RecentBlocks({ entries }: RecentBlocksProps) {
  const blocks = entries.filter(e => e.action.startsWith('contact_blocked') || e.action.startsWith('caption_blocked'))

  if (blocks.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Recent Blocks</h3>
        <p className="text-xs text-zinc-500 text-center py-4">No blocks recorded yet</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-zinc-300 mb-3">Recent Blocks</h3>
      <div className="space-y-2">
        {blocks.slice(0, 10).map(entry => {
          const email = (entry.details as Record<string, string>)?.email
          return (
            <div key={entry.id} className="flex items-center gap-2 py-1">
              <Ban className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
              <span className="text-xs text-zinc-400 flex-1 truncate">
                {email || 'Unknown'} — {BLOCK_LABELS[entry.action] || entry.action}
              </span>
              <span className="text-[10px] text-zinc-600">{formatTimeAgo(entry.occurred_at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
