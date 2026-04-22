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
  hoverOnly: boolean
}> = {
  unranked: {
    label: '',
    icon: '',
    colorClass: 'text-gray-500/60 bg-gray-500/10 border-gray-500/20',
    glowClass: '',
    animate: false,
    hoverOnly: false,
  },
  bronze: {
    label: 'Bronze',
    icon: '🥉',
    colorClass: 'text-[#CD7F32] bg-[#CD7F32]/10 border-[#CD7F32]/30',
    glowClass: '',
    animate: false,
    hoverOnly: false,
  },
  silver: {
    label: 'Silver',
    icon: '🥈',
    colorClass: 'text-[#C0C0C0] bg-[#C0C0C0]/10 border-[#C0C0C0]/30',
    glowClass: 'hover:shadow-[0_0_8px_rgba(192,192,192,0.3)]',
    animate: false,
    hoverOnly: true,
  },
  gold: {
    label: 'Gold',
    icon: '🥇',
    colorClass: 'text-[#FFD700] bg-[#FFD700]/10 border-[#FFD700]/30',
    glowClass: 'hover:shadow-[0_0_12px_rgba(255,215,0,0.4)]',
    animate: false,
    hoverOnly: true,
  },
  platinum: {
    label: 'Platinum',
    icon: '💎',
    colorClass: 'text-[#7DF9FF] bg-[#7DF9FF]/10 border-[#7DF9FF]/40',
    glowClass: 'shadow-[0_0_8px_rgba(125,249,255,0.25)]',
    animate: false,
    hoverOnly: false,
  },
  diamond: {
    label: 'Diamond',
    icon: '💠',
    colorClass: 'text-[#B9F2FF] bg-[#4169E1]/15 border-[#4169E1]/50',
    glowClass: 'shadow-[0_0_12px_rgba(65,105,225,0.4)]',
    animate: true,
    hoverOnly: false,
  },
  champion: {
    label: 'Champion',
    icon: '👑',
    colorClass: 'text-[#FFD700] bg-gradient-to-r from-[#FF4500]/15 to-[#FFD700]/15 border-[#FF4500]/50',
    glowClass: 'shadow-[0_0_16px_rgba(255,69,0,0.5)]',
    animate: true,
    hoverOnly: false,
  },
}

export function RankBadge({ rank, score, className }: RankBadgeProps) {
  if (rank === 'unranked') {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] font-medium border opacity-60',
        RANK_CONFIG.unranked.colorClass,
        className
      )}>
        <span className="tabular-nums">{score !== null ? score.toFixed(0) : '--'}</span>
      </span>
    )
  }

  const cfg = RANK_CONFIG[rank]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border font-bold transition-all',
        rank === 'champion' || rank === 'diamond' ? 'px-2.5 py-1 text-sm' : 'px-2 py-0.5 text-xs',
        cfg.colorClass,
        cfg.glowClass,
        className
      )}
      title={`${cfg.label} · Score ${score ?? 0}/100`}
    >
      <span>{cfg.icon}</span>
      <span className="tabular-nums">{score !== null ? score.toFixed(0) : '--'}</span>
      {(rank === 'platinum' || rank === 'diamond' || rank === 'champion') && (
        <span className="font-semibold opacity-90">{cfg.label}</span>
      )}
    </span>
  )
}

/** Card wrapper class for rank-based border animations */
export function getRankCardClass(rank: ClipRank): string {
  switch (rank) {
    case 'champion':
      return 'card-champion'
    case 'diamond':
      return 'card-diamond'
    case 'gold':
      return 'card-gold'
    default:
      return ''
  }
}

export { RANK_CONFIG }
