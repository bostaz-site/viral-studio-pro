"use client"

import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ExternalLink, Sparkles, Flame, Bookmark, SlidersHorizontal, Zap, CheckCircle2 } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { getRankTierClass, DiamondCorner } from '@/components/trending/rank-badge'
import { getClipVerdict, getDynamicCTA, getVerdictColor, type CTAIcon } from '@/lib/browse/clip-verdict'
import { useTilt } from '@/lib/hooks/use-tilt'
import { cn } from '@/lib/utils'
import { timeAgo, formatCount } from '@/lib/trending/utils'
import { PLATFORM_STYLES, NICHE_LABELS } from '@/lib/trending/constants'
import { clipRank, getClipInsight } from '@/types/trending'
import type { TrendingClip } from '@/types/trending'
import { isHoverPreviewV2 } from '@/lib/feature-flags'

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
  onShowDetail?: (clip: TrendingClip) => void
  quickExportState?: QuickExportState | null
  remixing?: boolean
  isSaved?: boolean
  onToggleSave?: (clipId: string) => void
  onToggleGroup?: (groupId: string) => void
  isGroupExpanded?: boolean
  /** Clip appeared since the user's last visit */
  isNew?: boolean
  /** Timestamp of user's last visit (ISO) for NEW badge logic */
  lastVisit?: string | null
}

// ── Module-level video URL cache ──
const preResolvedCache = new Map<string, string>()

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

function CTAIconComponent({ icon }: { icon: CTAIcon }) {
  switch (icon) {
    case 'Flame': return <Flame className="h-3.5 w-3.5" />
    case 'Sparkles': return <Sparkles className="h-3.5 w-3.5" />
    case 'SlidersHorizontal': return <SlidersHorizontal className="h-3.5 w-3.5" />
    case 'Zap': return <Zap className="h-3.5 w-3.5" />
  }
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

export const TrendingCard = memo(function TrendingCard({ clip, onRemix, onQuickExport, onShowDetail, quickExportState, remixing = false, isSaved = false, onToggleSave, isNew = false }: TrendingCardProps) {
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null)
  const [showOverlay, setShowOverlay] = useState(false)
  const [mobileTapActive, setMobileTapActive] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const hoveredRef = useRef(false)
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isMobileRef = useRef(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hlsRef = useRef<any>(null)

  // Kick CDN: derive HLS playlist URL from thumbnail (no API needed, CORS open)
  // thumbnail: https://clips.kick.com/clips/02/clip_01KZ.../thumbnail.webp
  // playlist:  https://clips.kick.com/clips/02/clip_01KZ.../playlist.m3u8
  const kickCdnPlaylistUrl = useMemo(() => {
    const thumb = clip.thumbnail_url
    if (!thumb || !thumb.includes('clips.kick.com/clips/')) return null
    const lastSlash = thumb.lastIndexOf('/')
    if (lastSlash < 0) return null
    return thumb.substring(0, lastSlash + 1) + 'playlist.m3u8'
  }, [clip.thumbnail_url])

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
    abortRef.current?.abort()
    abortRef.current = null
  }, [clip.id, clip.external_url])

  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  useEffect(() => {
    isMobileRef.current = typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  }, [])

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
      if (u.hostname === 'kick.com' || u.hostname === 'www.kick.com') {
        const m1 = u.pathname.match(/^\/[^/]+\/clips?\/([^/?]+)$/)
        if (m1) return m1[1]
        const m2 = u.pathname.match(/^\/clips?\/([^/?]+)$/)
        if (m2) return m2[1]
      }
    } catch { /* invalid URL */ }
    return null
  }, [clip.external_url])

  // V2: IntersectionObserver pre-resolution
  useEffect(() => {
    if (!isHoverPreviewV2) return
    const platform = clip.platform?.toLowerCase()
    if (platform !== 'twitch' && platform !== 'kick') return
    if (preResolvedCache.has(clip.id)) return

    // Kick: use CDN-derived playlist directly (no API needed)
    if (platform === 'kick' && kickCdnPlaylistUrl) {
      preResolvedCache.set(clip.id, kickCdnPlaylistUrl)
      return
    }

    const slug = getClipSlug()
    if (!slug) return

    const el = (tilt.ref as React.RefObject<HTMLElement>).current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      if (preResolvedCache.has(clip.id)) return

      const url = `/api/clips/video-url?slug=${encodeURIComponent(slug)}&platform=${platform}`
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.video_url) preResolvedCache.set(clip.id, data.video_url)
        })
        .catch(() => {})
    }, { threshold: 0.1 })

    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, clip.external_url, getClipSlug, kickCdnPlaylistUrl])

  // V2: Overlay CTA timer
  useEffect(() => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)
    if (!isHoverPreviewV2) return
    if (mobileTapActive) { setShowOverlay(true); return }
    if (videoPlaying) {
      overlayTimerRef.current = setTimeout(() => setShowOverlay(true), 1500)
    } else {
      setShowOverlay(false)
    }
    return () => { if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current) }
  }, [videoPlaying, mobileTapActive])

  const fetchedForHoverRef = useRef(false)

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    hoveredRef.current = true
    fetchedForHoverRef.current = false
    const platform = clip.platform?.toLowerCase()
    if (platform !== 'twitch' && platform !== 'kick') return

    // Kick: use CDN-derived playlist directly (no API call, no 403)
    if (platform === 'kick' && kickCdnPlaylistUrl) {
      preResolvedCache.set(clip.id, kickCdnPlaylistUrl)
      setResolvedVideoUrl(kickCdnPlaylistUrl)
      return
    }

    if (isHoverPreviewV2) {
      const cached = preResolvedCache.get(clip.id)
      if (cached) { setResolvedVideoUrl(cached); return }
    }
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    fetchedForHoverRef.current = true
    const slug = getClipSlug()
    if (!slug) return
    const url = `/api/clips/video-url?slug=${encodeURIComponent(slug)}&platform=${platform}`
    fetch(url, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.video_url && hoveredRef.current) {
          if (isHoverPreviewV2) preResolvedCache.set(clip.id, data.video_url)
          setResolvedVideoUrl(data.video_url)
        }
      })
      .catch(() => {})
  }, [clip.platform, clip.id, getClipSlug, kickCdnPlaylistUrl])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    hoveredRef.current = false
    setShowVideo(false)
    setVideoPlaying(false)
    setResolvedVideoUrl(null)
    setShowOverlay(false)
    setMobileTapActive(false)
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)
    abortRef.current?.abort()
    abortRef.current = null
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.removeAttribute('src'); videoRef.current.load() }
  }, [])

  useEffect(() => {
    if (!hovered || !videoUrl) return
    setShowVideo(true)
  }, [hovered, videoUrl])

  // HLS.js attachment for Kick clips (.m3u8 URLs)
  useEffect(() => {
    const video = videoRef.current
    if (!showVideo || !videoUrl || !video) return
    const isHls = videoUrl.includes('.m3u8')
    if (!isHls) return // MP4 handled natively by <video src=>

    // Safari supports HLS natively
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = videoUrl
      return
    }

    // Chrome/Firefox: use hls.js
    let cancelled = false
    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return
      const hls = new Hls({ maxBufferLength: 10, maxMaxBufferLength: 15 })
      hlsRef.current = hls
      hls.loadSource(videoUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.ERROR, () => {
        hls.destroy()
        hlsRef.current = null
        hls.destroy()
        hlsRef.current = null
        setShowVideo(false)
        setVideoPlaying(false)
        setShowOverlay(false)
      })
    }).catch(() => {})

    return () => {
      cancelled = true
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null }
    }
  }, [showVideo, videoUrl])

  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (!isHoverPreviewV2 || !isMobileRef.current) return
    if (mobileTapActive) return
    e.stopPropagation()
    setMobileTapActive(true)
    const platform = clip.platform?.toLowerCase()
    if (platform !== 'twitch' && platform !== 'kick') return
    const slug = getClipSlug()
    if (!slug) return
    const cached = preResolvedCache.get(clip.id)
    if (cached) { setResolvedVideoUrl(cached); setShowVideo(true); return }
    const url = `/api/clips/video-url?slug=${encodeURIComponent(slug)}&platform=${platform}`
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.video_url) { preResolvedCache.set(clip.id, data.video_url); setResolvedVideoUrl(data.video_url); setShowVideo(true) }
      })
      .catch(() => {})
  }, [mobileTapActive, clip.id, clip.platform, getClipSlug])

  const handleVideoError = useCallback(() => {
    setShowVideo(false)
    setVideoPlaying(false)
    setShowOverlay(false)
    if (isHoverPreviewV2) preResolvedCache.delete(clip.id)
  }, [clip.id])

  const rank = clipRank(clip)
  const insight = getClipInsight(clip)
  const tierClass = getRankTierClass(rank)
  const score = clip.velocity_score !== null ? Math.round(clip.velocity_score) : null
  const isSixSeven = score === 67
  const isLegendary = rank === 'legendary'
  const isEpic = rank === 'epic'
  // Legendary sub-intensity: 85+ gets full ornate frame, 80-84 gets simple gold border
  const isLegendaryFull = isLegendary && (score ?? 0) >= 85

  const tiltAmplitude = isLegendary ? 10 : isEpic ? 8 : 5
  const tilt = useTilt({ rotateAmplitude: tiltAmplitude, scaleOnHover: 1.0 })

  const isExporting = quickExportState?.clipId === clip.id && quickExportState.status === 'rendering'
  const isExported = quickExportState?.clipId === clip.id && quickExportState.status === 'done'
  // Kick thumbnails serve content-type: application/octet-stream which breaks
  // the Netlify Image CDN / next/image optimizer → bypass with unoptimized
  const isKickThumb = !!clip.thumbnail_url && clip.thumbnail_url.includes('kick.com')

  const verdict = getClipVerdict(clip)
  const dynamicCTA = getDynamicCTA(clip)
  const verdictColor = getVerdictColor(score ?? 0)

  // Score delta (E3)
  const prevScore = clip.prev_momentum_score
  const scoreDelta = (prevScore != null && score != null) ? score - Math.round(prevScore) : null
  const showDelta = scoreDelta != null && Math.abs(scoreDelta) >= 5

  // V2: overlay verdict
  const overlayVerdict = clip.feed_category === 'early_gem' ? 'Early Gem — jump on it'
    : clip.feed_category === 'hot_now' ? 'Exploding — catch it now'
    : clip.feed_category === 'proven' ? 'Proven performer'
    : verdict.text

  // Shared overlay CTA
  const overlayCTA = isHoverPreviewV2 && showOverlay ? (
    <div
      className="absolute inset-x-0 bottom-0 z-[15] flex flex-col items-center gap-2 px-3 pb-3 pt-8 animate-in fade-in duration-300"
      style={{ background: 'linear-gradient(to top, rgba(0,0,0,.92) 0%, rgba(0,0,0,.65) 60%, transparent 100%)' }}
    >
      {score !== null && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-white/60 uppercase tracking-wider font-semibold">Viral</span>
          <span className="text-xs font-black text-white bg-white/10 rounded-full px-2 py-0.5">{score}</span>
        </div>
      )}
      <p className="text-[11px] font-bold text-center line-clamp-1" style={{ color: verdictColor }}>
        {overlayVerdict}
      </p>
      <button
        className="w-full max-w-[200px] h-10 rounded-xl text-sm font-black text-amber-950 transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b 45%, #d97706)',
          boxShadow: '0 0 20px rgba(245,158,11,.22)',
        }}
        onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
      >
        Enhance This Clip
      </button>
    </div>
  ) : null

  // ── NEW badge (E2) ──
  const newBadge = isNew ? (
    <span className={cn(
      'absolute top-2 right-2 z-[7] text-[11px] font-bold px-2 py-0.5 rounded-md',
      isLegendary
        ? 'bg-amber-400/15 border border-amber-400/30 text-amber-300'
        : 'bg-cyan-400/15 border border-cyan-400/30 text-cyan-300'
    )}>
      {isLegendary ? 'LEGENDARY DROP' : 'NEW'}
    </span>
  ) : null

  // ── Legendary rendering path (80-99) — 2 intensities ──
  if (isLegendary) {

    return (
      <motion.article
        ref={tilt.ref as React.RefObject<HTMLElement>}
        className={cn("r-legendary group cursor-pointer overflow-visible", !isLegendaryFull && 'r-legendary-simple')}
        style={{
          rotateX: tilt.style.rotateX,
          rotateY: tilt.style.rotateY,
          scale: tilt.style.scale,
          transformPerspective: 800,
        }}
        onMouseMove={tilt.handlers.onMouseMove}
        onMouseEnter={() => { tilt.handlers.onMouseEnter(); handleMouseEnter() }}
        onMouseLeave={() => { tilt.handlers.onMouseLeave(); handleMouseLeave() }}
        onClick={handleCardClick}
      >
        {/* Shared SVG gradient defs */}
        <LegGemDefs />

        {/* Glow */}
        <div className="leg-glow" />

        {/* Sparkles — only on full legendary (85+), reduced -25% */}
        {isLegendaryFull && (
          <div style={{ position: 'absolute', inset: '-20px', overflow: 'visible', pointerEvents: 'none' }}>
            <div className="leg-sparkle" style={{ top: '5%', left: '10%', width: 10, height: 10, '--dx': '-14px', '--dy': '-12px', animationDelay: '0s', opacity: .5 } as React.CSSProperties}><LegSparkle4 /></div>
            <div className="leg-sparkle" style={{ top: '8%', left: '90%', width: 9, height: 9, '--dx': '12px', '--dy': '-10px', animationDelay: '.5s', opacity: .45 } as React.CSSProperties}><LegSparkle4 /></div>
            <div className="leg-sparkle" style={{ top: '55%', left: '-1%', width: 10, height: 10, '--dx': '-16px', '--dy': '8px', animationDelay: '1s', opacity: .5 } as React.CSSProperties}><LegSparkle4 /></div>
          </div>
        )}

        {/* ═══ FRAME — full only for 85+ ═══ */}
        {isLegendaryFull ? (
          <div className="leg-frame">
            <div className="leg-gem tl"><LegGoldGem w={22} h={26} /></div>
            <div className="leg-gem tr"><LegGoldGem w={22} h={26} /></div>
            <div className="leg-gem bl"><LegGoldGem w={22} h={26} /></div>
            <div className="leg-gem br"><LegGoldGem w={22} h={26} /></div>
            <div className="leg-frame-inner-border">
              <div className="leg-frame-inner-gold">
                <div className="leg-thumb" style={{ height: '150px' }}>
                  {showVideo && videoUrl && (
                    <video key={`${clip.id}-${videoUrl}`} ref={videoRef} src={videoUrl?.includes('.m3u8') ? undefined : videoUrl}
                      className="absolute inset-0 w-full h-full object-cover z-[5]"
                      autoPlay muted playsInline loop disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback"
                      onPlaying={() => setVideoPlaying(true)}
                      onError={handleVideoError}
                    />
                  )}
                  {clip.thumbnail_url && !imgError && (
                    <Image src={clip.thumbnail_url} alt={clip.title ?? 'Clip'} fill unoptimized={isKickThumb}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className={cn('object-cover transition-all duration-500', hovered && 'scale-105 brightness-75')}
                      onError={() => setImgError(true)} />
                  )}
                  {(!clip.thumbnail_url || imgError) && (
                    <div className={cn('w-full h-full flex items-center justify-center bg-gradient-to-br', streamerGradient)}>
                      <span className="text-2xl font-black text-white/90">{(clip.author_name ?? 'C')[0].toUpperCase()}</span>
                    </div>
                  )}
                  <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,.65), transparent 40%, rgba(0,0,0,.25))' }} />
                  <div className="leg-godray" />
                  <div className="leg-shimmer"><div className="leg-shimmer-bar" /></div>
                  {!showVideo && (<span className={cn('absolute top-2 left-2 z-[6] text-xs font-bold px-2 py-1 rounded-lg border backdrop-blur-sm', platformStyle.colorClass)}>{platformStyle.label}</span>)}
                  {!showVideo && clip.duration_seconds && (
                    <span className="absolute bottom-2.5 left-2.5 z-[6] text-[13px] text-white bg-black/85 px-2.5 py-1 rounded-lg font-medium" style={{ border: '1px solid rgba(255,255,255,.1)' }}>
                      {formatDuration(clip.duration_seconds)}
                    </span>
                  )}
                  {newBadge}
                  {overlayCTA}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Simple legendary (80-84): gold border, no frame ornaments */
          <div className="leg-thumb-simple" style={{ height: '150px' }}>
            {showVideo && videoUrl && (
              <video key={`${clip.id}-${videoUrl}`} ref={videoRef} src={videoUrl?.includes('.m3u8') ? undefined : videoUrl}
                className="absolute inset-0 w-full h-full object-cover z-[5]"
                autoPlay muted playsInline loop disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback"
                onPlaying={() => setVideoPlaying(true)}
                onError={handleVideoError}
              />
            )}
            {clip.thumbnail_url && !imgError && (
              <Image src={clip.thumbnail_url} alt={clip.title ?? 'Clip'} fill unoptimized={isKickThumb}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className={cn('object-cover transition-all duration-500', hovered && 'scale-105 brightness-75')}
                onError={() => setImgError(true)} />
            )}
            {(!clip.thumbnail_url || imgError) && (
              <div className={cn('w-full h-full flex items-center justify-center bg-gradient-to-br', streamerGradient)}>
                <span className="text-2xl font-black text-white/90">{(clip.author_name ?? 'C')[0].toUpperCase()}</span>
              </div>
            )}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,.65), transparent 40%, rgba(0,0,0,.25))' }} />
            {!showVideo && (<span className={cn('absolute top-2 left-2 z-[6] text-xs font-bold px-2 py-1 rounded-lg border backdrop-blur-sm', platformStyle.colorClass)}>{platformStyle.label}</span>)}
            {!showVideo && clip.duration_seconds && (
              <span className="absolute bottom-2 left-2 z-[6] text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded-md backdrop-blur-sm font-medium">
                {formatDuration(clip.duration_seconds)}
              </span>
            )}
            {newBadge}
            {overlayCTA}
          </div>
        )}

        {/* ═══ META ═══ */}
        <div className="leg-bottom">
          <div className="leg-meta" style={{ padding: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="text-[16px] font-bold leading-tight line-clamp-1 text-white">
                  {clip.title ?? clip.author_name ?? 'Stream clip'}
                </p>
                <p className="text-[13px] text-zinc-400 mt-1">
                  {clip.author_handle && <span className="font-medium text-zinc-300">@{clip.author_handle}</span>}
                  {clip.author_handle && gameLabel ? ' · ' : ''}
                  {gameLabel || ''}
                </p>
                {/* Verdict — simplified (C4) */}
                <p className="text-[13px] font-bold mt-1.5" style={{ color: verdictColor }}>
                  {verdict.text}
                </p>
                <p className="text-[12px] text-zinc-500 line-clamp-1">{verdict.reason}</p>
                {/* Score delta (E3) */}
                {showDelta && (
                  <span className={cn('text-[10px] font-bold mt-0.5 inline-block', scoreDelta! > 0 ? 'text-cyan-400' : 'text-zinc-500')}>
                    {scoreDelta! > 0 ? `↑ Heating` : `↓ Cooling (was ${Math.round(prevScore!)})`}
                  </span>
                )}
                {/* "Why this clip?" — hover only on desktop (C1) */}
                {onShowDetail && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onShowDetail(clip) }}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap relative z-10 opacity-0 group-hover:opacity-100 mt-0.5 block"
                  >
                    Why this clip?
                  </button>
                )}
              </div>
              {score !== null && (
                <div className="leg-score-block">
                  <span className={`leg-score-big${isSixSeven ? ' score-six-seven' : ''}`} style={{ fontSize: '64px' }}>{score}</span>
                </div>
              )}
            </div>
            <div className="leg-divider" />
            {/* Split button CTA (C3) */}
            <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
              <button className="leg-cta" style={{ flex: 1, borderTopRightRadius: onQuickExport ? 0 : undefined, borderBottomRightRadius: onQuickExport ? 0 : undefined, height: '44px' }}
                onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
                disabled={remixing}>
                {remixing ? 'Creating...' : `${dynamicCTA.icon === 'Flame' ? '\uD83D\uDD25' : '\u2726'} ${dynamicCTA.label}`}
              </button>
              {onQuickExport && (
                <button
                  onClick={(e) => { e.stopPropagation(); onQuickExport(clip) }}
                  disabled={isExporting}
                  className="h-[44px] px-3 flex-shrink-0 flex items-center justify-center border-l border-amber-700/40"
                  style={{
                    background: isExported
                      ? 'linear-gradient(180deg, #1a3a1a 0%, #0a2a0a 50%, #052005 100%)'
                      : 'linear-gradient(180deg, #5C4400 0%, #3A2A00 50%, #2A1E00 100%)',
                    borderRadius: '0 10px 10px 0',
                    border: isExported ? '2px solid #22c55e' : '2px solid #DAA520',
                    borderLeft: '1px solid rgba(139,105,20,.4)',
                    color: isExported ? '#4ADE80' : '#FFE9A8',
                  }}
                  title={isExported ? 'In your bank \u2014 export again?' : 'Quick Export'}
                >
                  {isExporting ? <WolfLoader variant="spinner" size={14} mode="amber" /> : isExported ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                </button>
              )}
              {/* Bookmark — opacity 0 → 1 on hover (C2) */}
              {onToggleSave && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSave(clip.id) }}
                  className={cn(
                    'h-[34px] w-[34px] flex-shrink-0 rounded-lg flex items-center justify-center border transition-all ml-1.5',
                    isSaved ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 opacity-100' : 'bg-zinc-900/60 border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 opacity-0 group-hover:opacity-100'
                  )}
                  title={isSaved ? 'Unsave' : 'Save'}
                >
                  <Bookmark className={cn('h-3.5 w-3.5', isSaved && 'fill-current')} />
                </button>
              )}
            </div>
          </div>
        </div>
      </motion.article>
    )
  }

  // ── Default rendering path (neutral / epic) ──
  return (
    <motion.article
      ref={tilt.ref as React.RefObject<HTMLElement>}
      className={cn('clip rounded-2xl overflow-visible group cursor-pointer transition-all duration-300', tierClass)}
      style={{ rotateX: tilt.style.rotateX, rotateY: tilt.style.rotateY, scale: tilt.style.scale, transformPerspective: 800 }}
      onMouseMove={tilt.handlers.onMouseMove}
      onMouseEnter={() => { tilt.handlers.onMouseEnter(); handleMouseEnter() }}
      onMouseLeave={() => { tilt.handlers.onMouseLeave(); handleMouseLeave() }}
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="thumb relative overflow-hidden rounded-t-xl bg-gradient-to-br from-slate-900 to-slate-800" style={{ height: '155px' }}>

        {showVideo && videoUrl && (
          <video
            key={`${clip.id}-${videoUrl}`}
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-cover z-[5]"
            autoPlay muted playsInline loop disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback"
            onPlaying={() => setVideoPlaying(true)}
            onError={handleVideoError}
          />
        )}

        {clip.thumbnail_url && !imgError && !imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-800 animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
        )}

        {clip.thumbnail_url && !imgError ? (
          <Image
            src={clip.thumbnail_url}
            alt={clip.title ?? 'Clip de stream'}
            fill
            unoptimized={isKickThumb}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={cn(
              'object-cover transition-all duration-500',
              hovered ? 'scale-110 brightness-75' : '',
              !imgLoaded && 'opacity-0'
            )}
            onLoad={() => setImgLoaded(true)}
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
          </div>
        )}

        {!showVideo && (
          <span className={cn(
            'absolute top-2 left-2 z-[6] text-xs font-bold px-2 py-0.5 rounded-full border backdrop-blur-sm',
            platformStyle.colorClass
          )}>
            {platformStyle.label}
          </span>
        )}

        {/* Epic frame */}
        {isEpic && <EpicFrame />}

        {/* Score on thumbnail — B1 rarity scale */}
        {score !== null && (
          <span className={cn(
            'rank-score',
            isSixSeven && 'score-six-seven'
          )} style={{
            fontSize: isEpic ? '52px' : '40px',
            color: isEpic ? '#7DD3FC' : '#9CA3AF',
            fontWeight: 700,
          }}>
            {score}
          </span>
        )}

        {/* Duration pill */}
        {!showVideo && clip.duration_seconds && (
          <span className="absolute bottom-2 left-2 z-[6] text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded-md backdrop-blur-sm font-medium">
            {formatDuration(clip.duration_seconds)}
          </span>
        )}

        {/* NEW badge (E2) */}
        {newBadge}

        {overlayCTA}

      </div>

      {/* Meta section */}
      <div className="p-[14px] rounded-b-2xl bg-card/60">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-bold leading-tight line-clamp-1 text-foreground">
              {clip.title ?? clip.author_name ?? 'Stream clip'}
            </p>
            {clip.author_handle && (
              <p className="text-[13px] text-zinc-400 truncate mt-0.5">
                @{clip.author_handle}
                {gameLabel && <span className="text-zinc-500"> · {gameLabel}</span>}
              </p>
            )}
          </div>
          {/* Epic score block in meta (hidden on thumbnail via CSS for epic) */}
          {isEpic && score !== null && (
            <div className="epic-score-block">
              <span className={`epic-score-num${isSixSeven ? ' score-six-seven' : ''}`} style={{ fontSize: '52px' }}>{score}</span>
            </div>
          )}
        </div>

        {/* Signal tags — hover reveal only (C1) */}
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

        {/* Verdict — simplified (C4) */}
        <p className="text-[13px] font-bold mt-1.5" style={{ color: verdictColor }}>
          {verdict.text}
        </p>
        <p className="text-[12px] text-zinc-500 line-clamp-1">{verdict.reason}</p>

        {/* Score delta (E3) */}
        {showDelta && (
          <span className={cn('text-[10px] font-bold mt-0.5 inline-block', scoreDelta! > 0 ? 'text-cyan-400' : 'text-zinc-500')}>
            {scoreDelta! > 0 ? `↑ Heating` : `↓ Cooling (was ${Math.round(prevScore!)})`}
          </span>
        )}

        {/* "Why this clip?" — hover only (C1) */}
        {onShowDetail && (
          <button
            onClick={(e) => { e.stopPropagation(); onShowDetail(clip) }}
            className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap relative z-10 opacity-0 group-hover:opacity-100 mt-0.5 block"
          >
            Why this clip?
          </button>
        )}

        {/* Split button CTA + Quick Export (C3, C5) */}
        <div className="flex items-center gap-1.5 mt-2.5">
          <div className="flex flex-1 min-w-0">
            <button
              className="cta-viral flex-1 h-[44px] rounded-l-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative z-10"
              style={{ borderTopRightRadius: onQuickExport ? 0 : undefined, borderBottomRightRadius: onQuickExport ? 0 : undefined }}
              onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
              disabled={remixing}
            >
              <CTAIconComponent icon={dynamicCTA.icon} />
              <span className="relative z-10">{remixing ? 'Creating...' : dynamicCTA.label}</span>
            </button>
            {onQuickExport && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickExport(clip) }}
                disabled={isExporting}
                className={cn(
                  'h-[44px] px-2.5 flex-shrink-0 flex items-center justify-center rounded-r-xl border-l relative z-10',
                  isExported
                    ? 'bg-emerald-950/80 border-emerald-700/30 text-emerald-400'
                    : 'cta-viral border-amber-800/30',
                )}
                title={isExported ? 'In your bank \u2014 export again?' : 'Quick Export'}
              >
                {isExporting ? <WolfLoader variant="spinner" size={14} mode="amber" /> : isExported ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
          {/* Bookmark — opacity 0 → 1 on hover (C2) */}
          {onToggleSave && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSave(clip.id) }}
              className={cn(
                'h-[34px] w-[34px] flex-shrink-0 rounded-xl flex items-center justify-center border transition-all relative z-10',
                isSaved ? 'bg-amber-500/20 border-amber-500/30 text-amber-400 opacity-100' : 'bg-card/60 border-border text-muted-foreground hover:text-amber-400 hover:border-amber-500/30 opacity-0 group-hover:opacity-100'
              )}
              title={isSaved ? 'Unsave' : 'Save'}
            >
              <Bookmark className={cn('h-3.5 w-3.5', isSaved && 'fill-current')} />
            </button>
          )}
        </div>
      </div>
    </motion.article>
  )
})
