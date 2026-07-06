'use client'

import { useState } from 'react'
import { FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'

interface ThreadSummaryProps {
  influencerId: string
  messageCount: number
}

interface SummaryData {
  summary: string
  status: string
  key_points: string[]
  next_action: string
}

const STATUS_COLORS: Record<string, string> = {
  engaged: 'text-green-400',
  hesitant: 'text-amber-400',
  declined: 'text-red-400',
  waiting: 'text-cyan-400',
  onboarding: 'text-amber-400',
}

export function ThreadSummary({ influencerId, messageCount }: ThreadSummaryProps) {
  const [summary, setSummary] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  // Only show for threads with 5+ messages
  if (messageCount < 5) return null

  const handleGenerate = async () => {
    if (loading) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/inbox/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerId }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Failed')
        return
      }

      setSummary(json.data)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!summary) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <WolfLoader variant="spinner" size={14} mode="amber" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          {loading ? 'Generating summary...' : `Summarize thread (${messageCount} messages)`}
        </button>
        {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 w-full"
      >
        <FileText className="h-3.5 w-3.5 text-zinc-500" />
        Thread Summary
        <span className={`text-[10px] ml-1 ${STATUS_COLORS[summary.status] ?? 'text-zinc-400'}`}>
          ({summary.status})
        </span>
        <span className="ml-auto">
          {expanded ? <ChevronUp className="h-3 w-3 text-zinc-500" /> : <ChevronDown className="h-3 w-3 text-zinc-500" />}
        </span>
      </button>

      {expanded && (
        <>
          <p className="text-xs text-zinc-400 leading-relaxed">{summary.summary}</p>

          {summary.key_points.length > 0 && (
            <ul className="space-y-0.5">
              {summary.key_points.map((pt, i) => (
                <li key={i} className="text-[10px] text-zinc-500 flex items-start gap-1">
                  <span className="text-zinc-600 mt-0.5">-</span> {pt}
                </li>
              ))}
            </ul>
          )}

          <div className="text-[10px] text-amber-400/80 border-t border-zinc-800 pt-1.5 mt-1">
            Next: {summary.next_action}
          </div>
        </>
      )}
    </div>
  )
}
