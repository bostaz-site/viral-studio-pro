'use client'

import { useEffect, useState, useCallback } from 'react'
import { Star, Archive, Tag, Loader2, ArrowDown, ArrowUp } from 'lucide-react'
import { InfluencerContextSidebar } from './influencer-context-sidebar'
import { ReplyComposer } from './reply-composer'

interface Message {
  id: string
  direction: string
  subject: string | null
  body_text: string | null
  body_html: string | null
  sent_at: string | null
  created_at: string
  is_read: boolean
  is_starred: boolean
  is_archived: boolean
}

interface Influencer {
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
  audience_size: number | null
  niche: string | null
  last_contacted_at: string | null
  total_emails_sent: number
  total_emails_replied: number
}

interface ThreadDetailProps {
  influencerId: string | null
  onAction: (messageIds: string[], action: string) => void
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ThreadDetail({ influencerId, onAction }: ThreadDetailProps) {
  const [loading, setLoading] = useState(false)
  const [influencer, setInfluencer] = useState<Influencer | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [mailboxes, setMailboxes] = useState<{ email: string; status: string }[]>([])

  const loadThread = useCallback(() => {
    if (!influencerId) return
    setLoading(true)
    fetch(`/api/admin/inbox/${influencerId}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          setInfluencer(json.data.influencer)
          setMessages(json.data.messages || [])
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [influencerId])

  useEffect(() => { loadThread() }, [loadThread])

  // Fetch available mailboxes once
  useEffect(() => {
    fetch('/api/admin/inbox/mailboxes')
      .then(r => r.json())
      .then(json => setMailboxes(json.data || []))
      .catch(() => {})
  }, [])

  if (!influencerId) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
        Select a thread to view
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  const allMessageIds = messages.map(m => m.id)

  return (
    <div className="flex-1 flex min-h-0">
      {/* Messages timeline */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Thread header + actions */}
        <div className="border-b border-zinc-800 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">
              {influencer?.display_name || influencer?.first_name || influencer?.email}
            </h2>
            <p className="text-xs text-zinc-500">{influencer?.email}</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onAction(allMessageIds, 'mark_hot')}
              className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors"
              title="Mark as hot"
            >
              <Tag className="h-4 w-4" />
            </button>
            <button
              onClick={() => onAction(allMessageIds, messages.some(m => m.is_starred) ? 'unstar' : 'star')}
              className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors"
              title="Star"
            >
              <Star className={`h-4 w-4 ${messages.some(m => m.is_starred) ? 'text-amber-400 fill-amber-400' : ''}`} />
            </button>
            <button
              onClick={() => onAction(allMessageIds, 'archive')}
              className="p-2 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`rounded-lg border p-4 ${
                msg.direction === 'inbound'
                  ? 'border-zinc-700 bg-zinc-800/50'
                  : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              {/* Message header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {msg.direction === 'inbound' ? (
                    <ArrowDown className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <ArrowUp className="h-3.5 w-3.5 text-blue-400" />
                  )}
                  <span className="text-xs font-medium text-zinc-300">
                    {msg.direction === 'inbound' ? influencer?.email : 'You'}
                  </span>
                  {msg.direction === 'inbound' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
                      Reply
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500">
                  {formatDate(msg.sent_at || msg.created_at)}
                </span>
              </div>

              {/* Subject */}
              {msg.subject && (
                <p className="text-xs text-zinc-400 mb-2">
                  <span className="text-zinc-500">Subject:</span> {msg.subject}
                </p>
              )}

              {/* Body */}
              <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {msg.body_text || '(no body)'}
              </div>
            </div>
          ))}

          {messages.length === 0 && (
            <div className="text-center text-zinc-500 text-sm py-8">
              No messages in this thread
            </div>
          )}

        </div>

        {/* Reply composer */}
        {influencer && (
          <ReplyComposer
            influencerId={influencer.id}
            influencerEmail={influencer.email}
            lastMessageId={messages.length > 0 ? messages[messages.length - 1].id : undefined}
            lastSubject={messages.find(m => m.subject)?.subject ?? undefined}
            mailboxes={mailboxes}
            onSent={loadThread}
          />
        )}
      </div>

      {/* Context sidebar */}
      {influencer && <InfluencerContextSidebar influencer={influencer} />}
    </div>
  )
}
