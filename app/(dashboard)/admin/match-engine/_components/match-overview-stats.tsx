'use client'

import { Card, CardContent } from '@/components/ui/card'

interface MatchStats {
  totalMatched: number
  totalUnmatched: number
  totalFallbacks: number
  totalOverrides: number
  avgScore: number
}

export function MatchOverviewStats({ stats }: { stats: MatchStats }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <Card><CardContent className="text-center py-4">
        <p className="text-2xl font-bold text-amber-400">{stats.totalMatched}</p>
        <p className="text-xs text-zinc-500">Matched</p>
      </CardContent></Card>
      <Card><CardContent className="text-center py-4">
        <p className="text-2xl font-bold text-zinc-400">{stats.totalUnmatched}</p>
        <p className="text-xs text-zinc-500">Unmatched</p>
      </CardContent></Card>
      <Card><CardContent className="text-center py-4">
        <p className="text-2xl font-bold text-orange-400">{stats.totalFallbacks}</p>
        <p className="text-xs text-zinc-500">Fallbacks</p>
      </CardContent></Card>
      <Card><CardContent className="text-center py-4">
        <p className="text-2xl font-bold text-cyan-400">{stats.totalOverrides}</p>
        <p className="text-xs text-zinc-500">Overrides</p>
      </CardContent></Card>
      <Card><CardContent className="text-center py-4">
        <p className="text-2xl font-bold text-zinc-200">{stats.avgScore}</p>
        <p className="text-xs text-zinc-500">Avg Score</p>
      </CardContent></Card>
    </div>
  )
}
