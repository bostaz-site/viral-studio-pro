"use client"

import { useState } from 'react'
import { X, ExternalLink, Eye, Heart, Clapperboard, Clock, Globe, Flame, Copy, Check, Zap, Diamond, TrendingUp, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { RankBadge } from '@/components/trending/rank-badge'
import { clipRank } from '@/types/trending'
import type { TrendingClip } from '@/types/trending'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/trending/utils'
import { PLATFORM_STYLES, NICHE_LABELS } from '@/lib/trending/constants'

interface TrendingDetailModalProps {
  clip: TrendingClip | null
  open: boolean
  onClose: () => void
  onRemix: (clip: TrendingClip) => void
  remixing: boolean
}

const GAME_COLORS: Record<string, string> = {
  irl: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
}

const FEED_LABELS: Record<string, { label: string; description: string; color: string }> = {
  hot_now: { label: 'Hot Now', description: 'Exploding right now — high velocity in the last 6h', color: 'text-orange-400 bg-orange-500/10 border-orange-500/30' },
  early_gem: { label: 'Early Gem', description: 'Fresh clip (<2h) with strong early signals — could go viral', color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30' },
  proven: { label: 'Proven Viral', description: 'Already validated by the algorithm — safe to repost', color: 'text-green-400 bg-green-500/10 border-green-500/30' },
  normal: { label: 'Normal', description: 'Standard clip, no special signals', color: 'text-muted-foreground bg-muted border-border' },
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--'
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function ScoreBar({ label, score, color }: { label: string; score: number | null; color: string }) {
  const value = score ?? 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, value)}%` }} />
      </div>
    </div>
  )
}

export function TrendingDetailModal({ clip, open, onClose, onRemix, remixing }: TrendingDetailModalProps) {
  const [copied, setCopied] = useState(false)

  if (!open || !clip) return null

  const ps = PLATFORM_STYLES[clip.platform.toLowerCase()]
  const platform = { label: ps?.label ?? clip.platform, colorClass: ps?.colorClass ?? 'text-muted-foreground' }
  const gameKey = clip.niche?.toLowerCase() ?? ''
  const gameColor = GAME_COLORS[gameKey] ?? 'text-muted-foreground bg-muted border-border'
  const gameLabel = NICHE_LABELS[gameKey] ?? clip.niche
  const feedInfo = FEED_LABELS[clip.feed_category ?? 'normal'] ?? FEED_LABELS.normal

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(clip.external_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* Clipboard API not available */ }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <Card className="relative z-10 w-full max-w-lg bg-card border-border shadow-2xl animate-in zoom-in-95 fade-in duration-200 max-h-[90vh] overflow-y-auto">
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-start justify-between p-5 pb-0">
            <div className="space-y-1 flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn('text-sm font-semibold', platform.colorClass)}>
                  {platform.label}
                </span>
                {clip.niche && (
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border', gameColor)}>
                    {gameLabel}
                  </span>
                )}
                <RankBadge rank={clipRank(clip)} score={clip.velocity_score} />
              </div>
              <h2 className="text-lg font-bold text-foreground leading-tight">
                {clip.title ?? 'Stream clip'}
              </h2>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Streamer + Duration */}
          <div className="px-5 mt-3 flex items-center justify-between">
            {clip.author_handle && (
              <p className="text-sm text-muted-foreground">
                @{clip.author_handle}
                {clip.author_name && clip.author_name !== clip.author_handle && (
                  <span className="ml-1.5 text-muted-foreground/60">({clip.author_name})</span>
                )}
              </p>
            )}
            {clip.duration_seconds && (
              <Badge variant="outline" className="text-xs gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(clip.duration_seconds)}
              </Badge>
            )}
          </div>

          {/* Feed category */}
          <div className="px-5 mt-3">
            <div className={cn('flex items-start gap-2 p-2.5 rounded-lg border', feedInfo.color)}>
              {clip.feed_category === 'early_gem' && <Diamond className="h-4 w-4 shrink-0 mt-0.5" />}
              {clip.feed_category === 'hot_now' && <Flame className="h-4 w-4 shrink-0 mt-0.5" />}
              {clip.feed_category === 'proven' && <Check className="h-4 w-4 shrink-0 mt-0.5" />}
              {clip.feed_category === 'normal' && <BarChart3 className="h-4 w-4 shrink-0 mt-0.5" />}
              <div>
                <p className="text-xs font-semibold">{feedInfo.label}</p>
                <p className="text-[10px] opacity-80">{feedInfo.description}</p>
              </div>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 px-5 mt-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Eye className="h-4 w-4 text-blue-400" />
              <div>
                <p className="text-xs text-muted-foreground">Views</p>
                <p className="text-sm font-bold">{formatCount(clip.view_count)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Heart className="h-4 w-4 text-red-400" />
              <div>
                <p className="text-xs text-muted-foreground">Likes</p>
                <p className="text-sm font-bold">{formatCount(clip.like_count)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Flame className="h-4 w-4 text-orange-400" />
              <div>
                <p className="text-xs text-muted-foreground">Final Score</p>
                <p className="text-sm font-bold">{clip.velocity_score?.toFixed(1) ?? '--'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Clock className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-bold">{formatDateTime(clip.clip_created_at)}</p>
              </div>
            </div>
          </div>

          {/* Detailed scores */}
          <div className="px-5 mt-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Score Breakdown</p>
            <ScoreBar label="Momentum (25%)" score={clip.viral_score} color="bg-orange-500" />
            <ScoreBar label="Authority (20%)" score={clip.anomaly_score} color="bg-purple-500" />
            <ScoreBar label="Engagement (15%)" score={clip.viral_ratio ? Math.min(100, clip.viral_ratio * 10000) : 0} color="bg-red-500" />
            <ScoreBar label="Early Signal (10%)" score={clip.early_signal_score} color="bg-cyan-500" />
          </div>

          {/* URL */}
          <div className="px-5 mt-4">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border">
              <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground truncate flex-1">{clip.external_url}</p>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={handleCopyUrl}>
                {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 p-5 mt-2">
            <a href={clip.external_url} target="_blank" rel="noopener noreferrer" className="flex-1">
              <Button variant="outline" className="w-full gap-2 h-10">
                <ExternalLink className="h-4 w-4" />
                View original
              </Button>
            </a>
            <Button
              className="flex-1 gap-2 h-10"
              onClick={() => onRemix(clip)}
              disabled={remixing || clip.id.startsWith('seed-')}
            >
              <Clapperboard className="h-4 w-4" />
              {remixing ? 'Creating...' : 'Make Viral'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
