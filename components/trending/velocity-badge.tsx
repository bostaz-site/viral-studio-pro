"use client"

import { Flame, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VelocityBadgeProps {
  score: number | null
  className?: string
}

function getVelocityTier(score: number | null): {
  label: string
  icon: 'flame' | 'trending' | 'flat'
  colorClass: string
  ringClass: string
  animate: boolean
  size: 'lg' | 'md' | 'sm'
} {
  if (score === null || score === 0) {
    return { label: 'Flat', icon: 'flat', colorClass: 'text-muted-foreground bg-muted border-border', ringClass: '', animate: false, size: 'sm' }
  }
  if (score >= 80) {
    return { label: 'Viral', icon: 'flame', colorClass: 'text-orange-300 bg-orange-500/25 border-orange-400/60', ringClass: 'shadow-[0_0_8px_2px_rgba(249,115,22,0.45)]', animate: true, size: 'lg' }
  }
  if (score >= 50) {
    return { label: 'Hot', icon: 'flame', colorClass: 'text-yellow-300 bg-yellow-500/20 border-yellow-400/50', ringClass: 'shadow-[0_0_6px_1px_rgba(234,179,8,0.3)]', animate: false, size: 'md' }
  }
  if (score >= 20) {
    return { label: 'Rising', icon: 'trending', colorClass: 'text-blue-400 bg-blue-500/15 border-blue-500/30', ringClass: '', animate: false, size: 'sm' }
  }
  return { label: 'Slow', icon: 'flat', colorClass: 'text-muted-foreground bg-muted/50 border-border', ringClass: '', animate: false, size: 'sm' }
}

export function VelocityBadge({ score, className }: VelocityBadgeProps) {
  const tier = getVelocityTier(score)

  const Icon =
    tier.icon === 'flame' ? Flame :
    tier.icon === 'trending' ? TrendingUp :
    Minus

  const isLarge = tier.size === 'lg'
  const isMid = tier.size === 'md'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-bold transition-all',
        isLarge ? 'px-2.5 py-1 text-sm' : isMid ? 'px-2 py-0.5 text-xs' : 'px-1.5 py-0.5 text-[11px]',
        tier.colorClass,
        tier.ringClass,
        className
      )}
      title={`Algo Score: ${score ?? 0}/100`}
    >
      <Icon
        className={cn(
          isLarge ? 'h-3.5 w-3.5' : 'h-3 w-3',
          'shrink-0',
          tier.animate && 'animate-pulse'
        )}
      />
      <span className="tabular-nums">{score !== null ? score.toFixed(0) : '--'}</span>
      {(isLarge || isMid) && (
        <span className="font-semibold opacity-90">{tier.label}</span>
      )}
    </span>
  )
}
