"use client"

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Eye, Heart, ExternalLink, Clapperboard, Play, Crown, Lock } from 'lucide-react'
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
 * Extract Twitch clip embed URL for hover-to-play.
 * Uses Twitch's own embed player which reliably supports autoplay when muted.
 */
function getClipEmbedUrl(externalUrl: string, parentDomain: string): string | null {
  try {
    const url = new URL(externalUrl)
    if (url.hostname === 'clips.twitch.tv') {
      const slug = url.pathname.replace('/', '')
      if (slug && !slug.includes('/')) {
        return `https://clips.twitch.tv/embed?clip=${slug}&parent=${parentDomain}&autoplay=true&muted=true`
      }
    }
    if (url.hostname === 'www.twitch.tv' || url.hostname === 'twitch.tv') {
      const match = url.pathname.match(/^\/[^/]+\/clip\/([^/]+)$/)
      if (match) {
        return `https://clips.twitch.tv/embed?clip=${match[1]}&parent=${parentDomain}&autoplay=true&muted=true`
      }
    }
  } catch { /* invalid URL */ }
  return null
}

export function TrendingCard({ clip, onRemix, remixing = false, isPremiumUser = false }: TrendingCardProps) {
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showEmbed, setShowEmbed] = useState(false)
  const [embedLoaded, setEmbedLoaded] = useState(false)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)

  const isLocked = !isPremiumUser && (clip.velocity_score ?? 0) >= PREMIUM_THRESHOLD

  const platformStyle = PLATFORM_STYLES[clip.platform.toLowerCase()] ?? {
    label: clip.platform,
    colorClass: 'text-muted-foreground bg-muted border-border',
  }

  const gameKey = clip.niche?.toLowerCase() ?? ''
  const gameColor = GAME_COLORS[gameKey] ?? 'text-muted-foreground bg-muted'
  const gameLabel = GAME_LABELS[gameKey] ?? clip.niche
  const streamerGradient = STREAMER_GRADIENTS[clip.author_handle?.toLowerCase() ?? ''] ?? 'from-slate-700 via-slate-600 to-slate-500'

  // Build Twitch embed URL (autoplay + muted works reliably with Twitch's player)
  const parentDomain = typeof window !== 'undefined' ? window.location.hostname : 'viral-studio-pro.netlify.app'
  const embedUrl = clip.platform === 'twitch'
    ? getClipEmbedUrl(clip.external_url, parentDomain)
    : null

  // Hover handlers — show embed after 400ms hover
  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    if (!isLocked && embedUrl) {
      hoverTimerRef.current = setTimeout(() => {
        setShowEmbed(true)
      }, 400)
    }
  }, [isLocked, embedUrl])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    setShowEmbed(false)
    setEmbedLoaded(false)
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [])

  return (
    <Card
      className={cn(
        'bg-card/60 border-border overflow-hidden group transition-all duration-200',
        isLocked
          ? 'hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5'
          : 'hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail / Video area */}
      <div className="aspect-[9/16] max-h-52 relative overflow-hidden bg-gradient-to-br from-slate-900 to-slate-800">

        {/* Twitch clip embed on hover — autoplay + muted works with Twitch's player */}
        {showEmbed && embedUrl && !isLocked && (
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className={cn(
              'absolute inset-0 w-full h-full z-[5] transition-opacity duration-300',
              embedLoaded ? 'opacity-100' : 'opacity-0'
            )}
            allowFullScreen
            allow="autoplay; encrypted-media"
            style={{ border: 'none' }}
            onLoad={() => setEmbedLoaded(true)}
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

        {/* Hover play indicator (before embed loads) */}
        {hovered && !isLocked && !embedLoaded && (
          <div className="absolute inset-0 flex items-center justify-center z-[4] pointer-events-none">
            <div className="w-12 h-12 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20 animate-in zoom-in-50 duration-200">
              {showEmbed ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
              )}
            </div>
          </div>
        )}

        {/* Playing indicator */}
        {embedLoaded && !isLocked && (
          <div className="absolute bottom-2 left-2 z-[6] flex items-center gap-1.5 bg-black/60 backdrop-blur-sm rounded-full px-2 py-1">
            <div className="flex items-center gap-0.5">
              <div className="w-0.5 h-3 bg-green-400 rounded-full animate-pulse" />
              <div className="w-0.5 h-2 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-0.5 h-3.5 bg-green-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-[10px] text-white/70 font-medium">En lecture</span>
          </div>
        )}

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

        {/* Platform badge — only show if not locked and not playing */}
        {!isLocked && !embedLoaded && (
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

        {/* External link */}
        {!isLocked && !embedLoaded && (
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
        {!isLocked && !embedLoaded && clip.scraped_at && (
          <span className="absolute bottom-2 left-2 text-[10px] text-white/50 bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
            il y a {timeAgo(clip.scraped_at)}
          </span>
        )}
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Title */}
        <p className={cn(
          'text-sm font-medium leading-tight line-clamp-2',
          isLocked ? 'text-muted-foreground' : 'text-foreground'
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
          {clip.niche && (
            <span className={cn('ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium', gameColor)}>
              {gameLabel}
            </span>
          )}
        </div>

        {/* Clip / Enhance button */}
        {isLocked ? (
          <Link href="/settings" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs gap-1.5 mt-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              <Lock className="h-3 w-3" />
              Passe &agrave; Premium
            </Button>
          </Link>
        ) : (
          <Button
            size="sm"
            className="w-full h-8 text-xs gap-1.5 mt-1"
            onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
            disabled={remixing}
          >
            <Clapperboard className="h-3.5 w-3.5" />
            {remixing ? 'Cr\u00e9ation\u2026' : 'Enhance'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
