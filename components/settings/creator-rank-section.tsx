'use client'

import { useEffect } from 'react'
import { RefreshCw, Loader2, Clock, Users, Eye, Film, TrendingUp, Zap, Crown, Trophy, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccountStore } from '@/stores/account-store'
import { CREATOR_RANK_CONFIG, type CreatorRank } from '@/lib/scoring/account-scorer'
import { cn } from '@/lib/utils'

/* ── Score bar with glow ─────────────────────────────────────────────── */
function ScoreBar({ label, score, color, glowColor, icon: Icon }: {
  label: string; score: number; color: string; glowColor: string; icon: typeof TrendingUp
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-zinc-400 font-medium">
          <Icon className="h-3.5 w-3.5" />{label}
        </span>
        <span className="font-bold tabular-nums text-white">{score.toFixed(0)}</span>
      </div>
      <div className="h-2.5 bg-white/5 rounded-full overflow-hidden relative">
        <div
          className={cn('h-full rounded-full transition-all duration-1000 ease-out relative', color)}
          style={{
            width: `${Math.min(100, score)}%`,
            boxShadow: score > 30 ? `0 0 12px ${glowColor}` : 'none',
          }}
        />
      </div>
    </div>
  )
}

const RANK_MESSAGES: Record<CreatorRank, string> = {
  newcomer: "Everyone starts here. Sync your channel and start climbing.",
  creator: "You're building momentum. Your breakout is coming.",
  trending_creator: "The algorithm is noticing you. Keep pushing.",
  viral_creator: "You cracked the code. Your content consistently outperforms.",
  elite_creator: "Top 5% of creators. You set trends, not follow them.",
  legendary: "The algorithm's favorite. Everything you post has viral DNA.",
  hidden_gem: "Your content is INSANE for your audience size. You're about to explode.",
}

const RANK_GRADIENTS: Record<CreatorRank, string> = {
  newcomer: 'from-zinc-600 to-zinc-500',
  creator: 'from-amber-700 to-amber-600',
  trending_creator: 'from-slate-400 to-slate-300',
  viral_creator: 'from-yellow-500 to-amber-400',
  elite_creator: 'from-cyan-400 to-blue-500',
  legendary: 'from-orange-500 via-red-500 to-pink-500',
  hidden_gem: 'from-orange-500 to-red-500',
}

const RANK_BORDER: Record<CreatorRank, string> = {
  newcomer: 'border-zinc-700/50',
  creator: 'border-amber-700/40',
  trending_creator: 'border-slate-400/30',
  viral_creator: 'border-yellow-500/40',
  elite_creator: 'border-cyan-400/40',
  legendary: 'border-orange-500/50',
  hidden_gem: 'border-orange-500/40',
}

const RANK_GLOW: Record<CreatorRank, string> = {
  newcomer: '',
  creator: '',
  trending_creator: '',
  viral_creator: 'shadow-[0_0_30px_rgba(234,179,8,0.15)]',
  elite_creator: 'shadow-[0_0_40px_rgba(34,211,238,0.2)]',
  legendary: 'shadow-[0_0_50px_rgba(249,115,22,0.25)]',
  hidden_gem: 'shadow-[0_0_40px_rgba(249,115,22,0.2)]',
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function nextSyncLabel(lastSyncedAt: string | null): string {
  if (!lastSyncedAt) return ''
  const synced = new Date(lastSyncedAt)
  const nextSync = new Date(synced.getTime() + 24 * 3600 * 1000)
  const hoursLeft = Math.max(0, Math.ceil((nextSync.getTime() - Date.now()) / 3600000))
  if (hoursLeft <= 0) return ''
  return `Next sync in ${hoursLeft}h`
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/* ── Circular score ring ─────────────────────────────────────────────── */
function ScoreRing({ value, rank }: { value: number; rank: CreatorRank }) {
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (value / 100) * circumference
  const gradient = RANK_GRADIENTS[rank]

  return (
    <div className="relative w-36 h-36 mx-auto">
      {/* Glow behind */}
      {['legendary', 'elite_creator', 'hidden_gem', 'viral_creator'].includes(rank) && (
        <div className={cn(
          'absolute inset-0 rounded-full blur-xl opacity-30 bg-gradient-to-br',
          gradient,
        )} />
      )}
      <svg className="w-36 h-36 -rotate-90 relative z-10" viewBox="0 0 120 120">
        {/* Background ring */}
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
        {/* Score ring */}
        <circle
          cx="60" cy="60" r="54" fill="none"
          stroke="url(#rankGradient)" strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        <defs>
          <linearGradient id="rankGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            {rank === 'legendary' && <><stop offset="0%" stopColor="#f97316" /><stop offset="50%" stopColor="#ef4444" /><stop offset="100%" stopColor="#ec4899" /></>}
            {rank === 'elite_creator' && <><stop offset="0%" stopColor="#22d3ee" /><stop offset="100%" stopColor="#3b82f6" /></>}
            {rank === 'hidden_gem' && <><stop offset="0%" stopColor="#f97316" /><stop offset="100%" stopColor="#ef4444" /></>}
            {rank === 'viral_creator' && <><stop offset="0%" stopColor="#eab308" /><stop offset="100%" stopColor="#f59e0b" /></>}
            {rank === 'trending_creator' && <><stop offset="0%" stopColor="#94a3b8" /><stop offset="100%" stopColor="#cbd5e1" /></>}
            {rank === 'creator' && <><stop offset="0%" stopColor="#b45309" /><stop offset="100%" stopColor="#d97706" /></>}
            {rank === 'newcomer' && <><stop offset="0%" stopColor="#71717a" /><stop offset="100%" stopColor="#a1a1aa" /></>}
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span className="text-4xl">{CREATOR_RANK_CONFIG[rank].emoji}</span>
        <span className="text-2xl font-black text-white tabular-nums mt-0.5">{value}</span>
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────── */
export function CreatorRankSection() {
  const {
    score, followers, totalViews, videoCount, medianViews,
    engagementRate, username, lastSyncedAt, canSyncToday,
    loading, syncing, error,
    fetchAccountScore, syncAccount,
  } = useAccountStore()

  useEffect(() => {
    fetchAccountScore()
  }, [fetchAccountScore])

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-36 w-36 rounded-full mx-auto" />
        <Skeleton className="h-4 w-56 mx-auto" />
      </div>
    )
  }

  const rank = score?.creator_rank ?? 'newcomer'
  const rankCfg = CREATOR_RANK_CONFIG[rank]
  const hasScore = score != null

  /* ── Empty / not synced state ──────────────────────────────────────── */
  if (!hasScore) {
    return (
      <div className="relative rounded-2xl border border-purple-500/30 bg-gradient-to-br from-card via-card to-purple-500/5 p-8 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />

        <div className="relative z-10 text-center space-y-5">
          <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center border border-purple-500/20">
            <Trophy className="h-10 w-10 text-purple-400" />
          </div>

          <div>
            <h3 className="text-xl font-bold text-white mb-1">Discover Your Creator Rank</h3>
            <p className="text-sm text-zinc-400 max-w-sm mx-auto">
              Sync your YouTube channel and we'll analyze your content to reveal your rank among creators.
            </p>
          </div>

          {/* Rank preview */}
          <div className="flex items-center justify-center gap-3 py-2">
            {(['newcomer', 'creator', 'trending_creator', 'viral_creator', 'elite_creator', 'legendary'] as CreatorRank[]).map((r) => (
              <div key={r} className="flex flex-col items-center gap-1 opacity-40 hover:opacity-80 transition-opacity">
                <span className="text-lg">{CREATOR_RANK_CONFIG[r].emoji}</span>
                <span className="text-[9px] text-zinc-500 font-medium">{CREATOR_RANK_CONFIG[r].label.split(' ')[0]}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={syncAccount}
            disabled={syncing}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold px-8 h-11 rounded-xl shadow-lg shadow-purple-500/20"
          >
            {syncing ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" />Analyzing your channel...</>
            ) : (
              <><Zap className="h-4 w-4 mr-2" />Sync & Reveal My Rank</>
            )}
          </Button>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* Platform status */}
          <div className="flex items-center justify-center gap-6 text-xs text-zinc-500 pt-2">
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-red-500/20 flex items-center justify-center">
                <span className="text-[8px]">YT</span>
              </div>
              Ready
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-zinc-700 flex items-center justify-center">
                <span className="text-[8px]">TK</span>
              </div>
              Soon
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded bg-zinc-700 flex items-center justify-center">
                <span className="text-[8px]">IG</span>
              </div>
              Soon
            </span>
          </div>
        </div>
      </div>
    )
  }

  /* ── Has score state ───────────────────────────────────────────────── */
  return (
    <div className={cn(
      'relative rounded-2xl border p-6 overflow-hidden',
      RANK_BORDER[rank],
      RANK_GLOW[rank],
      'bg-gradient-to-br from-card via-card to-card',
    )}>
      {/* Animated background for top ranks */}
      {rank === 'legendary' && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-pink-500/5 animate-pulse" style={{ animationDuration: '4s' }} />
      )}
      {rank === 'elite_creator' && (
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-blue-500/5" />
      )}
      {rank === 'hidden_gem' && (
        <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-red-500/5" />
      )}

      <div className="relative z-10 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-zinc-400" />
            <h3 className="text-lg font-bold text-white">Creator Rank</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8 rounded-lg border-zinc-700 hover:border-zinc-500"
            onClick={syncAccount}
            disabled={syncing || !canSyncToday}
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {syncing ? 'Syncing...' : canSyncToday ? 'Sync Now' : 'Synced'}
          </Button>
        </div>

        {/* Score ring + rank label */}
        <div className="space-y-2">
          <ScoreRing value={score.creator_score} rank={rank} />
          <div className="text-center">
            <p className={cn(
              'text-lg font-black tracking-wide',
              rank === 'legendary' && 'bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 bg-clip-text text-transparent',
              rank === 'elite_creator' && 'bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent',
              rank === 'hidden_gem' && 'bg-gradient-to-r from-orange-400 to-red-400 bg-clip-text text-transparent',
              rank === 'viral_creator' && 'text-yellow-400',
              rank === 'trending_creator' && 'text-slate-300',
              rank === 'creator' && 'text-amber-600',
              rank === 'newcomer' && 'text-zinc-400',
            )}>
              {rankCfg.label}
            </p>
            {username && (
              <p className="text-xs text-zinc-500 mt-0.5">YouTube: {username}</p>
            )}
          </div>
        </div>

        {/* Motivational message */}
        <div className={cn(
          'mx-auto max-w-sm text-center px-4 py-2.5 rounded-xl text-sm',
          rank === 'hidden_gem' ? 'bg-orange-500/10 border border-orange-500/20 text-orange-300 font-semibold' :
          rank === 'legendary' ? 'bg-orange-500/10 border border-orange-500/20 text-orange-300' :
          rank === 'elite_creator' ? 'bg-cyan-500/10 border border-cyan-500/20 text-cyan-300' :
          'bg-white/5 text-zinc-400',
        )}>
          {rank === 'hidden_gem' && <Flame className="h-4 w-4 inline mr-1.5 text-orange-400" />}
          {RANK_MESSAGES[rank]}
        </div>

        {/* Score breakdown */}
        {score.performance_score > 0 && (
          <div className="space-y-3 bg-white/[0.02] rounded-xl p-4 border border-white/5">
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Score Breakdown</p>
            <ScoreBar label="Performance" score={score.performance_score} color="bg-gradient-to-r from-blue-600 to-blue-400" glowColor="rgba(59,130,246,0.5)" icon={Zap} />
            <ScoreBar label="Engagement" score={score.engagement_score} color="bg-gradient-to-r from-pink-600 to-pink-400" glowColor="rgba(236,72,153,0.5)" icon={TrendingUp} />
            <ScoreBar label="Growth" score={score.growth_score} color="bg-gradient-to-r from-green-600 to-emerald-400" glowColor="rgba(16,185,129,0.5)" icon={TrendingUp} />
            <ScoreBar label="Audience" score={score.audience_score} color="bg-gradient-to-r from-purple-600 to-purple-400" glowColor="rgba(147,51,234,0.5)" icon={Users} />
            <ScoreBar label="Consistency" score={score.consistency_score} color="bg-gradient-to-r from-amber-600 to-amber-400" glowColor="rgba(245,158,11,0.5)" icon={Clock} />
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <p className="text-xl font-black text-white">{formatCount(followers)}</p>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5 flex items-center justify-center gap-1">
              <Users className="h-2.5 w-2.5" />Subscribers
            </p>
          </div>
          <div className="text-center bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <p className="text-xl font-black text-white">{formatCount(medianViews)}</p>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5 flex items-center justify-center gap-1">
              <Eye className="h-2.5 w-2.5" />Median views
            </p>
          </div>
          <div className="text-center bg-white/[0.03] rounded-xl p-3 border border-white/5">
            <p className="text-xl font-black text-white">{videoCount}</p>
            <p className="text-[10px] text-zinc-500 font-medium mt-0.5 flex items-center justify-center gap-1">
              <Film className="h-2.5 w-2.5" />Videos
            </p>
          </div>
        </div>

        {/* Engagement rate badge */}
        {engagementRate > 0 && (
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400">
              <TrendingUp className="h-3 w-3" />
              Engagement rate: <span className="font-bold text-white">{(engagementRate * 100).toFixed(2)}%</span>
            </div>
          </div>
        )}

        {/* Last synced */}
        {lastSyncedAt && (
          <p className="text-[10px] text-zinc-600 text-center">
            Last synced: {formatTimeAgo(lastSyncedAt)}
            {!canSyncToday && <span className="ml-2">· {nextSyncLabel(lastSyncedAt)}</span>}
          </p>
        )}

        {/* Error */}
        {error && <p className="text-xs text-red-400 text-center">{error}</p>}

        {/* Platform breakdown */}
        <div className="pt-3 border-t border-white/5 space-y-2">
          <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Platforms</p>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-400">
              <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center">
                <span className="text-[9px] font-bold text-red-400">YT</span>
              </div>
              YouTube
            </span>
            <span className={cn('font-bold', rankCfg.color)}>
              {rankCfg.emoji} {score.creator_score}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-600">
              <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center">
                <span className="text-[9px] font-bold text-zinc-600">TK</span>
              </div>
              TikTok
            </span>
            <span className="text-zinc-700 text-xs">Coming soon</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 text-zinc-600">
              <div className="w-5 h-5 rounded bg-zinc-800 flex items-center justify-center">
                <span className="text-[9px] font-bold text-zinc-600">IG</span>
              </div>
              Instagram
            </span>
            <span className="text-zinc-700 text-xs">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  )
}
