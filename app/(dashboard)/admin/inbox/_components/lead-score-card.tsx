'use client'

import { useState } from 'react'
import { RefreshCw, Loader2 } from 'lucide-react'

interface LeadScoreCardProps {
  influencerId: string
  score: number
  onScoreUpdated?: (newScore: number) => void
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-green-400'
  if (score >= 50) return 'text-amber-400'
  if (score >= 25) return 'text-orange-400'
  return 'text-red-400'
}

function barColor(score: number): string {
  if (score >= 75) return 'bg-green-500'
  if (score >= 50) return 'bg-amber-500'
  if (score >= 25) return 'bg-orange-500'
  return 'bg-red-500'
}

export function LeadScoreCard({ influencerId, score, onScoreUpdated }: LeadScoreCardProps) {
  const [rescoring, setRescoring] = useState(false)
  const [currentScore, setCurrentScore] = useState(score)

  const handleRescore = async () => {
    if (rescoring) return
    setRescoring(true)
    try {
      const res = await fetch('/api/admin/influencers/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ influencerId }),
      })
      const json = await res.json()
      if (json.data?.score != null) {
        setCurrentScore(json.data.score)
        onScoreUpdated?.(json.data.score)
      }
    } catch {
      // silent
    } finally {
      setRescoring(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold ${scoreColor(currentScore)}`}>{currentScore}</span>
      <div className="flex-1 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor(currentScore)}`}
          style={{ width: `${currentScore}%` }}
        />
      </div>
      <button
        onClick={handleRescore}
        disabled={rescoring}
        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50"
        title="Re-score"
      >
        {rescoring ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className="h-3 w-3" />
        )}
      </button>
    </div>
  )
}
