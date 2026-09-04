'use client'

import { cn } from '@/lib/utils'
import {
  CRITERION_KEYS,
  CRITERION_LABELS,
  computeCriteriaScore,
  type ClipAnalysis,
  type CriterionKey,
} from '@/lib/enhance/clip-criteria'

/**
 * P5 · The 4-criteria grid (Monster Lab): Unexpected / Emotion / Info / Density,
 * each 0-10, plus the one-sentence "why". Compact by design — sits right under
 * the Blowup Chance bar and inside the AI analysis result card.
 */
interface CriteriaGridProps {
  analysis: ClipAnalysis
  /** 'compact' = 2x2 grid with thin bars (default). 'inline' = single row, no hints. */
  variant?: 'compact' | 'inline'
  /** Show the weighted 0-100 score + verdict pill on the header line. */
  showScore?: boolean
  className?: string
}

const BAR_COLORS: Record<CriterionKey, string> = {
  unexpected: 'from-fuchsia-500 to-pink-400',
  emotion: 'from-orange-500 to-amber-400',
  informative: 'from-sky-500 to-cyan-400',
  density: 'from-emerald-500 to-lime-400',
}

const VERDICT_STYLE: Record<ClipAnalysis['verdict'], { label: string; cls: string }> = {
  strong: { label: 'Strong clip', cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  ok: { label: 'Needs tight edit', cls: 'text-amber-300 bg-amber-500/10 border-amber-500/30' },
  weak: { label: 'Weak clip', cls: 'text-red-300 bg-red-500/10 border-red-500/30' },
}

export function CriteriaGrid({ analysis, variant = 'compact', showScore = true, className }: CriteriaGridProps) {
  const score = computeCriteriaScore(analysis)
  const verdict = VERDICT_STYLE[analysis.verdict]

  return (
    <div className={cn('rounded-xl border border-white/10 bg-card/40 px-3 py-2.5', className)}>
      {/* Header: title + score + verdict */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Why this clip</span>
        {showScore && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-black text-white tabular-nums">{score}<span className="text-zinc-500 font-semibold">/100</span></span>
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border', verdict.cls)}>{verdict.label}</span>
          </div>
        )}
      </div>

      {/* 4 bars */}
      <div className={cn(variant === 'inline' ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-2 gap-x-3 gap-y-1.5')}>
        {CRITERION_KEYS.map((key) => {
          const value = analysis[key]
          const pct = Math.max(0, Math.min(100, (value / 10) * 100))
          const weak = value < 4
          return (
            <div key={key} className="min-w-0" title={CRITERION_LABELS[key].hint}>
              <div className="flex items-center justify-between mb-0.5">
                <span className={cn('text-[10px] font-semibold truncate', weak ? 'text-zinc-500' : 'text-zinc-300')}>
                  {CRITERION_LABELS[key].label}
                </span>
                <span className={cn('text-[10px] font-bold tabular-nums ml-1', weak ? 'text-zinc-500' : 'text-white')}>
                  {Number.isInteger(value) ? value : value.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700 ease-out', BAR_COLORS[key], weak && 'opacity-50')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* One-sentence why */}
      {analysis.why && (
        <p className="text-[11px] text-zinc-400 leading-snug mt-2">
          {analysis.why}
        </p>
      )}
    </div>
  )
}
