'use client'

const SENTIMENT_CONFIG: Record<string, { label: string; className: string }> = {
  positive: { label: 'Positive', className: 'bg-green-500/15 text-green-400' },
  neutral: { label: 'Neutral', className: 'bg-cyan-500/15 text-cyan-400' },
  neutral_question: { label: 'Question', className: 'bg-sky-500/15 text-sky-400' },
  negative: { label: 'Negative', className: 'bg-red-500/15 text-red-400' },
  spam: { label: 'Spam', className: 'bg-zinc-500/15 text-zinc-400' },
  hostile: { label: 'Hostile', className: 'bg-red-700/15 text-red-500' },
}

interface SentimentBadgeProps {
  sentiment: string | null
  confidence?: number | null
  size?: 'xs' | 'sm'
}

export function SentimentBadge({ sentiment, confidence, size = 'xs' }: SentimentBadgeProps) {
  if (!sentiment) return null

  const config = SENTIMENT_CONFIG[sentiment] ?? { label: sentiment, className: 'bg-zinc-500/15 text-zinc-400' }
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-[10px] px-1.5 py-0.5'

  return (
    <span className={`inline-flex items-center gap-1 rounded ${sizeClass} font-medium ${config.className}`}>
      {config.label}
      {confidence != null && (
        <span className="opacity-60">{Math.round(confidence * 100)}%</span>
      )}
    </span>
  )
}
