/* eslint-disable @next/next/no-img-element */
"use client"

import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, Sparkles, Flame, Bookmark, Play, SlidersHorizontal, Loader2 } from 'lucide-react'
import { getRankTierClass, MasterCorner, MasterCrown, SkullIcon } from '@/components/trending/rank-badge'
import { useTilt } from '@/lib/hooks/use-tilt'
import { cn } from '@/lib/utils'
import { timeAgo, formatCount } from '@/lib/trending/utils'
import { PLATFORM_STYLES, NICHE_LABELS } from '@/lib/trending/constants'
import { clipRank, getClipInsight } from '@/types/trending'
import type { TrendingClip } from '@/types/trending'

export type { TrendingClip }

export interface QuickExportState {
  clipId: string
  jobId: string
  status: 'rendering' | 'done' | 'error'
  downloadUrl?: string | null
  errorMessage?: string | null
}

interface TrendingCardProps {
  clip: TrendingClip
  onRemix?: (clip: TrendingClip) => void
  onQuickExport?: (clip: TrendingClip) => void
  quickExportState?: QuickExportState | null
  remixing?: boolean
  isSaved?: boolean
  onToggleSave?: (clipId: string) => void
  onToggleGroup?: (groupId: string) => void
  isGroupExpanded?: boolean
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

// ── Legendary SVG components ──

const LegGoldGem = ({ w = 28, h = 32 }: { w?: number; h?: number }) => (
  <svg width={w} height={h} viewBox="0 0 110 140" fill="none">
    <g>
      <path d="M10 42 L35 42 L55 10Z" fill="url(#gc1)"/><path d="M35 42 L55 10 L75 42Z" fill="url(#gc2)"/><path d="M75 42 L55 10 L100 42Z" fill="url(#gc3)"/>
      <path d="M30 42 L40 32 L70 32 L80 42Z" fill="url(#gt)" opacity=".6"/>
      <path d="M10 42 L35 42 L55 120Z" fill="url(#gpl)"/><path d="M35 42 L55 42 L55 120Z" fill="url(#gpml)"/>
      <path d="M55 42 L75 42 L55 120Z" fill="url(#gpmr)"/><path d="M75 42 L100 42 L55 120Z" fill="url(#gpr)"/>
      <path d="M32 42 L38 42 L55 80Z" fill="#FFFDE8" opacity=".35"/>
      <circle cx="42" cy="36" r="2" fill="#FFF" opacity=".8"/>
    </g>
  </svg>
)

const LegSparkle4 = () => (
  <svg viewBox="0 0 24 24" fill="none"><path d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5Z" fill="#FFF8E1"/></svg>
)

const LegGemDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    <defs>
      <linearGradient id="gc1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFE9A8"/><stop offset="100%" stopColor="#DAA520"/></linearGradient>
      <linearGradient id="gc2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="30%" stopColor="#FFFDE8"/><stop offset="100%" stopColor="#F5D478"/></linearGradient>
      <linearGradient id="gc3" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="25%" stopColor="#FFF8E1"/><stop offset="100%" stopColor="#E8B850"/></linearGradient>
      <linearGradient id="gt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFF8E1"/><stop offset="40%" stopColor="#FFE9A8"/><stop offset="100%" stopColor="#FFD700"/></linearGradient>
      <linearGradient id="gpl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8B6914"/><stop offset="50%" stopColor="#B8860B"/><stop offset="100%" stopColor="#996515"/></linearGradient>
      <linearGradient id="gpml" x1=".3" y1="0" x2=".7" y2="1"><stop offset="0%" stopColor="#DAA520"/><stop offset="50%" stopColor="#C9962E"/><stop offset="100%" stopColor="#A07818"/></linearGradient>
      <linearGradient id="gpmr" x1=".7" y1="0" x2=".3" y2="1"><stop offset="0%" stopColor="#FFD700"/><stop offset="50%" stopColor="#E8B850"/><stop offset="100%" stopColor="#C9962E"/></linearGradient>
      <linearGradient id="gpr" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFF0C0"/><stop offset="50%" stopColor="#F5D478"/><stop offset="100%" stopColor="#DAA520"/></linearGradient>
      <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F5A623"/><stop offset="100%" stopColor="transparent"/></linearGradient>
    </defs>
  </svg>
)

// ── Main Card ──

export const TrendingCard = memo(function TrendingCard({ clip, onRemix, onQuickExport, quickExportState, remixing = false, isSaved = false, onToggleSave }: TrendingCardProps) {
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

  const tiltAmplitude = isMaster ? 12 : isLegendary ? 10 : isEpic ? 8 : 5
  const tilt = useTilt({ rotateAmplitude: tiltAmplitude, scaleOnHover: 1.0 })

  const isExporting = quickExportState?.clipId === clip.id && quickExportState.status === 'rendering'

  // ── Legendary rendering path — ornate gold frame design ──
  if (isLegendary) {
    const legendaryHook = '🔥 Peak viral potential'

    return (
      <motion.article
        ref={tilt.ref as React.RefObject<HTMLElement>}
        className="r-legendary group cursor-pointer overflow-visible"
        style={{
          rotateX: tilt.style.rotateX,
          rotateY: tilt.style.rotateY,
          scale: tilt.style.scale,
          transformPerspective: 800,
        }}
        onMouseMove={tilt.handlers.onMouseMove}
        onMouseEnter={() => { tilt.handlers.onMouseEnter(); handleMouseEnter() }}
        onMouseLeave={() => { tilt.handlers.onMouseLeave(); handleMouseLeave() }}
      >
        {/* Shared SVG gradient defs */}
        <LegGemDefs />

        {/* Glow */}
        <div className="leg-glow" />

        {/* Sparkles (4, subtle) */}
        <div style={{ position: 'absolute', inset: '-20px', overflow: 'visible', pointerEvents: 'none' }}>
          <div className="leg-sparkle" style={{ top: '5%', left: '10%', width: 12, height: 12, '--dx': '-14px', '--dy': '-12px', animationDelay: '0s', opacity: .7 } as React.CSSProperties}><LegSparkle4 /></div>
          <div className="leg-sparkle" style={{ top: '8%', left: '90%', width: 11, height: 11, '--dx': '12px', '--dy': '-10px', animationDelay: '.5s', opacity: .6 } as React.CSSProperties}><LegSparkle4 /></div>
          <div className="leg-sparkle" style={{ top: '55%', left: '-1%', width: 12, height: 12, '--dx': '-16px', '--dy': '8px', animationDelay: '1s', opacity: .65 } as React.CSSProperties}><LegSparkle4 /></div>
          <div className="leg-sparkle" style={{ top: '85%', left: '75%', width: 11, height: 11, '--dx': '10px', '--dy': '14px', animationDelay: '1.5s', opacity: .6 } as React.CSSProperties}><LegSparkle4 /></div>
        </div>

        {/* ═══ ORNATE GOLD FRAME ═══ */}
        <div className="leg-frame">
          {/* Corner gems */}
          <div className="leg-gem tl"><LegGoldGem /></div>
          <div className="leg-gem tr"><LegGoldGem /></div>
          <div className="leg-gem bl"><LegGoldGem /></div>
          <div className="leg-gem br"><LegGoldGem /></div>

          {/* Side gems */}
          <div className="leg-gem" style={{ top: -8, left: '50%', transform: 'translateX(-50%)', animationDelay: '.2s' }}><LegGoldGem w={20} h={24} /></div>
          <div className="leg-gem" style={{ bottom: -8, left: '50%', transform: 'translateX(-50%) rotate(180deg)', animationDelay: '.5s' }}><LegGoldGem w={20} h={24} /></div>
          <div className="leg-gem" style={{ left: -8, top: '50%', transform: 'translateY(-50%) rotate(90deg)', animationDelay: '.3s' }}><LegGoldGem w={18} h={22} /></div>
          <div className="leg-gem" style={{ right: -8, top: '50%', transform: 'translateY(-50%) rotate(-90deg)', animationDelay: '.7s' }}><LegGoldGem w={18} h={22} /></div>

          {/* Dark gap → inner gold → thumbnail */}
          <div className="leg-frame-inner-border">
            <div className="leg-frame-inner-gold">
              <div className="leg-thumb">
                {/* Video preview */}
                {showVideo && videoUrl && (
                  <video ref={videoRef} src={videoUrl}
                    className="absolute inset-0 w-full h-full object-cover z-[5]"
                    autoPlay muted playsInline loop disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback" onPlaying={() => setVideoPlaying(true)} />
                )}

                {/* Thumbnail image */}
                {clip.thumbnail_url && !imgError && (
                  <img src={clip.thumbnail_url} alt={clip.title ?? 'Clip'}
                    className={cn('w-full h-full object-cover transition-all duration-500', hovered && 'scale-105 brightness-75')}
                    onError={() => setImgError(true)} />
                )}
                {(!clip.thumbnail_url || imgError) && (
                  <div className={cn('w-full h-full flex items-center justify-center bg-gradient-to-br', streamerGradient)}>
                    <span className="text-2xl font-black text-white/90">{(clip.author_name ?? 'C')[0].toUpperCase()}</span>
                  </div>
                )}

                {/* Overlay */}
                <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,.65), transparent 40%, rgba(0,0,0,.25))' }} />

                {/* Godray */}
                <div className="leg-godray" />

                {/* Hover shimmer */}
                <div className="leg-shimmer"><div className="leg-shimmer-bar" /></div>

                {/* Platform badge — hidden when video starts loading */}
                {!showVideo && (
                  <span className={cn('absolute top-2 left-2 z-[6] text-xs font-bold px-2 py-1 rounded-lg border backdrop-blur-sm', platformStyle.colorClass)}>
                    {platformStyle.label}
                  </span>
                )}

                {/* Duration pill */}
                {!showVideo && clip.duration_seconds && (
                  <span className="absolute bottom-2.5 left-2.5 z-[6] text-[13px] text-white bg-black/85 px-2.5 py-1 rounded-lg font-medium" style={{ border: '1px solid rgba(255,255,255,.1)' }}>
                    {formatDuration(clip.duration_seconds)}
                  </span>
                )}

                {/* Play button — hidden when hovering */}
                {!showVideo && (
                  <div className="play-btn">
                    <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
                  </div>
                )}

                {/* Bookmark + external — hidden when hovering */}
                {!showVideo && (
                  <div className="absolute bottom-2 right-2 z-[6] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onToggleSave && (
                      <button onClick={(e) => { e.stopPropagation(); onToggleSave(clip.id) }}
                        className={cn('p-1.5 rounded-lg backdrop-blur-sm transition-colors', isSaved ? 'bg-primary/80 text-white' : 'bg-black/60 text-white/70 hover:text-white')}
                        title={isSaved ? 'Unsave' : 'Save'}>
                        <Bookmark className={cn('h-3.5 w-3.5', isSaved && 'fill-current')} />
                      </button>
                    )}
                    <a href={clip.external_url} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-black/60 backdrop-blur-sm text-white/70 hover:text-white transition-colors"
                      onClick={(e) => e.stopPropagation()} title="View original">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ═══ META ═══ */}
        <div className="leg-bottom">
          <div className="leg-meta">
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-[15px] font-semibold leading-tight line-clamp-2 text-white">
                  {clip.title ?? clip.author_name ?? 'Stream clip'}
                </p>
                <p className="text-xs text-zinc-400 mt-1.5">
                  {clip.author_handle && <span className="font-medium text-zinc-300">@{clip.author_handle}</span>}
                  {clip.author_handle && gameLabel ? ' · ' : ''}
                  {gameLabel || ''}
                </p>
                <p className="leg-hook">
                  {legendaryHook}
                </p>
              </div>
              {score !== null && (
                <div className="leg-score-block">
                  <svg width="18" height="22" viewBox="0 0 110 140" fill="none">
                    <path d="M10 42 L35 42 L55 10Z" fill="url(#gc1)"/><path d="M35 42 L55 10 L75 42Z" fill="url(#gc2)"/><path d="M75 42 L55 10 L100 42Z" fill="url(#gc3)"/>
                    <path d="M10 42 L35 42 L55 120Z" fill="url(#gpl)"/><path d="M35 42 L55 42 L55 120Z" fill="url(#gpml)"/>
                    <path d="M55 42 L75 42 L55 120Z" fill="url(#gpmr)"/><path d="M75 42 L100 42 L55 120Z" fill="url(#gpr)"/>
                  </svg>
                  <span className="leg-score-big">{score}</span>
                </div>
              )}
            </div>
            <div className="leg-divider" />
            <button className="leg-cta"
              onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
              disabled={remixing}>
              {remixing ? 'Creating...' : '✦ Make it Viral'}
            </button>
          </div>
        </div>
      </motion.article>
    )
  }

  // ── Default rendering path (neutral / epic / master) ──────────────────────
  return (
    <motion.article
      ref={tilt.ref as React.RefObject<HTMLElement>}
      className={cn('clip rounded-xl overflow-visible group cursor-pointer transition-all duration-300', tierClass)}
      style={{ rotateX: tilt.style.rotateX, rotateY: tilt.style.rotateY, scale: tilt.style.scale, transformPerspective: 800 }}
      onMouseMove={tilt.handlers.onMouseMove}
      onMouseEnter={() => { tilt.handlers.onMouseEnter(); handleMouseEnter() }}
      onMouseLeave={() => { tilt.handlers.onMouseLeave(); handleMouseLeave() }}
    >
      {/* Thumbnail */}
      <div className="thumb aspect-video relative overflow-hidden rounded-t-xl bg-gradient-to-br from-slate-900 to-slate-800">

        {/* Video preview on hover */}
        {showVideo && videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover z-[5]"
            autoPlay muted playsInline loop disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback"
            onPlaying={() => setVideoPlaying(true)}
          />
        )}

        {/* Thumbnail image or avatar fallback */}
        {clip.thumbnail_url && !imgError ? (
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

        {/* Platform badge — hidden when video preview active */}
        {!showVideo && (
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
        {!showVideo && clip.duration_seconds && (
          <span className="absolute bottom-2 left-2 z-[6] text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded-md backdrop-blur-sm font-medium">
            {formatDuration(clip.duration_seconds)}
          </span>
        )}

        {/* Play button — hidden when hovering */}
        {!showVideo && (
          <div className="play-btn">
            <Play className="h-5 w-5 text-white ml-0.5" fill="white" />
          </div>
        )}

        {/* Bookmark + External link — hidden when hovering */}
        {!showVideo && (
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
      <div className={cn('meta-section p-3 rounded-b-xl', isMaster ? '' : 'bg-card/60')}>
        {isEpic ? (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
                  {clip.title ?? clip.author_name ?? 'Stream clip'}
                </p>
                {clip.author_handle && (
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium text-zinc-300">@{clip.author_handle}</span>
                    {gameLabel ? ` · ${gameLabel}` : ''}
                  </p>
                )}
                <p className="text-xs font-semibold mt-1.5" style={{ color: '#A78BFA' }}>
                  ⚡ High viral potential
                </p>
              </div>
              {score !== null && (
                <div className="epic-score-block">
                  <span className="epic-score-num">{score}</span>
                </div>
              )}
            </div>
            <div className="epic-divider" />
            <button
              className="cta-viral w-full h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative z-10"
              onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
              disabled={remixing}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="relative z-10">{remixing ? 'Creating...' : 'Make It Viral'}</span>
            </button>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
              {clip.title ?? clip.author_name ?? 'Stream clip'}
            </p>

            {clip.author_handle && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                <span className="w-4 h-4 rounded-full bg-muted/60 shrink-0 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                  {(clip.author_handle ?? 'U')[0].toUpperCase()}
                </span>
                <b className="text-zinc-300">@{clip.author_handle}</b>
                {gameLabel && (
                  <span className="text-zinc-500">&middot; {gameLabel}</span>
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
        )}
      </div>
    </motion.article>
  )
})
