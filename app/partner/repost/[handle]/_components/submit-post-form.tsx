'use client'

import { useState } from 'react'
import { Send, Check } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { trackEvent } from '@/lib/partner/repost-kit/tracker'

interface SubmitPostFormProps {
  sessionId: string
  onSubmitted: () => void
}

export function SubmitPostForm({ sessionId, onSubmitted }: SubmitPostFormProps) {
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/partner/repost/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, postUrl: url.trim() }),
      })

      if (!res.ok) {
        const j = await res.json()
        setError(j.error || 'Failed to submit')
        return
      }

      trackEvent('post_url_submitted', { post_url: url.trim() })
      setSubmitted(true)
      onSubmitted()
    } catch {
      setError('Network error')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center space-y-2">
        <Check className="h-8 w-8 text-emerald-400 mx-auto" />
        <p className="text-sm font-semibold text-emerald-400">Post submitted!</p>
        <p className="text-xs text-zinc-400">We'll verify and track your commission.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
      <span className="text-sm font-semibold text-zinc-200">Submit Your Post Link</span>
      <p className="text-xs text-zinc-400">After you post, paste the link here so we can track it.</p>

      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://tiktok.com/@you/video/..."
          required
          className="w-full rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={!url.trim() || submitting}
          className="w-full rounded-lg bg-amber-500 text-amber-950 py-3 text-sm font-semibold hover:bg-amber-400 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
        >
          {submitting ? <WolfLoader variant="spinner" size={16} mode="amber" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Submitting...' : 'Submit Post'}
        </button>
      </form>
    </div>
  )
}
