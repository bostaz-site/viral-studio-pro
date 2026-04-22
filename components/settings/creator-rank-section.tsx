'use client'

import { useEffect } from 'react'
import { RefreshCw, Loader2, Clock, Users, Eye, Film, TrendingUp, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccountStore } from '@/stores/account-store'
import { CREATOR_RANK_CONFIG } from '@/lib/scoring/account-scorer'
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

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
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
    <Card className="border-border">
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
            <div className="flex items-center gap-2">
              <span className="text-3xl">{rankCfg.emoji}</span>
              <div>
                <p className={cn('text-lg font-bold', rankCfg.color)}>{rankCfg.label}</p>
                <p className="text-xs text-muted-foreground">Score: {score.creator_score}/100</p>
              </div>
            </div>
            {username && (
              <Badge variant="outline" className="ml-auto text-xs">
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

        {/* Hidden Gem banner */}
        {rank === 'hidden_gem' && (
          <div className="px-3 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/5">
            <p className="text-xs font-bold text-orange-400">
              🔥 Hidden Gem — Your content outperforms your audience size. You're underrated!
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

        {/* Last synced */}
        {lastSyncedAt && (
          <p className="text-[10px] text-muted-foreground text-center">
            Last synced: {formatTimeAgo(lastSyncedAt)}
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
