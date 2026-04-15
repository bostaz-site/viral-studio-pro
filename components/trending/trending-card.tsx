"use client"

import { useState, useRef, useCallback, useEffect, memo } from 'react'
import Link from 'next/link'
import { ExternalLink, Crown, Lock, Zap, TrendingUp, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { VelocityBadge } from '@/components/trending/velocity-badge'
import { cn } from '@/lib/utils'
import { formatCount, timeAgo } from '@/lib/trending/utils'
import { PLATFORM_STYLES, NICHE_LABELS } from '@/lib/trending/constants'
import type { TrendingClip } from '@/types/trending'

export type { TrendingClip }

interface TrendingCardProps {
  clip: TrendingClip
  onRemix?: (clip: TrendingClip) => void
  remixing?: boolean
  isPremiumUser?: boolean
}

const PREMIUM_THRESHOLD = 85

const GAME_COLORS: Record<string, string> = {
  irl: 'text-blue-400 bg-blue-500/10',
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

export const TrendingCard = memo(function TrendingCard({ clip, onRemix, remixing = false, isPremiumUser = false }: TrendingCardProps) {
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fetchedRef = useRef(false)

  const isLocked = !isPremiumUser && (clip.velocity_score ?? 0) >= PREMIUM_THRESHOLD

  const ps = PLATFORM_STYLES[clip.platform.toLowerCase()]
  const platformStyle = {
    label: ps?.label ?? clip.platform,
    colorClass: ps?.badgeClass ?? 'text-muted-foreground bg-muted border-border',
  }

  const gameKey = clip.niche?.toLowerCase() ?? ''
  const gameColor = GAME_COLORS[gameKey] ?? 'text-muted-foreground bg-muted'
  const gameLabel = NICHE_LABELS[gameKey] ?? clip.niche
  const streamerGradient = STREAMER_GRADIENTS[clip.author_handle?.toLowerCase() ?? ''] ?? 'from-slate-700 via-slate-600 to-slate-500'

  // We always resolve the clip MP4 via the GQL-backed API.
  // Deriving URLs directly from the thumbnail path was unreliable: it could
  // silently return a URL pointing to the wrong clip (or the underlying VOD
  // segment), so users were seeing a "fuckall" clip on hover. The API route
  // caches resolutions for an hour, so re-hovers are instant.
  const videoUrl = resolvedVideoUrl

  // Reset resolved URL when the clip prop changes (avoids showing stale URL
  // from a recycled card instance in a virtualized list).
  useEffect(() => {
    setResolvedVideoUrl(null)
    fetchedRef.current = false
  }, [clip.id, clip.external_url])

  // Resolve slug from external_url for GQL lookup
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

  // Hover handlers — fetch the real MP4 URL on first hover, then play it.
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
  }, [isLocked, clip.platform, getClipSlug])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    setShowVideo(false)
    setVideoPlaying(false)
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [])

  // Show the video as soon as we're hovering AND the URL is resolved.
  // Splitting this from handleMouseEnter means: if the user keeps hovering
  // while the fetch is in flight, playback kicks in the moment we have
  // the correct URL (no arbitrary timers, no wrong clip flashing first).
  useEffect(() => {
    if (!hovered || isLocked || !videoUrl) return
    setShowVideo(true)
    // Give React a tick to mount the <video>, then play.
    const t = setTimeout(() => {
      videoRef.current?.play().catch(() => {/* autoplay blocked, that's ok */})
    }, 30)
    return () => clearTimeout(t)
  }, [hovered, isLocked, videoUrl])

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
            <span className="text-xs font-bold text-white">Premium required</span>
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
            TRENDING
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
            title="View original"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}

        {/* Scraped time */}
        {!isLocked && !videoPlaying && clip.scraped_at && (
          <span className="absolute bottom-2 left-2 text-[10px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            {timeAgo(clip.scraped_at)}
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
          {clip.title ?? clip.author_name ?? 'Stream clip'}
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
              Trending
            </span>
          )}
          {(clip.velocity_score ?? 0) >= 50 && (clip.velocity_score ?? 0) < 70 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-2.5 w-2.5" />
              Rising
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
              Upgrade to Pro
            </Button>
          </Link>
        ) : (
          <div className="space-y-1 mt-1">
            {(clip.velocity_score ?? 0) >= 80 && !remixing && (
              <p className="text-[10px] text-center text-orange-400/80 font-medium">
                🔥 Algo score {clip.velocity_score?.toFixed(0)} — ready to blow up
              </p>
            )}
            <Button
              size="sm"
              className="w-full h-9 text-xs gap-1.5 bg-gradient-to-r from-primary to-indigo-500 hover:from-primary/90 hover:to-indigo-500/90 font-bold shadow-md shadow-primary/20"
              onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
              disabled={remixing}
            >
              <Zap className="h-3.5 w-3.5" />
              {remixing ? 'Creating...' : '🚀 Make It Viral'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
})
