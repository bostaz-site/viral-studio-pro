"use client"

import { useState } from 'react'
import { Eye, Heart, ExternalLink, Shuffle, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VelocityBadge } from '@/components/trending/velocity-badge'
import { cn } from '@/lib/utils'

export interface TrendingClip {
  id: string
  external_url: string
  platform: string
  author_name: string | null
  author_handle: string | null
  title: string | null
  description: string | null
  niche: string | null
  view_count: number | null
  like_count: number | null
  velocity_score: number | null
  thumbnail_url: string | null
  scraped_at: string | null
  created_at: string | null
}

interface TrendingCardProps {
  clip: TrendingClip
  onRemix?: (clip: TrendingClip) => void
  remixing?: boolean
}

const PLATFORM_STYLES: Record<string, { label: string; colorClass: string }> = {
  tiktok:    { label: 'TikTok',           colorClass: 'text-pink-400 bg-pink-500/15 border-pink-500/30' },
  instagram: { label: 'Instagram Reels',  colorClass: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
  youtube:   { label: 'YouTube Shorts',   colorClass: 'text-red-400 bg-red-500/15 border-red-500/30' },
}

const NICHE_COLORS: Record<string, string> = {
  science:   'text-cyan-400 bg-cyan-500/10',
  business:  'text-green-400 bg-green-500/10',
  fitness:   'text-orange-400 bg-orange-500/10',
  comedy:    'text-yellow-400 bg-yellow-500/10',
  tech:      'text-blue-400 bg-blue-500/10',
  lifestyle: 'text-pink-400 bg-pink-500/10',
  gaming:    'text-violet-400 bg-violet-500/10',
  education: 'text-teal-400 bg-teal-500/10',
}

function formatCount(n: number | null): string {
  if (n === null) return '--'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 3600)  return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}j`
}

export function TrendingCard({ clip, onRemix, remixing = false }: TrendingCardProps) {
  const [imgError, setImgError] = useState(false)

  const platformStyle = PLATFORM_STYLES[clip.platform.toLowerCase()] ?? {
    label: clip.platform,
    colorClass: 'text-muted-foreground bg-muted border-border',
  }

  const nicheColor = clip.niche
    ? (NICHE_COLORS[clip.niche.toLowerCase()] ?? 'text-muted-foreground bg-muted')
    : null

  return (
    <Card className="bg-card/60 border-border overflow-hidden group hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5">
      {/* Thumbnail */}
      <div className="aspect-[9/16] max-h-52 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">
        {clip.thumbnail_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail_url}
            alt={clip.title ?? 'Trending clip'}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        {/* Platform badge */}
        <span className={cn(
          'absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm',
          platformStyle.colorClass
        )}>
          {platformStyle.label}
        </span>

        {/* Velocity badge */}
        <div className="absolute top-2 right-2">
          <VelocityBadge score={clip.velocity_score} />
        </div>

        {/* External link */}
        <a
          href={clip.external_url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          onClick={(e) => e.stopPropagation()}
          title="Voir l'original"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>

        {/* Scraped time */}
        {clip.scraped_at && (
          <span className="absolute bottom-2 left-2 text-[10px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            il y a {timeAgo(clip.scraped_at)}
          </span>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Title */}
        <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
          {clip.title ?? clip.author_name ?? 'Clip tendance'}
        </p>

        {/* Author */}
        {clip.author_handle && (
          <p className="text-xs text-muted-foreground truncate">
            @{clip.author_handle}
            {clip.author_name && clip.author_name !== clip.author_handle && (
              <span className="ml-1 text-muted-foreground/60">· {clip.author_name}</span>
            )}
          </p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {formatCount(clip.view_count)}
          </span>
          {clip.like_count !== null && (
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3" />
              {formatCount(clip.like_count)}
            </span>
          )}
          {clip.niche && nicheColor && (
            <span className={cn('ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium capitalize', nicheColor)}>
              {clip.niche}
            </span>
          )}
        </div>

        {/* Remix button */}
        <Button
          size="sm"
          className="w-full h-8 text-xs gap-1.5 mt-1"
          onClick={() => onRemix?.(clip)}
          disabled={remixing}
        >
          <Shuffle className="h-3.5 w-3.5" />
          {remixing ? 'Remontage…' : 'Remixer ce clip'}
        </Button>
      </CardContent>
    </Card>
  )
}
