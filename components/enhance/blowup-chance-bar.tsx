'use client'

import { cn } from '@/lib/utils'
import { Flame } from 'lucide-react'
import { getScoreLabel } from '@/lib/enhance/scoring'
import type { ScoreBreakdown } from '@/lib/enhance/scoring'

interface BlowupChanceBarProps {
  currentScore: number
  displayScore: number
  baselineScore: number
  scoreBreakdown: ScoreBreakdown
}

export function BlowupChanceBar({ currentScore, displayScore, baselineScore, scoreBreakdown }: BlowupChanceBarProps) {
  const total = currentScore
  const barColor = total >= 80
    ? { from: 'from-emerald-500', to: 'to-cyan-400', glow: 'shadow-emerald-500/30', text: 'text-emerald-300' }
    : total >= 60
    ? { from: 'from-amber-400', to: 'to-orange-400', glow: 'shadow-amber-500/25', text: 'text-amber-300' }
    : { from: 'from-orange-500', to: 'to-red-400', glow: 'shadow-orange-500/20', text: 'text-orange-300' }

  const totalWidth = Math.min(total, 99)

  return (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-white/5 -mx-1 px-1 pb-3 pt-1 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Flame className={cn('h-4 w-4 transition-colors duration-500', total >= 80 ? 'text-emerald-400' : 'text-orange-400')} />
          <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Blowup Chance</span>
        </div>
        <span className={cn(
          'text-xs font-bold uppercase tracking-wide transition-colors duration-300',
          getScoreLabel(currentScore).color
        )}>
          {getScoreLabel(currentScore).text}
        </span>
      </div>

      {/* Progress bar */}
      <div className={cn(
        'relative w-full h-8 rounded-full bg-card/60 border border-white/10 overflow-hidden transition-shadow duration-700',
        total >= 60 && `shadow-lg ${barColor.glow}`,
        total >= 80 && 'shadow-xl',
      )}>
        {/* Base segment */}
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-700 ease-out"
          style={{ width: `${baselineScore}%` }}
        />
        {/* Boost segment */}
        {scoreBreakdown.total > 0 && (
          <div
            className="absolute inset-y-0 bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
            style={{ left: `${baselineScore}%`, width: `${Math.min(scoreBreakdown.total, 99 - baselineScore)}%` }}
          />
        )}
        {/* Glow overlay pulse when score is high */}
        {total >= 70 && (
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-white/0 via-white/8 to-white/0 animate-[barGlow_3s_ease-in-out_infinite]"
            style={{ width: `${totalWidth}%` }}
          />
        )}
        {/* Score text */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black text-white drop-shadow-md">
            {displayScore} / 100
            {scoreBreakdown.total > 0 && (
              <span className="text-emerald-300 text-xs font-bold ml-1.5 animate-[scorePop_0.4s_ease-out]">(+{scoreBreakdown.total})</span>
            )}
          </span>
        </div>
      </div>

      {/* Congrats message — only triggers when user has applied enhancements AND score is in legendary range */}
      {/* Requires (1) score >= 95 AND (2) user has added at least 10 points via enhancements */}
      {total >= 95 && scoreBreakdown.total >= 10 && (
        <div className="flex items-center gap-1.5 mt-2 animate-[confettiDrop_0.5s_ease-out]">
          <span className="text-sm">🔥</span>
          <span className="text-xs font-semibold text-emerald-400">Maximum viral potential reached!</span>
        </div>
      )}
    </div>
  )
}
