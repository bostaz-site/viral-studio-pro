'use client'

import { useState } from 'react'
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react'

interface Draft {
  style: string
  label: string
  subject: string
  body: string
}

interface SuggestedDraftsProps {
  messageId: string
  onUseDraft: (subject: string, body: string) => void
}

export function SuggestedDrafts({ messageId, onUseDraft }: SuggestedDraftsProps) {
  const [drafts, setDrafts] = useState<Draft[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handleGenerate = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/inbox/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed to generate drafts')
        return
      }

      setDrafts(json.data?.drafts || [])
      setExpanded(true)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!drafts) {
    return (
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Sparkles className="h-3 w-3" />
        )}
        {loading ? 'Generating drafts...' : 'Suggest reply drafts'}
        {error && <span className="text-red-400 ml-2">{error}</span>}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        AI Drafts ({drafts.length})
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {drafts.map((draft, i) => (
            <div
              key={i}
              className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-medium text-amber-300">{draft.label}</span>
                <button
                  onClick={() => onUseDraft(draft.subject, draft.body)}
                  className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors text-[10px] font-medium"
                >
                  Use this draft
                </button>
              </div>
              {draft.subject && (
                <p className="text-zinc-500 mb-1">Subject: {draft.subject}</p>
              )}
              <p className="text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {draft.body.length > 300 ? draft.body.slice(0, 300) + '...' : draft.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
