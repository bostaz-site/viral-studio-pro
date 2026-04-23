"use client"

import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { ExternalLink, Zap, Flame, Bookmark, Diamond } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RankBadge, getRankCardClass } from '@/components/trending/rank-badge'
import { cn } from '@/lib/utils'
import { timeAgo } from '@/lib/trending/utils'
import { PLATFORM_STYLES, NICHE_LABELS } from '@/lib/trending/constants'
import { clipRank, getClipInsight } from '@/types/trending'
import type { TrendingClip } from '@/types/trending'

export type { TrendingClip }

interface TrendingCardProps {
  clip: TrendingClip
  onRemix?: (clip: TrendingClip) => void
  remixing?: boolean
  isSaved?: boolean
  onToggleSave?: (clipId: string) => void
}

const GAME_COLORS: Record<string, string> = {
  irl: 'text-blue-400 bg-blue-500/10',
}

const STREAMER_GRADIENTS: Record<string, string> = {
  kaicenat: 'from-purple-600 via-pink-500 to-red-500',
  ishowspeed: 'from-red-600 via-orange-500 to-yellow-500',
  xqc: 'from-blue-600 via-indigo-500 to-purple-500',
  hasanabi: 'from-red-700 via-red-500 to-orange-500',
  jynxzi: 'from-emerald-600 via-teal-500 to-cyan-500',
  adinross: 'from-violet-600 via-purple-500 to-fuchsia-500',
  sketch: 'from-sky-600 via-blue-500 to-indigo-500',
  amouranth: 'from-pink-600 via-rose-500 to-red-500',
  marlon: 'from-amber-600 via-orange-500 to-red-500',
  neon: 'from-lime-600 via-green-500 to-emerald-500',
  stabletronaldo: 'from-yellow-600 via-amber-500 to-orange-500',
  caseoh_: 'from-orange-600 via-red-500 to-pink-500',
}

// Rank-based badges are now in rank-badge.tsx

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export const TrendingCard = memo(function TrendingCard({ clip, onRemix, remixing = false, isSaved = false, onToggleSave }: TrendingCardProps) {
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fetchedRef = useRef(false)

  const ps = PLATFORM_STYLES[clip.platform.toLowerCase()]
  const platformStyle = {
    label: ps?.label ?? clip.platform,
    colorClass: ps?.badgeClass ?? 'text-muted-foreground bg-muted border-border',
  }

  const gameKey = clip.niche?.toLowerCase() ?? ''
  const gameColor = GAME_COLORS[gameKey] ?? 'text-muted-foreground bg-muted'
  const gameLabel = NICHE_LABELS[gameKey] ?? clip.niche
  const streamerGradient = STREAMER_GRADIENTS[clip.author_handle?.toLowerCase() ?? ''] ?? 'from-slate-700 via-slate-600 to-slate-500'

  const videoUrl = resolvedVideoUrl

  useEffect(() => {
    setResolvedVideoUrl(null)
    fetchedRef.current = false
  }, [clip.id, clip.external_url])

  const getClipSlug = useCallback((): string | null => {
    try {
      const u = new URL(clip.external_url)
      if (u.hostname === 'clips.twitch.tv') {
        const slug = u.pathname.replace('/', '')
        return slug && !slug.includes('/') ? slug : null
      }
      if (u.hostname === 'www.twitch.tv' || u.hostname === 'twitch.tv') {
        const m = u.pathname.match(/^\/[^/]+\/clip\/([^/]+)$/)
        return m ? m[1] : null
      }
    } catch { /* invalid URL */ }
    return null
  }, [clip.external_url])

  const handleMouseEnter = useCallback(() => {
    setHovered(true)

    if (!fetchedRef.current && clip.platform === 'twitch') {
      fetchedRef.current = true
      const slug = getClipSlug()
      if (slug) {
        fetch(`/api/clips/video-url?slug=${encodeURIComponent(slug)}`)
          .then((r) => r.ok ? r.json() : null)
          .then((data) => { if (data?.video_url) setResolvedVideoUrl(data.video_url) })
          .catch(() => {/* ignore */})
      }
    }
  }, [clip.platform, getClipSlug])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    setShowVideo(false)
    setVideoPlaying(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [])

  useEffect(() => {
    if (!hovered || !videoUrl) return
    setShowVideo(true)
    const t = setTimeout(() => {
      videoRef.current?.play().catch(() => {})
    }, 30)
    return () => clearTimeout(t)
  }, [hovered, videoUrl])

  const rank = clipRank(clip)
  const insight = getClipInsight(clip)
  const rankCardClass = getRankCardClass(rank)

  return (
    <Card
      className={cn(
        'bg-card/60 border-border overflow-hidden group transition-all duration-300',
        rankCardClass,
        'hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="aspect-[9/16] max-h-52 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">

        {showVideo && videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover z-[5]"
            autoPlay
            muted
            playsInline
            loop
            onPlaying={() => setVideoPlaying(true)}
          />
        )}

        {clip.thumbnail_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail_url}
            alt={clip.title ?? 'Clip de stream'}
            className={cn(
              'w-full h-full object-cover transition-all duration-500',
              hovered ? 'scale-110 brightness-75' : ''
            )}
            onError={() => setImgError(true)}
          />
        ) : (
          <div className={cn(
            'w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br transition-all duration-500',
            streamerGradient,
            hovered ? 'scale-110 brightness-75' : ''
          )}>
            <div className="w-14 h-14 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/10">
              <span className="text-2xl font-black text-white/90">
                {(clip.author_name ?? clip.title ?? 'C')[0].toUpperCase()}
              </span>
            </div>
            {clip.author_handle && (
              <span className="text-xs font-bold text-white/60">@{clip.author_handle}</span>
            )}
          </div>
        )}

        {/* Platform badge */}
        {!videoPlaying && (
          <span className={cn(
            'absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm',
            platformStyle.colorClass
          )}>
            {platformStyle.label}
          </span>
        )}

        {/* Rank badge */}
        <div className="absolute top-2 right-2 z-20">
          <RankBadge rank={rank} score={clip.velocity_score} />
        </div>

        {/* Feed category badges */}
        {!videoPlaying && clip.feed_category === 'early_gem' && (
          <div className="absolute bottom-8 left-2 z-[6] flex items-center gap-1 bg-cyan-500/90 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
            <Diamond className="h-2.5 w-2.5" />
            EARLY GEM
          </div>
        )}
        {!videoPlaying && clip.feed_category === 'hot_now' && (
          <div className="absolute bottom-8 left-2 z-[6] flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg animate-pulse">
            <Flame className="h-2.5 w-2.5" />
            HOT NOW
          </div>
        )}

        {/* Duration + time */}
        {!videoPlaying && (
          <div className="absolute bottom-2 left-2 z-[6] flex items-center gap-1.5">
            {clip.duration_seconds && (
              <span className="text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded-md backdrop-blur-sm font-medium">
                {formatDuration(clip.duration_seconds)}
              </span>
            )}
            {clip.clip_created_at && (
              <span className="text-[10px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                {timeAgo(clip.clip_created_at)}
              </span>
            )}
          </div>
        )}

        {/* Bookmark + External link */}
        {!videoPlaying && (
          <div className="absolute bottom-2 right-2 z-[6] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onToggleSave && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSave(clip.id) }}
                className={cn(
                  'p-1.5 rounded-lg backdrop-blur-sm transition-colors',
                  isSaved ? 'bg-primary/80 text-white' : 'bg-black/60 text-white/70 hover:text-white'
                )}
                title={isSaved ? 'Unsave' : 'Save'}
              >
                <Bookmark className={cn('h-3.5 w-3.5', isSaved && 'fill-current')} />
              </button>
            )}
            <a
              href={clip.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
              onClick={(e) => e.stopPropagation()}
              title="View original"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        <p className={cn(
          'text-sm font-medium leading-tight line-clamp-2 transition-opacity duration-200 text-foreground',
          (hovered || showVideo || videoPlaying) ? 'opacity-0' : 'opacity-100'
        )}>
          {clip.title ?? clip.author_name ?? 'Stream clip'}
        </p>

        {clip.author_handle && (
          <p className="text-xs text-muted-foreground truncate">
            @{clip.author_handle}
            {clip.author_name && clip.author_name !== clip.author_handle && (
              <span className="ml-1 text-muted-foreground/60">&middot; {clip.author_name}</span>
            )}
          </p>
        )}

        {/* Insight tag + niche */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {insight && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-muted-foreground/80 bg-muted/40">
              <span>{insight.icon}</span>
              {insight.text}
            </span>
          )}
          {clip.niche && (
            <span className={cn('ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium', gameColor)}>
              {gameLabel}
            </span>
          )}
        </div>

        <div className="space-y-1 mt-1">
          {(rank === 'epic' || rank === 'legendary' || rank === 'master') && !remixing && (
            <p className="text-[10px] text-center text-orange-400/80 font-medium">
              {rank === 'master' ? '🔥' : rank === 'legendary' ? '⚡' : '🎯'} {rank.charAt(0).toUpperCase() + rank.slice(1)} — ready to blow up
            </p>
          )}
          <Button
            size="sm"
            className="w-full h-9 text-xs gap-1.5 bg-gradient-to-r from-primary to-indigo-500 hover:from-primary/90 hover:to-indigo-500/90 font-bold shadow-md shadow-primary/20"
            onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
            disabled={remixing}
          >
            <Zap className="h-3.5 w-3.5" />
            {remixing ? 'Creating...' : 'Make It Viral'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
})
