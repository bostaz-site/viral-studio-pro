'use client'

import { Target } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface Props {
  target: number
  current: number
  label: string
}

export function WeeklyGoal({ target, current, label }: Props) {
  const pct = Math.min(100, Math.round((current / target) * 100))

  return (
    <Card className="border-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-sm font-bold text-primary ml-auto">{current} / {target}</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct >= 100 ? 'bg-green-400' : pct >= 70 ? 'bg-primary' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-right">{pct}% complete</p>
      </CardContent>
    </Card>
  )
}
