'use client'

import { useState, useCallback, useEffect } from 'react'
import { Send, Loader2, ChevronDown, AlertCircle, Info } from 'lucide-react'
import { QuickReplyTemplates, type QuickTemplate } from './quick-reply-templates'

interface ReplyComposerProps {
  influencerId: string
  influencerEmail: string
  lastMessageId?: string
  lastSubject?: string
  mailboxes: { email: string; status: string }[]
  onSent: () => void
  prefillSubject?: string
  prefillBody?: string
}

export function ReplyComposer({
  influencerId,
  influencerEmail,
  lastMessageId,
  lastSubject,
  mailboxes,
  onSent,
  prefillSubject,
  prefillBody,
}: ReplyComposerProps) {
  const activeMailboxes = mailboxes.filter(m => m.status === 'active' || m.status === 'warming')
  const [fromEmail, setFromEmail] = useState(activeMailboxes[0]?.email ?? '')
  const [subject, setSubject] = useState(lastSubject ? `Re: ${lastSubject.replace(/^Re:\s*/i, '')}` : '')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [showVars, setShowVars] = useState(false)

  // Apply prefill from suggested drafts
  useEffect(() => {
    if (prefillBody) setBody(prefillBody)
    if (prefillSubject) setSubject(prefillSubject)
  }, [prefillBody, prefillSubject])

  const handleSend = useCallback(async () => {
    if (!body.trim() || !fromEmail || sending) return
    setSending(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/admin/inbox/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          influencer_id: influencerId,
          in_reply_to_message_id: lastMessageId,
          subject: subject || '(no subject)',
          body,
          from_email: fromEmail,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to send')
        return
      }

      setSuccess(true)
      setBody('')
      // Refresh thread after short delay so the new message appears
      setTimeout(() => {
        onSent()
        setSuccess(false)
      }, 1000)
    } catch {
      setError('Network error — try again')
    } finally {
      setSending(false)
    }
  }, [body, fromEmail, subject, influencerId, lastMessageId, sending, onSent])

  const handleQuickTemplate = useCallback((tpl: QuickTemplate) => {
    setBody(tpl.body)
    if (!subject && tpl.subject) {
      setSubject(tpl.subject)
    }
  }, [subject])

  if (activeMailboxes.length === 0) {
    return (
      <div className="border-t border-zinc-800 p-4">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          No active mailboxes. Add a mailbox to send replies.
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-zinc-800 p-4 space-y-3">
      {/* From + To row */}
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">From:</span>
          {activeMailboxes.length === 1 ? (
            <span className="text-zinc-300">{fromEmail}</span>
          ) : (
            <div className="relative">
              <select
                value={fromEmail}
                onChange={e => setFromEmail(e.target.value)}
                className="appearance-none bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1 pr-6 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {activeMailboxes.map(m => (
                  <option key={m.email} value={m.email}>{m.email}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500 pointer-events-none" />
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-500">To:</span>
          <span className="text-zinc-300">{influencerEmail}</span>
        </div>
      </div>

      {/* Subject */}
      <input
        type="text"
        value={subject}
        onChange={e => setSubject(e.target.value)}
        placeholder="Subject"
        className="w-full bg-transparent border-b border-zinc-800 px-0 py-1.5 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
      />

      {/* Quick templates */}
      <QuickReplyTemplates onSelect={handleQuickTemplate} disabled={sending} />

      {/* Body */}
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder="Write your reply..."
        rows={5}
        disabled={sending}
        className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-y min-h-[100px] disabled:opacity-50"
      />

      {/* Template vars hint */}
      <button
        onClick={() => setShowVars(!showVars)}
        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        <Info className="h-3 w-3" />
        Template variables {showVars ? '(hide)' : '(show)'}
      </button>
      {showVars && (
        <div className="text-[10px] text-zinc-500 bg-zinc-800/50 rounded-md p-2 font-mono space-y-0.5">
          <div>{'{{first_name}}'} {'{{last_name}}'} {'{{full_name}}'} {'{{email}}'}</div>
          <div>{'{{handle}}'} {'{{platform}}'} {'{{niche}}'} {'{{audience_size}}'}</div>
          <div>{'{{signup_link}}'} {'{{calendly}}'} {'{{link}}'} {'{{company}}'}</div>
        </div>
      )}

      {/* Error / Success */}
      {error && (
        <div className="flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="text-xs text-green-400">
          Sent successfully!
        </div>
      )}

      {/* Send button */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-600">
          Variables are substituted server-side before sending
        </span>
        <button
          onClick={handleSend}
          disabled={!body.trim() || !fromEmail || sending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 text-white text-xs font-medium hover:bg-amber-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {sending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="h-3.5 w-3.5" />
              Send
            </>
          )}
        </button>
      </div>
    </div>
  )
}
