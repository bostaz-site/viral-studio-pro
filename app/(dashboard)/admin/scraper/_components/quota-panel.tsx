'use client'

import { Zap } from 'lucide-react'

interface Props {
  used: number
  limit: number
}

export function QuotaPanel({ used, limit }: Props) {
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0

  return (
    <div className="flex items-center gap-3 text-xs">
      <Zap className={`h-3.5 w-3.5 ${pct > 90 ? 'text-red-400' : pct > 70 ? 'text-amber-400' : 'text-green-400'}`} />
      <span className="text-muted-foreground">YouTube API:</span>
      <span className="font-mono text-foreground">{used.toLocaleString()} / {limit.toLocaleString()}</span>
      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full ${pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-amber-400' : 'bg-green-400'}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}
