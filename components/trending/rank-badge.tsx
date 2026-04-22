"use client"

import { cn } from '@/lib/utils'
import type { ClipRank } from '@/types/trending'

interface RankBadgeProps {
  rank: ClipRank
  score: number | null
  className?: string
}

const RANK_CONFIG: Record<ClipRank, {
  label: string
  icon: string
  colorClass: string
  glowClass: string
  animate: boolean
}> = {
  common: {
    label: 'Common',
    icon: '',
    colorClass: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
    glowClass: '',
    animate: false,
  },
  rare: {
    label: 'Rare',
    icon: '',
    colorClass: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    glowClass: 'hover:shadow-[0_0_8px_rgba(59,130,246,0.3)]',
    animate: false,
  },
  super_rare: {
    label: 'Super Rare',
    icon: '',
    colorClass: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    glowClass: 'hover:shadow-[0_0_10px_rgba(168,85,247,0.35)]',
    animate: false,
  },
  epic: {
    label: 'Epic',
    icon: '',
    colorClass: 'text-orange-400 bg-orange-500/10 border-orange-500/40',
    glowClass: 'shadow-[0_0_8px_rgba(249,115,22,0.25)]',
    animate: false,
  },
  legendary: {
    label: 'Legendary',
    icon: '',
    colorClass: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/50',
    glowClass: 'shadow-[0_0_14px_rgba(234,179,8,0.4)]',
    animate: true,
  },
  master: {
    label: 'Master',
    icon: '',
    colorClass: 'text-red-400 bg-gradient-to-r from-red-500/15 to-orange-500/15 border-red-500/50',
    glowClass: 'shadow-[0_0_18px_rgba(239,68,68,0.5)]',
    animate: true,
  },
}

/** Color dot for rank — small colored circle */
function RankDot({ rank }: { rank: ClipRank }) {
  const dotColors: Record<ClipRank, string> = {
    common: 'bg-zinc-500',
    rare: 'bg-blue-500',
    super_rare: 'bg-purple-500',
    epic: 'bg-orange-500',
    legendary: 'bg-yellow-400',
    master: 'bg-red-500',
  }
  return (
    <span className={cn(
      'inline-block w-2 h-2 rounded-full shrink-0',
      dotColors[rank],
      rank === 'legendary' && 'shadow-[0_0_6px_rgba(234,179,8,0.6)]',
      rank === 'master' && 'shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse',
    )} />
  )
}

export function RankBadge({ rank, score, className }: RankBadgeProps) {
  const cfg = RANK_CONFIG[rank]

  // Common = minimal, just score
  if (rank === 'common') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border',
        cfg.colorClass,
        className
      )}>
        <RankDot rank={rank} />
        <span className="tabular-nums">{score !== null ? score.toFixed(0) : '--'}</span>
      </span>
    )
  }

  // Higher ranks = show label for epic+
  const showLabel = rank === 'epic' || rank === 'legendary' || rank === 'master'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-bold transition-all',
        showLabel ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs',
        cfg.colorClass,
        cfg.glowClass,
        className
      )}
      title={`${cfg.label} · Score ${score ?? 0}/100`}
    >
      <RankDot rank={rank} />
      <span className="tabular-nums">{score !== null ? score.toFixed(0) : '--'}</span>
      {showLabel && (
        <span className="font-semibold opacity-90">{cfg.label}</span>
      )}
    </span>
  )
}

/** Card wrapper class for rank-based border animations */
export function getRankCardClass(rank: ClipRank): string {
  switch (rank) {
    case 'master':
      return 'card-champion'
    case 'legendary':
      return 'card-diamond'
    case 'epic':
      return 'card-gold'
    default:
      return ''
  }
}

export { RANK_CONFIG }
