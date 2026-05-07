'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, TrendingUp, TrendingDown, Minus, Trophy } from 'lucide-react'
import { CREATOR_RANK_CONFIG, type CreatorRank } from '@/lib/scoring/account-scorer'

// Rank thresholds for progression bar
const RANK_THRESHOLDS: Array<{ rank: CreatorRank; min: number }> = [
  { rank: 'legend', min: 80 },
  { rank: 'apex', min: 60 },
  { rank: 'alpha', min: 40 },
  { rank: 'hunter', min: 20 },
  { rank: 'scout', min: 0 },
]

// Tier gradient for rank label
const RANK_GRADIENT: Record<CreatorRank, string> = {
  scout: 'from-zinc-400 to-zinc-500',
  hunter: 'from-amber-600 to-amber-500',
  alpha: 'from-cyan-300 to-blue-400',
  apex: 'from-orange-400 to-cyan-400',
  legend: 'from-orange-400 via-red-400 to-pink-400',
  hidden_gem: 'from-orange-400 to-red-400',
}

// Tier bar fill color
const RANK_BAR_COLOR: Record<CreatorRank, string> = {
  scout: 'rgba(161,161,170,0.6)',
  hunter: 'rgba(217,119,6,0.7)',
  alpha: 'rgba(56,189,248,0.8)',
  apex: 'rgba(249,115,22,0.8)',
  legend: 'rgba(249,115,22,0.9)',
  hidden_gem: 'rgba(249,115,22,0.7)',
}

interface CreatorRankHeroProps {
  score: number
  rank: CreatorRank
  lastSyncedAt: string | null
  syncing: boolean
  onSync: () => void
  canSyncToday: boolean
  // Optional: growth trend from snapshots
  scoreDelta?: number | null  // +5 means gained 5 pts this week
}

function getNextRank(currentRank: CreatorRank, score: number): {
  nextRank: CreatorRank | null
  nextThreshold: number
  currentMin: number
  progress: number
  ptsToNext: number
} {
  const currentIdx = RANK_THRESHOLDS.findIndex(t => t.rank === currentRank)
  const nextIdx = currentIdx - 1

  if (nextIdx < 0) {
    return { nextRank: null, nextThreshold: 100, currentMin: 90, progress: 100, ptsToNext: 0 }
  }

  const nextThreshold = RANK_THRESHOLDS[nextIdx].min
  const currentMin = RANK_THRESHOLDS[currentIdx].min
  const range = nextThreshold - currentMin
  const progress = range > 0 ? Math.min(100, Math.round(((score - currentMin) / range) * 100)) : 100
  const ptsToNext = Math.max(0, nextThreshold - score)

  return { nextRank: RANK_THRESHOLDS[nextIdx].rank, nextThreshold, currentMin, progress, ptsToNext }
}

function getSyncLabel(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return 'Never synced'
  const diffMin = Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 60000)
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  return `${Math.floor(diffMin / 1440)}d ago`
}

export function CreatorRankHero({
  score,
  rank,
  lastSyncedAt,
  syncing,
  onSync,
  canSyncToday,
  scoreDelta,
}: CreatorRankHeroProps) {
  const config = CREATOR_RANK_CONFIG[rank]
  const { nextRank, nextThreshold, progress, ptsToNext } = getNextRank(rank, score)
  const nextConfig = nextRank ? CREATOR_RANK_CONFIG[nextRank] : null
  const isMaxRank = nextRank === null
  const syncLabel = getSyncLabel(lastSyncedAt)

  // Score count-up animation (respects reduced motion)
  const [displayedScore, setDisplayedScore] = useState(0)
  const [barWidth, setBarWidth] = useState(0)
  useEffect(() => {
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setDisplayedScore(score)
      setBarWidth(progress)
      return
    }
    const duration = 800
    const start = performance.now()
    const animate = (now: number) => {
      const elapsed = now - start
      const t = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplayedScore(Math.round(score * eased))
      setBarWidth(progress * eased)
      if (t < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [score, progress])

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300" style={{
      background: 'rgba(15,23,42,0.6)',
      backdropFilter: 'blur(12px)',
      border: '1px solid rgba(56,189,248,0.15)',
      borderRadius: 16,
      padding: '20px 24px',
    }}>
      {/* Top row: Score ring + Rank info + Sync */}
      <div className="flex flex-wrap gap-5 items-center">
        {/* Score ring */}
        <div style={{ position: 'relative', width: 80, height: 80 }}>
          <svg viewBox="0 0 80 80" width={80} height={80}>
            {/* Background ring */}
            <circle cx={40} cy={40} r={34} fill="none" stroke="rgba(63,63,70,0.4)" strokeWidth={5} />
            {/* Progress ring */}
            <circle
              cx={40} cy={40} r={34}
              fill="none"
              stroke={RANK_BAR_COLOR[rank]}
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray={`${(displayedScore / 100) * 213.6} 213.6`}
              transform="rotate(-90 40 40)"
              style={{ filter: score >= 80 ? 'drop-shadow(0 0 4px rgba(56,189,248,0.5))' : undefined, transition: 'stroke-dasharray 0.1s' }}
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{displayedScore}</span>
            <span style={{ fontSize: 9, color: '#94A3B8', marginTop: 2 }}>/ 100</span>
          </div>
        </div>

        {/* Rank info */}
        <div className="flex-1 min-w-0">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>{config.emoji}</span>
            <span
              style={{
                fontSize: 16, fontWeight: 800, letterSpacing: '0.02em',
                backgroundImage: `linear-gradient(135deg, var(--tw-gradient-stops))`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}
              className={`bg-gradient-to-r ${RANK_GRADIENT[rank]}`}
            >
              {config.label.toUpperCase()}
            </span>
          </div>
          {/* Growth trend */}
          {scoreDelta != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              {scoreDelta > 0 ? (
                <>
                  <TrendingUp size={12} style={{ color: '#38BDF8' }} />
                  <span style={{ color: '#38BDF8', fontWeight: 600 }}>+{scoreDelta} this week</span>
                </>
              ) : scoreDelta < 0 ? (
                <>
                  <TrendingDown size={12} style={{ color: '#F87171' }} />
                  <span style={{ color: '#F87171', fontWeight: 600 }}>{scoreDelta} this week</span>
                </>
              ) : (
                <>
                  <Minus size={12} style={{ color: '#71717A' }} />
                  <span style={{ color: '#71717A' }}>Stable this week</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sync button */}
        <div style={{ textAlign: 'right' }}>
          <button
            onClick={onSync}
            disabled={!canSyncToday || syncing}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 8,
              background: canSyncToday && !syncing ? 'rgba(56,189,248,0.12)' : 'rgba(63,63,70,0.3)',
              border: `1px solid ${canSyncToday && !syncing ? 'rgba(56,189,248,0.3)' : 'rgba(63,63,70,0.4)'}`,
              color: canSyncToday && !syncing ? '#7DD3FC' : '#71717A',
              fontSize: 11, fontWeight: 500, cursor: canSyncToday && !syncing ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s',
            }}
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
          <p style={{ fontSize: 10, color: '#64748B', marginTop: 4 }}>
            {syncLabel}
          </p>
        </div>
      </div>

      {/* Progression bar */}
      <div style={{ marginTop: 16 }}>
        {isMaxRank ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#F59E0B' }}>
            <Trophy size={14} />
            <span style={{ fontWeight: 600 }}>Max rank reached</span>
          </div>
        ) : (
          <>
            <div style={{
              height: 6, borderRadius: 999,
              background: 'rgba(63,63,70,0.4)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%', borderRadius: 999,
                background: `linear-gradient(90deg, ${RANK_BAR_COLOR[rank]}, rgba(56,189,248,0.9))`,
                width: `${barWidth}%`,
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11 }}>
              <span style={{ color: '#94A3B8' }}>
                {score} / {nextThreshold} to <strong style={{ color: '#E2E8F0' }}>{nextConfig?.label}</strong>
              </span>
              <span style={{ color: '#64748B' }}>
                {ptsToNext} point{ptsToNext !== 1 ? 's' : ''} away
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
