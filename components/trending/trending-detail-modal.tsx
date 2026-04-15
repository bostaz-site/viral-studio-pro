"use client"

import { useState } from 'react'
import { X, ExternalLink, Eye, Heart, Clapperboard, Clock, Globe, Flame, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VelocityBadge } from '@/components/trending/velocity-badge'
import type { TrendingClip } from '@/stores/trending-store'
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

export function TrendingDetailModal({ clip, open, onClose, onRemix, remixing }: TrendingDetailModalProps) {
  const [copied, setCopied] = useState(false)

  if (!open || !clip) return null

  const ps = PLATFORM_STYLES[clip.platform.toLowerCase()]
  const platform = { label: ps?.label ?? clip.platform, colorClass: ps?.colorClass ?? 'text-muted-foreground' }
  const gameKey = clip.niche?.toLowerCase() ?? ''
  const gameColor = GAME_COLORS[gameKey] ?? 'text-muted-foreground bg-muted border-border'
  const gameLabel = NICHE_LABELS[gameKey] ?? clip.niche

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(clip.external_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <Card className="relative z-10 w-full max-w-lg bg-card border-border shadow-2xl animate-in zoom-in-95 fade-in duration-200">
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
                <VelocityBadge score={clip.velocity_score} showLabel />
              </div>
              <h2 className="text-lg font-bold text-foreground leading-tight">
                {clip.title ?? 'Stream clip'}
              </h2>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Streamer */}
          <div className="px-5 mt-3">
            {clip.author_handle && (
              <p className="text-sm text-muted-foreground">
                @{clip.author_handle}
                {clip.author_name && clip.author_name !== clip.author_handle && (
                  <span className="ml-1.5 text-muted-foreground/60">({clip.author_name})</span>
                )}
              </p>
            )}
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
                <p className="text-xs text-muted-foreground">Velocity</p>
                <p className="text-sm font-bold">{clip.velocity_score?.toFixed(1) ?? '--'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
              <Clock className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-muted-foreground">Scraped</p>
                <p className="text-sm font-bold">{formatDateTime(clip.scraped_at)}</p>
              </div>
            </div>
          </div>

          {/* Description */}
          {clip.description && (
            <div className="px-5 mt-4">
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-4">
                {clip.description}
              </p>
            </div>
          )}

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
            <a
              href={clip.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1"
            >
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
