"use client"

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { ExternalLink, Crown, Lock, Zap, TrendingUp, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VelocityBadge } from '@/components/trending/velocity-badge'
import { cn } from '@/lib/utils'
import type { TrendingClip } from '@/types/trending'

export type { TrendingClip }

interface TrendingCardProps {
  clip: TrendingClip
  onRemix?: (clip: TrendingClip) => void
  remixing?: boolean
  isPremiumUser?: boolean
}

const PREMIUM_THRESHOLD = 85

const PLATFORM_STYLES: Record<string, { label: string; colorClass: string }> = {
  twitch:         { label: 'Twitch',         colorClass: 'text-purple-400 bg-purple-500/15 border-purple-500/30' },
  youtube_gaming: { label: 'YouTube Gaming', colorClass: 'text-red-400 bg-red-500/15 border-red-500/30' },
}

const GAME_COLORS: Record<string, string> = {
  irl: 'text-blue-400 bg-blue-500/10',
}

const GAME_LABELS: Record<string, string> = {
  irl: 'IRL',
}

// Gradient colors per streamer for nicer placeholders
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

/**
 * Derive a direct MP4 video URL from a Twitch clip thumbnail URL.
 *
 * New CDN format (twitch-video-assets / VAP):
 *   Thumbnail: https://static-cdn.jtvnw.net/twitch-video-assets/.../UUID/landscape/thumb/thumb-000-480x272.jpg
 *   Video:     Replace "/thumb/thumb-...-480x272.jpg" with ".mp4" at the UUID level
 *
 * Old CDN format (clips-media-assets):
 *   Thumbnail: https://clips-media-assets2.twitch.tv/SLUG-preview-480x272.jpg
 *   Video:     https://clips-media-assets2.twitch.tv/SLUG.mp4
 */
function thumbnailToVideoUrl(thumbnailUrl: string | null): string | null {
  if (!thumbnailUrl) return null

  // New VAP format: ...twitch-video-assets/.../UUID/landscape/thumb/thumb-XXX-WxH.jpg
  // → ...twitch-video-assets/.../UUID/720.mp4
  const vapMatch = thumbnailUrl.match(
    /(https:\/\/static-cdn\.jtvnw\.net\/twitch-video-assets\/[^/]+\/[^/]+)\/landscape\/thumb\/.*$/
  )
  if (vapMatch) {
    return `${vapMatch[1]}/720.mp4`
  }

  // Old format: .../SLUG-preview-WxH.jpg → .../SLUG.mp4
  const oldMatch = thumbnailUrl.match(/^(https:\/\/clips-media-assets2\.twitch\.tv\/.+)-preview-\d+x\d+\.jpg$/)
  if (oldMatch) {
    return `${oldMatch[1]}.mp4`
  }

  return null
}

export function TrendingCard({ clip, onRemix, remixing = false, isPremiumUser = false }: TrendingCardProps) {
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fetchedRef = useRef(false)

  const isLocked = !isPremiumUser && (clip.velocity_score ?? 0) >= PREMIUM_THRESHOLD

  const platformStyle = PLATFORM_STYLES[clip.platform.toLowerCase()] ?? {
    label: clip.platform,
    colorClass: 'text-muted-foreground bg-muted border-border',
  }

  const gameKey = clip.niche?.toLowerCase() ?? ''
  const gameColor = GAME_COLORS[gameKey] ?? 'text-muted-foreground bg-muted'
  const gameLabel = GAME_LABELS[gameKey] ?? clip.niche
  const streamerGradient = STREAMER_GRADIENTS[clip.author_handle?.toLowerCase() ?? ''] ?? 'from-slate-700 via-slate-600 to-slate-500'

  // Fast-path: derive direct MP4 URL from thumbnail; fallback to GQL resolution via API
  const initialVideoUrl = clip.platform === 'twitch' ? thumbnailToVideoUrl(clip.thumbnail_url) : null
  const videoUrl = resolvedVideoUrl ?? initialVideoUrl

  // Resolve slug from external_url for GQL lookup fallback
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

  // Hover handlers — show video after 300ms hover
  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    if (isLocked) return

    // Lazy-fetch MP4 URL via GQL on first hover (only if we don't already have one)
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

    // Show video immediately if we already have a URL (fast path), otherwise wait briefly
    const delay = initialVideoUrl ? 100 : 250
    hoverTimerRef.current = setTimeout(() => {
      setShowVideo(true)
      setTimeout(() => {
        videoRef.current?.play().catch(() => {/* autoplay blocked, that's ok */})
      }, 30)
    }, delay)
  }, [isLocked, clip.platform, getClipSlug])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    setShowVideo(false)
    setVideoPlaying(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  return (
    <Card
      className={cn(
        'bg-card/60 border-border overflow-hidden group transition-all duration-300',
        isLocked
          ? 'hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5'
          : 'hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail / Video area */}
      <div className="aspect-[9/16] max-h-52 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">

        {/* Native video on hover (autoplay muted — works in all browsers) */}
        {showVideo && videoUrl && !isLocked && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover z-[5]"
            autoPlay
            muted
            playsInline
            loop
            onPlaying={() => setVideoPlaying(true)}
            onError={() => {
              // If the fast-path thumbnail→MP4 fails, retry with GQL-resolved URL
              if (resolvedVideoUrl && videoRef.current) {
                videoRef.current.load()
              }
            }}
          />
        )}

        {/* Static thumbnail or gradient placeholder */}
        {clip.thumbnail_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={clip.thumbnail_url}
            alt={clip.title ?? 'Clip de stream'}
            className={cn(
              'w-full h-full object-cover transition-all duration-500',
              isLocked ? 'blur-md scale-105' : hovered ? 'scale-110 brightness-75' : ''
            )}
            onError={() => setImgError(true)}
          />
        ) : (
          /* Colorful gradient placeholder with streamer initial */
          <div className={cn(
            'w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br transition-all duration-500',
            streamerGradient,
            hovered && !isLocked ? 'scale-110 brightness-75' : ''
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

        {/* Play button & "En lecture" indicator removed — clean autoplay on hover */}

        {/* Premium overlay */}
        {isLocked && (
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-10">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-500 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-2">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <span className="text-xs font-bold text-white">Premium requis</span>
          </div>
        )}

        {/* PRO badge for locked clips */}
        {isLocked && (
          <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg">
            <Crown className="h-2.5 w-2.5" />
            PRO
          </div>
        )}

        {/* Platform badge — only show if not locked */}
        {!isLocked && !videoPlaying && (
          <span className={cn(
            'absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm',
            platformStyle.colorClass
          )}>
            {platformStyle.label}
          </span>
        )}

        {/* Velocity badge — always visible, even on locked clips */}
        <div className="absolute top-2 right-2 z-20">
          <VelocityBadge score={clip.velocity_score} />
        </div>

        {/* Viral overlay badge on thumbnail */}
        {!isLocked && (clip.velocity_score ?? 0) >= 70 && !videoPlaying && (
          <div className="absolute bottom-2 left-2 z-[6] flex items-center gap-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-lg animate-in fade-in">
            <Flame className="h-2.5 w-2.5" />
            VIRAL
          </div>
        )}

        {/* External link */}
        {!isLocked && !videoPlaying && (
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
        )}

        {/* Scraped time */}
        {!isLocked && !videoPlaying && clip.scraped_at && (
          <span className="absolute bottom-2 left-2 text-[10px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            il y a {timeAgo(clip.scraped_at)}
          </span>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Title — hidden while hovering/playing video */}
        <p className={cn(
          'text-sm font-medium leading-tight line-clamp-2 transition-opacity duration-200',
          isLocked ? 'text-muted-foreground' : 'text-foreground',
          (hovered || showVideo || videoPlaying) && !isLocked ? 'opacity-0' : 'opacity-100'
        )}>
          {clip.title ?? clip.author_name ?? 'Clip de stream'}
        </p>

        {/* Streamer */}
        {clip.author_handle && (
          <p className="text-xs text-muted-foreground truncate">
            @{clip.author_handle}
            {clip.author_name && clip.author_name !== clip.author_handle && (
              <span className="ml-1 text-muted-foreground/60">&middot; {clip.author_name}</span>
            )}
          </p>
        )}

        {/* Viral badges + niche */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(clip.velocity_score ?? 0) >= 70 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-400 border border-orange-500/20">
              <Flame className="h-2.5 w-2.5" />
              Viral
            </span>
          )}
          {(clip.velocity_score ?? 0) >= 50 && (clip.velocity_score ?? 0) < 70 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-2.5 w-2.5" />
              High potential
            </span>
          )}
          {clip.niche && (
            <span className={cn('ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium', gameColor)}>
              {gameLabel}
            </span>
          )}
        </div>

        {/* Make Viral / Premium button */}
        {isLocked ? (
          <Link href="/settings" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs gap-1.5 mt-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              <Lock className="h-3 w-3" />
              Passe à Premium
            </Button>
          </Link>
        ) : (
          <Button
            size="sm"
            className="w-full h-9 text-xs gap-1.5 mt-1 bg-gradient-to-r from-primary to-indigo-500 hover:from-primary/90 hover:to-indigo-500/90 font-bold shadow-md shadow-primary/20"
            onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
            disabled={remixing}
          >
            <Zap className="h-3.5 w-3.5" />
            {remixing ? 'Création\u2026' : 'Make Viral'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
