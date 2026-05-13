'use client'

import { Shield, Ban, Clock, FileWarning } from 'lucide-react'

interface SuppressionStatsProps {
  totalSuppressed: number
  blocksToday: number
  blocksThisWeek: number
  gdprPending: number
}

export function SuppressionStats({ totalSuppressed, blocksToday, blocksThisWeek, gdprPending }: SuppressionStatsProps) {
  const cards = [
    { label: 'Total Suppressed', value: totalSuppressed, icon: Shield, color: 'text-red-400', bg: 'bg-red-500/10' },
    { label: 'Blocks Today', value: blocksToday, icon: Ban, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Blocks This Week', value: blocksThisWeek, icon: Clock, color: 'text-sky-400', bg: 'bg-sky-500/10' },
    { label: 'GDPR Requests', value: gdprPending, icon: FileWarning, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${c.bg}`}>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </div>
            <span className="text-xs text-zinc-500">{c.label}</span>
          </div>
          <span className={`text-2xl font-bold ${c.value > 0 ? c.color : 'text-zinc-400'}`}>
            {c.value}
          </span>
        </div>
      ))}
    </div>
  )
}
