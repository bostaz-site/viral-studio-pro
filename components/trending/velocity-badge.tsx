"use client"

import { Flame, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VelocityBadgeProps {
  score: number | null
  /** Show extended label (default: icon + number only) */
  showLabel?: boolean
  className?: string
}

function getVelocityTier(score: number | null): {
  label: string
  icon: 'flame' | 'trending' | 'flat'
  colorClass: string
  animate: boolean
} {
  if (score === null || score === 0) {
    return { label: 'Flat', icon: 'flat', colorClass: 'text-muted-foreground bg-muted border-border', animate: false }
  }
  if (score >= 80) {
    return { label: 'Viral', icon: 'flame', colorClass: 'text-orange-400 bg-orange-500/15 border-orange-500/30', animate: true }
  }
  if (score >= 50) {
    return { label: 'Hot', icon: 'flame', colorClass: 'text-yellow-400 bg-yellow-500/15 border-yellow-500/30', animate: false }
  }
  if (score >= 20) {
    return { label: 'Rising', icon: 'trending', colorClass: 'text-blue-400 bg-blue-500/15 border-blue-500/30', animate: false }
  }
  return { label: 'Slow', icon: 'flat', colorClass: 'text-muted-foreground bg-muted/50 border-border', animate: false }
}

export function VelocityBadge({ score, showLabel = false, className }: VelocityBadgeProps) {
  const tier = getVelocityTier(score)

  const Icon =
    tier.icon === 'flame' ? Flame :
    tier.icon === 'trending' ? TrendingUp :
    Minus

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold',
        tier.colorClass,
        className
      )}
      title={`Velocity Score: ${score ?? 0}`}
    >
      <Icon
        className={cn(
          'h-3 w-3 shrink-0',
          tier.animate && 'animate-pulse'
        )}
      />
      {score !== null ? score.toFixed(1) : '--'}
      {showLabel && <span className="font-medium opacity-80">{tier.label}</span>}
    </span>
  )
}
