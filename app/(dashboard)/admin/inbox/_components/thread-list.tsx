'use client'

import { Star } from 'lucide-react'

interface ThreadItem {
  influencer: {
    id: string
    email: string
    display_name: string | null
    first_name: string | null
    last_name: string | null
    status: string
    lead_score: number
    tags: string[]
    primary_platform: string | null
    platform_handle: string | null
  }
  lastMessage: {
    id: string
    direction: string
    subject: string | null
    preview: string
    sent_at: string | null
    created_at: string
    is_read: boolean
    is_starred: boolean
    is_archived: boolean
  }
  unreadCount: number
  messageCount: number
}

interface ThreadListProps {
  threads: ThreadItem[]
  selectedId: string | null
  onSelect: (influencerId: string) => void
  loading: boolean
}

function formatTimeAgo(iso: string | null): string {
  if (!iso) return ''
  const now = Date.now()
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.round((now - then) / 1000))
  if (diffSec < 60) return `${diffSec}s`
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.round(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.round(diffH / 24)
  if (diffD < 30) return `${diffD}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  cold: 'bg-blue-500/20 text-blue-400',
  contacted: 'bg-sky-500/20 text-sky-400',
  replied: 'bg-green-500/20 text-green-400',
  interested: 'bg-emerald-500/20 text-emerald-400',
  demo_sent: 'bg-purple-500/20 text-purple-400',
  onboarded: 'bg-amber-500/20 text-amber-400',
  paying: 'bg-yellow-500/20 text-yellow-400',
  declined: 'bg-red-500/20 text-red-400',
  blocked: 'bg-red-700/20 text-red-500',
  dormant: 'bg-zinc-500/20 text-zinc-400',
}

export function ThreadList({ threads, selectedId, onSelect, loading }: ThreadListProps) {
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3 border-b border-zinc-800 animate-pulse">
            <div className="h-4 bg-zinc-800 rounded w-2/3 mb-2" />
            <div className="h-3 bg-zinc-800 rounded w-1/2 mb-1" />
            <div className="h-3 bg-zinc-800 rounded w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        No threads found
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {threads.map(thread => {
        const inf = thread.influencer
        const msg = thread.lastMessage
        const isSelected = inf.id === selectedId
        const name = inf.display_name || inf.first_name || inf.email.split('@')[0]

        return (
          <button
            key={inf.id}
            onClick={() => onSelect(inf.id)}
            className={`w-full text-left p-3 border-b border-zinc-800 transition-colors ${
              isSelected
                ? 'bg-zinc-800/80'
                : msg.is_read
                  ? 'hover:bg-zinc-800/40'
                  : 'bg-zinc-900/50 hover:bg-zinc-800/60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                {/* Name + email */}
                <div className="flex items-center gap-2">
                  {!msg.is_read && (
                    <div className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  )}
                  <span className={`text-sm truncate ${!msg.is_read ? 'font-semibold text-zinc-100' : 'text-zinc-300'}`}>
                    {name}
                  </span>
                  {msg.is_starred && (
                    <Star className="h-3 w-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-zinc-500 truncate">{inf.email}</p>

                {/* Subject */}
                {msg.subject && (
                  <p className={`text-xs mt-1 truncate ${!msg.is_read ? 'text-zinc-200' : 'text-zinc-400'}`}>
                    {msg.subject}
                  </p>
                )}

                {/* Preview */}
                <p className="text-xs text-zinc-500 mt-0.5 truncate">{msg.preview}</p>
              </div>

              {/* Right side: time + status */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                <span className="text-[10px] text-zinc-500">
                  {formatTimeAgo(msg.sent_at || msg.created_at)}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLORS[inf.status] || 'bg-zinc-700 text-zinc-400'}`}>
                  {inf.status}
                </span>
                {thread.unreadCount > 0 && (
                  <span className="text-[10px] bg-amber-500 text-black font-bold px-1.5 py-0.5 rounded-full">
                    {thread.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
