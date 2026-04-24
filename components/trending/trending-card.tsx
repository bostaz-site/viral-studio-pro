"use client"

import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { ExternalLink, Sparkles, Flame, Bookmark, Play } from 'lucide-react'
import { getRankTierClass, DiamondCorner, MasterCorner, MasterCrown, SkullIcon } from '@/components/trending/rank-badge'
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

function formatDuration(seconds: number | null): string {
  if (!seconds) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Decorative frame overlays ──

function EpicFrame() {
  return (
    <div className="rank-frame">
      <div className="corner tl" />
      <div className="corner tr" />
      <div className="corner bl" />
      <div className="corner br" />
    </div>
  )
}

function LegendaryFrame() {
  return (
    <div className="rank-frame">
      <div className="edge top" />
      <div className="edge bottom" />
      <div className="edge left" />
      <div className="edge right" />
      <div className="corner tl"><DiamondCorner /></div>
      <div className="corner tr"><DiamondCorner /></div>
      <div className="corner bl"><DiamondCorner /></div>
      <div className="corner br"><DiamondCorner /></div>
    </div>
  )
}

function MasterFrame() {
  return (
    <div className="rank-frame">
      <div className="edge top" />
      <div className="edge bottom" />
      <div className="edge left" />
      <div className="edge right" />
      <div className="corner tl"><MasterCorner /></div>
      <div className="corner tr"><MasterCorner /></div>
      <div className="corner bl"><MasterCorner /></div>
      <div className="corner br"><MasterCorner /></div>
    </div>
  )
}

function MasterSparks() {
  return (
    <div className="master-sparks">
      <span /><span /><span /><span /><span />
    </div>
  )
}

// ── Main Card ──

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

  const gameLabel = NICHE_LABELS[clip.niche?.toLowerCase() ?? ''] ?? clip.niche
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
  const tierClass = getRankTierClass(rank)
  const score = clip.velocity_score !== null ? Math.round(clip.velocity_score) : null
  const isMaster = rank === 'master'
  const isLegendary = rank === 'legendary'
  const isEpic = rank === 'epic'
  const hasFrame = isMaster || isLegendary || isEpic

  return (
    <article
      className={cn('clip rounded-xl overflow-visible group cursor-pointer transition-all duration-300', tierClass)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Thumbnail */}
      <div className="thumb aspect-video relative overflow-hidden rounded-t-xl bg-gradient-to-br from-slate-900 to-slate-800">

        {/* Video preview on hover */}
        {showVideo && videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover z-[5]"
            autoPlay muted playsInline loop
            onPlaying={() => setVideoPlaying(true)}
          />
        )}

        {/* Thumbnail image or avatar fallback */}
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
            'absolute top-2 left-2 z-[6] text-xs font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm',
            platformStyle.colorClass
          )}>
            {platformStyle.label}
          </span>
        )}

        {/* Master skull badge */}
        {isMaster && (
          <div className="master-skull">
            <SkullIcon className="w-4 h-4 text-[#3A2808]" />
          </div>
        )}

        {/* Decorative frame overlay */}
        {isEpic && <EpicFrame />}
        {isLegendary && <LegendaryFrame />}
        {isMaster && <MasterFrame />}

        {/* Master crown pediment */}
        {isMaster && <MasterCrown className="master-crown" />}

        {/* Score — big Archivo Black number */}
        {score !== null && (
          <span className="rank-score">{score}</span>
        )}

        {/* Master sparks */}
        {isMaster && <MasterSparks />}

        {/* Duration pill */}
        {!videoPlaying && clip.duration_seconds && (
          <span className="absolute bottom-2 left-2 z-[6] text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded-md backdrop-blur-sm font-medium">
            {formatDuration(clip.duration_seconds)}
          </span>
        )}

        {/* Play button */}
        <div className="play-btn">
          <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
        </div>

        {/* Bookmark + External link (hover only) */}
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

      {/* Meta section */}
      <div className={cn('meta-section p-3 space-y-2 rounded-b-xl', isMaster ? '' : 'bg-card/60')}>
        <p className={cn(
          'text-sm font-medium leading-tight line-clamp-2 text-foreground'
        )}>
          {clip.title ?? clip.author_name ?? 'Stream clip'}
        </p>

        {clip.author_handle && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
            <span className="w-4 h-4 rounded-full bg-muted/60 shrink-0 flex items-center justify-center text-[8px] font-bold text-muted-foreground">
              {(clip.author_handle ?? 'U')[0].toUpperCase()}
            </span>
            <b>@{clip.author_handle}</b>
            {gameLabel && (
              <span className="text-muted-foreground/60">&middot; {gameLabel}</span>
            )}
          </div>
        )}

        {/* Signal tags (hover reveal) */}
        {insight && (clip.feed_category === 'hot_now' || clip.feed_category === 'early_gem') && (
          <div className="signal-tag">
            {clip.feed_category === 'hot_now' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ color: '#FDA4AF', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.22)' }}>
                <Flame className="h-2.5 w-2.5" /> Hot
              </span>
            )}
            {clip.feed_category === 'early_gem' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{ color: '#86EFAC', background: 'rgba(34,197,94,.1)', border: '1px solid rgba(34,197,94,.22)' }}>
                <Sparkles className="h-2.5 w-2.5" /> Gem
              </span>
            )}
          </div>
        )}

        {/* CTA button */}
        <button
          className="cta-viral w-full h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative z-10"
          onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
          disabled={remixing}
        >
          {isMaster ? <SkullIcon className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          <span className="relative z-10">{remixing ? 'Creating...' : 'Make It Viral'}</span>
        </button>
      </div>
    </article>
  )
})
