'use client'

import { useEffect } from 'react'
import { RefreshCw, Loader2, Clock, Users, Eye, Film, TrendingUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccountStore } from '@/stores/account-store'
import { CREATOR_RANK_CONFIG, type CreatorRank } from '@/lib/scoring/account-scorer'
import { cn } from '@/lib/utils'

function ScoreBar({ label, score, color, icon: Icon }: {
  label: string; score: number; color: string; icon: typeof TrendingUp
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Icon className="h-3 w-3" />{label}
        </span>
        <span className="font-semibold tabular-nums">{score.toFixed(0)}</span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${Math.min(100, score)}%` }} />
      </div>
    </div>
  )
}

const RANK_MESSAGES: Record<CreatorRank, string> = {
  newcomer: "Everyone starts here. Connect your accounts and start climbing. \u{1F331}",
  creator: "You're building momentum. Your breakout is coming. \u2728",
  trending_creator: "The algorithm is starting to notice you. \u{1F525}",
  viral_creator: "You've cracked the code. Your content consistently outperforms. \u26A1",
  elite_creator: "Top 5% of creators. You don't follow trends, you SET them. \u{1F48E}",
  legendary: "You're the algorithm's favorite. Everything you post has viral DNA. \u{1F410}",
  hidden_gem: "Your content is INSANE for your audience size. You're criminally underrated. \u{1F525}",
}

function getRankCardStyle(rank: CreatorRank): string {
  switch (rank) {
    case 'legendary':
      return 'border-[#FF4500]/50 shadow-lg shadow-[#FF4500]/10 bg-gradient-to-br from-card via-card to-[#FF4500]/5'
    case 'elite_creator':
      return 'border-[#7DF9FF]/40 shadow-lg shadow-[#7DF9FF]/10 bg-gradient-to-br from-card via-card to-[#7DF9FF]/5'
    case 'hidden_gem':
      return 'border-orange-500/40 shadow-lg shadow-orange-500/10 bg-gradient-to-br from-card via-card to-orange-500/5'
    case 'viral_creator':
      return 'border-[#FFD700]/30 shadow-md shadow-[#FFD700]/5'
    default:
      return 'border-border'
  }
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
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

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
      <Card className="border-border">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
    )
  }

  const rank = score?.creator_rank ?? 'newcomer'
  const rankCfg = CREATOR_RANK_CONFIG[rank]
  const hasScore = score != null

  return (
    <Card className={cn(getRankCardStyle(rank))}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Creator Rank</h3>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={syncAccount}
            disabled={syncing || !canSyncToday}
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {syncing ? 'Syncing...' : canSyncToday ? 'Sync Now' : 'Synced today'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Rank badge + score */}
        {hasScore ? (
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center shrink-0',
              rank === 'legendary' && 'bg-gradient-to-br from-[#FF4500]/20 to-[#FFD700]/20 shadow-inner',
              rank === 'elite_creator' && 'bg-gradient-to-br from-[#7DF9FF]/20 to-[#4169E1]/20 shadow-inner',
              rank === 'hidden_gem' && 'bg-gradient-to-br from-orange-500/20 to-red-500/20 shadow-inner',
              rank === 'viral_creator' && 'bg-[#FFD700]/10',
              !['legendary', 'elite_creator', 'hidden_gem', 'viral_creator'].includes(rank) && 'bg-muted/30',
            )}>
              <span className="text-3xl">{rankCfg.emoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-lg font-bold', rankCfg.color)}>{rankCfg.label}</p>
              <p className="text-2xl font-black text-foreground tabular-nums">{score.creator_score}<span className="text-sm font-normal text-muted-foreground">/100</span></p>
            </div>
            {username && (
              <Badge variant="outline" className="ml-auto text-xs shrink-0">
                YouTube: {username}
              </Badge>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              Connect your YouTube channel and sync to get your Creator Rank.
            </p>
          </div>
        )}

        {/* Motivational message */}
        {hasScore && (
          <p className="text-xs text-center text-muted-foreground italic">
            {RANK_MESSAGES[rank]}
          </p>
        )}

        {/* Hidden Gem banner */}
        {rank === 'hidden_gem' && (
          <div className="px-3 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/5">
            <p className="text-xs font-bold text-orange-400">
              Hidden Gem detected — Your content outperforms your audience size. You're about to explode.
            </p>
          </div>
        )}

        {/* Score breakdown */}
        {hasScore && score.performance_score > 0 && (
          <div className="space-y-2">
            <ScoreBar label="Performance" score={score.performance_score} color="bg-blue-500" icon={Zap} />
            <ScoreBar label="Engagement" score={score.engagement_score} color="bg-pink-500" icon={TrendingUp} />
            <ScoreBar label="Growth" score={score.growth_score} color="bg-green-500" icon={TrendingUp} />
            <ScoreBar label="Audience" score={score.audience_score} color="bg-purple-500" icon={Users} />
            <ScoreBar label="Consistency" score={score.consistency_score} color="bg-amber-500" icon={Clock} />
          </div>
        )}

        {/* Quick stats */}
        {hasScore && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{formatCount(followers)}</p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Users className="h-2.5 w-2.5" />Subscribers
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{formatCount(medianViews)}</p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Eye className="h-2.5 w-2.5" />Median views
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{videoCount}</p>
              <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                <Film className="h-2.5 w-2.5" />Videos
              </p>
            </div>
          </div>
        )}

        {/* Engagement rate */}
        {hasScore && engagementRate > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Engagement rate: {(engagementRate * 100).toFixed(2)}%
          </p>
        )}

        {/* Last synced + next sync */}
        {lastSyncedAt && (
          <p className="text-[10px] text-muted-foreground text-center">
            Last synced: {formatTimeAgo(lastSyncedAt)}
            {!canSyncToday && <span className="ml-2">&middot; {nextSyncLabel(lastSyncedAt)}</span>}
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        {/* Platform list (prepared for multi-platform) */}
        <div className="pt-2 border-t border-border space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">YouTube</span>
            {hasScore ? (
              <span className={cn('font-semibold', rankCfg.color)}>
                {rankCfg.emoji} {score.creator_score}
              </span>
            ) : (
              <span className="text-muted-foreground/60">Not synced</span>
            )}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">TikTok</span>
            <span className="text-muted-foreground/60">Coming soon</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Instagram</span>
            <span className="text-muted-foreground/60">Coming soon</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
