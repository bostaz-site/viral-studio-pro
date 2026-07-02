"use client"

import { useState, useRef, useCallback, useEffect, memo } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ExternalLink, Sparkles, Flame, Bookmark, SlidersHorizontal, Loader2, Zap } from 'lucide-react'
import { getRankTierClass, MasterCorner, MasterCrown, SkullIcon } from '@/components/trending/rank-badge'
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
}

// ── Module-level video URL cache ──
// Pre-resolved URLs survive re-renders and card unmounts within a session.
// Keyed by clip.id — prevents duplicate /api/clips/video-url fetches.
// Kill switch: entries are deleted on video error so a bad URL isn't reused.
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

// ── CTA icon by dynamic type ──
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

export const TrendingCard = memo(function TrendingCard({ clip, onRemix, onQuickExport, onShowDetail, quickExportState, remixing = false, isSaved = false, onToggleSave }: TrendingCardProps) {
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [showVideo, setShowVideo] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null)
  // V2: overlay CTA state
  const [showOverlay, setShowOverlay] = useState(false)
  // V2: mobile first-tap state (first tap shows preview+CTA, second tap navigates)
  const [mobileTapActive, setMobileTapActive] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const hoveredRef = useRef(false)
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Stable ref: true if the device has touch input (populated once on mount)
  const isMobileRef = useRef(false)

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

  // Cleanup abort on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort() }
  }, [])

  // Detect touch device (once, client-side only)
  useEffect(() => {
    isMobileRef.current = typeof window !== 'undefined' && navigator.maxTouchPoints > 0
  }, [])

  const getClipSlug = useCallback((): string | null => {
    try {
      const u = new URL(clip.external_url)
      // Twitch
      if (u.hostname === 'clips.twitch.tv') {
        const slug = u.pathname.replace('/', '')
        return slug && !slug.includes('/') ? slug : null
      }
      if (u.hostname === 'www.twitch.tv' || u.hostname === 'twitch.tv') {
        const m = u.pathname.match(/^\/[^/]+\/clip\/([^/]+)$/)
        return m ? m[1] : null
      }
      // Kick — patterns: /streamer/clips/clip_xxx OR /clip/clip_xxx
      if (u.hostname === 'kick.com' || u.hostname === 'www.kick.com') {
        // Try /streamer/clips/{slug}
        const m1 = u.pathname.match(/^\/[^/]+\/clips?\/([^/?]+)$/)
        if (m1) return m1[1]
        // Try /clip/{slug}
        const m2 = u.pathname.match(/^\/clips?\/([^/?]+)$/)
        if (m2) return m2[1]
      }
    } catch { /* invalid URL */ }
    return null
  }, [clip.external_url])

  // ── V2: IntersectionObserver pre-resolution ──
  // When the card scrolls into view, pre-fetch the video URL so it's ready
  // at hover time (~0ms latency vs 300-800ms per-hover fetch).
  // Kill switch: only runs when isHoverPreviewV2 is enabled. Each clip is
  // fetched at most once per session (module-level cache + disconnect-on-fire).
  useEffect(() => {
    if (!isHoverPreviewV2) return
    const platform = clip.platform?.toLowerCase()
    if (platform !== 'twitch' && platform !== 'kick') return
    const slug = getClipSlug()
    if (!slug) return
    if (preResolvedCache.has(clip.id)) return // already resolved

    // tilt.ref is populated after mount, safe to access in useEffect
    const el = (tilt.ref as React.RefObject<HTMLElement>).current
    if (!el) return

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      // Fire once only — disconnect before fetching to prevent re-entry
      observer.disconnect()
      if (preResolvedCache.has(clip.id)) return

      const url = `/api/clips/video-url?slug=${encodeURIComponent(slug)}&platform=${platform}`
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.video_url) preResolvedCache.set(clip.id, data.video_url)
        })
        .catch(() => { /* silent — hover will fall back to per-fetch */ })
    }, { threshold: 0.1 })

    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip.id, clip.external_url, getClipSlug])

  // ── V2: Overlay CTA timer ──
  // Desktop: shows 1.5s after video starts playing (establishes intent).
  // Mobile: shows immediately when mobileTapActive (tap IS the intent signal).
  useEffect(() => {
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)

    if (!isHoverPreviewV2) return

    if (mobileTapActive) {
      setShowOverlay(true)
      return
    }

    if (videoPlaying) {
      overlayTimerRef.current = setTimeout(() => setShowOverlay(true), 1500)
    } else {
      setShowOverlay(false)
    }

    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)
    }
  }, [videoPlaying, mobileTapActive])

  // Track whether we've already fetched for this hover session
  const fetchedForHoverRef = useRef(false)

  const handleMouseEnter = useCallback(() => {
    setHovered(true)
    hoveredRef.current = true
    fetchedForHoverRef.current = false

    const platform = clip.platform?.toLowerCase()
    if (platform !== 'twitch' && platform !== 'kick') return

    // V2: check pre-resolution cache first — 0ms latency if pre-fetched by IO
    if (isHoverPreviewV2) {
      const cached = preResolvedCache.get(clip.id)
      if (cached) {
        setResolvedVideoUrl(cached)
        return
      }
    }

    // Fallback: fetch on hover (original behavior, also used when flag is off)
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
          // Populate cache so subsequent hovers are instant
          if (isHoverPreviewV2) preResolvedCache.set(clip.id, data.video_url)
          setResolvedVideoUrl(data.video_url)
        }
      })
      .catch(() => {/* aborted or network error — ignore */})
  }, [clip.platform, clip.id, getClipSlug])

  const handleMouseLeave = useCallback(() => {
    setHovered(false)
    hoveredRef.current = false
    setShowVideo(false)
    setVideoPlaying(false)
    setResolvedVideoUrl(null)
    setShowOverlay(false)
    setMobileTapActive(false)
    if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current)

    // Abort any in-flight fetch so late responses can't set state
    abortRef.current?.abort()
    abortRef.current = null

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [])

  useEffect(() => {
    if (!hovered || !videoUrl) return
    setShowVideo(true)
  }, [hovered, videoUrl])

  // ── V2: Mobile first-tap handler ──
  // On touch devices: first tap shows preview + overlay (no navigation).
  // The parent div's onClick navigates on second tap (or on CTA button click).
  const handleCardClick = useCallback((e: React.MouseEvent) => {
    if (!isHoverPreviewV2 || !isMobileRef.current) return
    if (mobileTapActive) return // second tap — let event bubble to parent nav handler

    // First tap: block navigation, trigger preview state
    e.stopPropagation()
    setMobileTapActive(true)

    const platform = clip.platform?.toLowerCase()
    if (platform !== 'twitch' && platform !== 'kick') return
    const slug = getClipSlug()
    if (!slug) return

    const cached = preResolvedCache.get(clip.id)
    if (cached) {
      setResolvedVideoUrl(cached)
      setShowVideo(true)
      return
    }

    const url = `/api/clips/video-url?slug=${encodeURIComponent(slug)}&platform=${platform}`
    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.video_url) {
          preResolvedCache.set(clip.id, data.video_url)
          setResolvedVideoUrl(data.video_url)
          setShowVideo(true)
        }
      })
      .catch(() => { /* silent — overlay shows without video */ })
  }, [mobileTapActive, clip.id, clip.platform, getClipSlug])

  // ── V2: Video error kill switch ──
  // Handles: Twitch CDN auth failures, CORS errors, network issues.
  // Falls back silently to thumbnail and evicts the bad URL from cache.
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
  // 6-7 easter egg — score === 67 gets rainbow holographic styling (meme reference)
  const isSixSeven = score === 67
  const isMaster = rank === 'master'
  const isLegendary = rank === 'legendary'
  const isEpic = rank === 'epic'

  const wolfColorClass = isMaster ? '' : isLegendary ? '' : isEpic ? '' : rank === 'super_rare' ? 'text-[#9CA3AF]' : rank === 'rare' ? 'text-[#9CA3AF]' : 'text-[#9CA3AF]'
  const wolfColorStyle = isMaster ? { color: '#FFE066' } : isLegendary ? { color: '#D4A840' } : isEpic ? { color: '#A78BFA' } : undefined
  const wolfGlow = isMaster || isLegendary

  const tiltAmplitude = isMaster ? 12 : isLegendary ? 10 : isEpic ? 8 : 5
  const tilt = useTilt({ rotateAmplitude: tiltAmplitude, scaleOnHover: 1.0 })

  const isExporting = quickExportState?.clipId === clip.id && quickExportState.status === 'rendering'

  const verdict = getClipVerdict(clip)
  const dynamicCTA = getDynamicCTA(clip)
  const verdictColor = getVerdictColor(score ?? 0)

  // V2: overlay verdict — short punchy line matched to feed_category signal
  const overlayVerdict = clip.feed_category === 'early_gem' ? 'Early Gem — jump on it'
    : clip.feed_category === 'hot_now' ? 'Exploding — catch it now'
    : clip.feed_category === 'proven' ? 'Proven performer'
    : verdict.text

  // ── Shared overlay CTA element (rendered inside thumb containers) ──
  // Appears after 1.5s of playback on desktop, or immediately on mobile first-tap.
  // Z-index 15 sits above video (5) and badges (6).
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
        className="w-full max-w-[200px] h-10 rounded-xl text-sm font-black text-white transition-all hover:scale-105 active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
          boxShadow: '0 4px 20px rgba(99,102,241,.45)',
        }}
        onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
      >
        Enhance This Clip →
      </button>
    </div>
  ) : null

  // ── Legendary rendering path — ornate gold frame design ──
  if (isLegendary) {

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
        onClick={handleCardClick}
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
                  <video key={`${clip.id}-${videoUrl}`} ref={videoRef} src={videoUrl}
                    className="absolute inset-0 w-full h-full object-cover z-[5]"
                    autoPlay muted playsInline loop disablePictureInPicture controlsList="nodownload nofullscreen noremoteplayback"
                    onPlaying={() => setVideoPlaying(true)}
                    onError={handleVideoError}
                  />
                )}

                {/* Thumbnail image */}
                {clip.thumbnail_url && !imgError && (
                  <Image src={clip.thumbnail_url} alt={clip.title ?? 'Clip'} fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    className={cn('object-cover transition-all duration-500', hovered && 'scale-105 brightness-75')}
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

                {/* V2: Hover overlay CTA */}
                {overlayCTA}

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
                <p className="leg-hook" style={{ color: verdictColor }}>
                  {verdict.text}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{'\u2191'} {verdict.reason}</p>
              </div>
              {score !== null && (
                <div className="leg-score-block">
                  <svg viewBox="0 0 149 183" width="18" height="22" className="inline-block" style={{ color: '#D4A840', filter: 'drop-shadow(0 0 4px rgba(212, 168, 64, 0.5))' }}>
                    <path fill="currentColor" fillRule="evenodd" d="M 16.0 5.0 L 16.0 46.0 L 21.0 63.0 L 27.0 59.0 L 24.0 27.0 L 41.0 53.0 L 35.0 53.0 L 36.0 69.0 L 28.0 63.0 L 8.0 80.0 L 17.0 85.0 L 4.0 103.0 L 14.0 102.0 L 14.0 112.0 L 31.0 111.0 L 28.0 101.0 L 40.0 111.0 L 41.0 106.0 L 50.0 112.0 L 49.0 125.0 L 62.0 149.0 L 63.0 142.0 L 71.0 138.0 L 62.0 126.0 L 64.0 122.0 L 85.0 123.0 L 77.0 137.0 L 84.0 141.0 L 86.0 149.0 L 98.0 127.0 L 96.0 111.0 L 106.0 106.0 L 108.0 110.0 L 119.0 101.0 L 116.0 111.0 L 134.0 112.0 L 132.0 103.0 L 144.0 103.0 L 130.0 85.0 L 139.0 80.0 L 119.0 63.0 L 111.0 69.0 L 113.0 53.0 L 106.0 53.0 L 123.0 27.0 L 120.0 59.0 L 126.0 64.0 L 131.0 44.0 L 130.0 4.0 L 88.0 41.0 L 59.0 41.0 Z M 51.0 137.0 L 56.0 163.0 L 64.0 173.0 L 64.0 172.0 L 66.0 171.0 L 72.0 177.0 L 74.0 178.0 L 76.0 177.0 L 81.0 172.0 L 83.0 173.0 L 89.0 167.0 L 92.0 162.0 L 92.0 159.0 L 93.0 158.0 L 93.0 153.0 L 94.0 152.0 L 94.0 148.0 L 95.0 147.0 L 96.0 138.0 L 94.0 142.0 L 94.0 145.0 L 91.0 150.0 L 90.0 155.0 L 87.0 160.0 L 85.0 159.0 L 83.0 153.0 L 82.0 157.0 L 81.0 158.0 L 81.0 161.0 L 79.0 164.0 L 68.0 164.0 L 67.0 163.0 L 67.0 159.0 L 66.0 158.0 L 65.0 153.0 L 62.0 160.0 L 61.0 160.0 L 59.0 158.0 L 58.0 154.0 L 56.0 151.0 L 55.0 146.0 L 53.0 143.0 L 52.0 138.0 Z M 110.0 82.0 L 110.0 83.0 L 109.0 84.0 L 109.0 86.0 L 108.0 87.0 L 108.0 89.0 L 107.0 90.0 L 107.0 91.0 L 106.0 92.0 L 105.0 95.0 L 103.0 97.0 L 101.0 97.0 L 100.0 98.0 L 95.0 98.0 L 94.0 99.0 L 91.0 100.0 L 91.0 101.0 L 90.0 102.0 L 89.0 102.0 L 87.0 104.0 L 86.0 104.0 L 85.0 103.0 L 85.0 101.0 L 86.0 100.0 L 86.0 96.0 L 89.0 93.0 L 90.0 93.0 L 92.0 91.0 L 93.0 91.0 L 95.0 89.0 L 96.0 89.0 L 98.0 87.0 L 99.0 87.0 L 104.0 83.0 L 105.0 83.0 L 108.0 81.0 L 109.0 81.0 Z M 38.0 82.0 L 39.0 81.0 L 42.0 82.0 L 44.0 84.0 L 45.0 84.0 L 47.0 86.0 L 48.0 86.0 L 50.0 88.0 L 51.0 88.0 L 53.0 90.0 L 54.0 90.0 L 56.0 92.0 L 57.0 92.0 L 59.0 94.0 L 60.0 94.0 L 61.0 95.0 L 61.0 98.0 L 62.0 99.0 L 62.0 103.0 L 61.0 104.0 L 60.0 104.0 L 55.0 99.0 L 52.0 99.0 L 51.0 98.0 L 47.0 98.0 L 46.0 97.0 L 45.0 97.0 L 42.0 94.0 L 42.0 93.0 L 40.0 90.0 L 40.0 88.0 L 38.0 85.0 Z M 28.0 116.0 L 31.0 117.0 L 33.0 119.0 L 34.0 119.0 L 36.0 121.0 L 37.0 121.0 L 37.0 119.0 L 36.0 118.0 L 36.0 116.0 L 34.0 113.0 L 32.0 113.0 L 30.0 115.0 L 29.0 115.0 Z M 119.0 116.0 L 118.0 115.0 L 117.0 115.0 L 115.0 113.0 L 113.0 113.0 L 113.0 114.0 L 112.0 115.0 L 112.0 117.0 L 111.0 118.0 L 111.0 120.0 L 110.0 121.0 L 113.0 120.0 L 115.0 118.0 L 116.0 118.0 L 118.0 116.0 Z M 103.0 88.0 L 100.0 89.0 L 98.0 91.0 L 97.0 91.0 L 95.0 93.0 L 94.0 93.0 L 93.0 94.0 L 99.0 94.0 L 100.0 93.0 L 101.0 93.0 L 102.0 92.0 L 102.0 90.0 L 103.0 89.0 Z M 45.0 88.0 L 45.0 90.0 L 46.0 91.0 L 46.0 92.0 L 48.0 94.0 L 54.0 94.0 L 52.0 92.0 L 51.0 92.0 L 49.0 90.0 L 48.0 90.0 Z" />
                  </svg>
                  <span className={`leg-score-big${isSixSeven ? ' score-six-seven' : ''}`}>{score}</span>
                </div>
              )}
            </div>
            <div className="leg-divider" />
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="leg-cta" style={{ flex: 1 }}
                onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
                disabled={remixing}>
                {remixing ? 'Creating...' : `${dynamicCTA.icon === 'Flame' ? '\uD83D\uDD25' : '\u2726'} ${dynamicCTA.label}`}
              </button>
              {onToggleSave && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSave(clip.id) }}
                  className={cn(
                    'h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center border transition-colors',
                    isSaved ? 'bg-amber-500/20 border-amber-500/30 text-amber-400' : 'bg-zinc-900/60 border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30'
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

  // ── Default rendering path (neutral / epic / master) ──────────────────────
  return (
    <motion.article
      ref={tilt.ref as React.RefObject<HTMLElement>}
      className={cn('clip rounded-xl overflow-visible group cursor-pointer transition-all duration-300', tierClass)}
      style={{ rotateX: tilt.style.rotateX, rotateY: tilt.style.rotateY, scale: tilt.style.scale, transformPerspective: 800 }}
      onMouseMove={tilt.handlers.onMouseMove}
      onMouseEnter={() => { tilt.handlers.onMouseEnter(); handleMouseEnter() }}
      onMouseLeave={() => { tilt.handlers.onMouseLeave(); handleMouseLeave() }}
      onClick={handleCardClick}
    >
      {/* Thumbnail */}
      <div className="thumb aspect-video relative overflow-hidden rounded-t-xl bg-gradient-to-br from-slate-900 to-slate-800">

        {/* Video preview on hover */}
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

        {/* Thumbnail image or avatar fallback */}
        {clip.thumbnail_url && !imgError ? (
          <Image
            src={clip.thumbnail_url}
            alt={clip.title ?? 'Clip de stream'}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className={cn(
              'object-cover transition-all duration-500',
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

        {/* Score — wolf icon + big number — only for master tier on thumbnail */}
        {score !== null && isMaster && (
          <span className={`rank-score${isSixSeven ? ' score-six-seven' : ''}`}>
            <svg viewBox="0 0 149 183" width="16" height="20" className="inline-block -mt-0.5 mr-0.5" style={{ color: '#FFE066', filter: 'drop-shadow(0 0 4px rgba(250, 204, 21, 0.4))' }}>
              <path fill="currentColor" fillRule="evenodd" d="M 16.0 5.0 L 16.0 46.0 L 21.0 63.0 L 27.0 59.0 L 24.0 27.0 L 41.0 53.0 L 35.0 53.0 L 36.0 69.0 L 28.0 63.0 L 8.0 80.0 L 17.0 85.0 L 4.0 103.0 L 14.0 102.0 L 14.0 112.0 L 31.0 111.0 L 28.0 101.0 L 40.0 111.0 L 41.0 106.0 L 50.0 112.0 L 49.0 125.0 L 62.0 149.0 L 63.0 142.0 L 71.0 138.0 L 62.0 126.0 L 64.0 122.0 L 85.0 123.0 L 77.0 137.0 L 84.0 141.0 L 86.0 149.0 L 98.0 127.0 L 96.0 111.0 L 106.0 106.0 L 108.0 110.0 L 119.0 101.0 L 116.0 111.0 L 134.0 112.0 L 132.0 103.0 L 144.0 103.0 L 130.0 85.0 L 139.0 80.0 L 119.0 63.0 L 111.0 69.0 L 113.0 53.0 L 106.0 53.0 L 123.0 27.0 L 120.0 59.0 L 126.0 64.0 L 131.0 44.0 L 130.0 4.0 L 88.0 41.0 L 59.0 41.0 Z" />
            </svg>
            {score}
          </span>
        )}

        {/* Master sparks */}
        {isMaster && <MasterSparks />}

        {/* Duration pill */}
        {!showVideo && clip.duration_seconds && (
          <span className="absolute bottom-2 left-2 z-[6] text-[10px] text-white/80 bg-black/60 px-1.5 py-0.5 rounded-md backdrop-blur-sm font-medium">
            {formatDuration(clip.duration_seconds)}
          </span>
        )}

        {/* V2: Hover overlay CTA */}
        {overlayCTA}

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
                <p className="text-xs font-semibold mt-1.5" style={{ color: verdictColor }}>
                  {verdict.text}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{'\u2191'} {verdict.reason}</p>
              </div>
              {score !== null && (
                <div className="epic-score-block">
                  <span className={`epic-score-num${isSixSeven ? ' score-six-seven' : ''}`}>{score}</span>
                </div>
              )}
            </div>
            <div className="epic-divider" />
            <div className="flex items-center gap-1.5">
              <button
                className="cta-viral flex-1 h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative z-10"
                onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
                disabled={remixing}
              >
                <CTAIconComponent icon={dynamicCTA.icon} />
                <span className="relative z-10">{remixing ? 'Creating...' : dynamicCTA.label}</span>
              </button>
              {onToggleSave && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSave(clip.id) }}
                  className={cn(
                    'h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center border transition-colors relative z-10',
                    isSaved ? 'bg-purple-500/20 border-purple-500/30 text-purple-400' : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-purple-500/30'
                  )}
                  title={isSaved ? 'Unsave' : 'Save'}
                >
                  <Bookmark className={cn('h-3.5 w-3.5', isSaved && 'fill-current')} />
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight line-clamp-2 text-foreground">
                  {clip.title ?? clip.author_name ?? 'Stream clip'}
                </p>
                {clip.author_handle && (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate mt-1">
                    <span className="w-4 h-4 rounded-full bg-muted/60 shrink-0 flex items-center justify-center text-[8px] font-bold text-zinc-400">
                      {(clip.author_handle ?? 'U')[0].toUpperCase()}
                    </span>
                    <b className="text-zinc-300">@{clip.author_handle}</b>
                    {gameLabel && (
                      <span className="text-zinc-500">&middot; {gameLabel}</span>
                    )}
                  </div>
                )}
              </div>
              {score !== null && !isMaster && (
                <span className={`flex-shrink-0 text-xl font-bold ${isSixSeven ? 'score-six-seven' : 'text-zinc-400'}`}>{score}</span>
              )}
            </div>

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

            {/* Verdict + export count */}
            <div className="flex items-center gap-2 mt-1">
              <p className="text-[11px] font-medium" style={{ color: verdictColor }}>
                {verdict.text}
              </p>
              {(clip.export_count ?? 0) > 2 && score !== null && score >= 65 && (
                <span className="text-[10px] text-orange-400/70 whitespace-nowrap">🔥 exported {clip.export_count}x</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <p className="text-[10px] text-zinc-500">{'\u2191'} {verdict.reason}</p>
              {onShowDetail && (
                <button
                  onClick={(e) => { e.stopPropagation(); onShowDetail(clip) }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors whitespace-nowrap relative z-10"
                >
                  Why this clip?
                </button>
              )}
            </div>

            {/* CTA button + Quick Export + Bookmark */}
            <div className="flex items-center gap-1.5">
              <button
                className="cta-viral flex-1 h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all relative z-10"
                onClick={(e) => { e.stopPropagation(); onRemix?.(clip) }}
                disabled={remixing}
              >
                {isMaster ? <SkullIcon className="h-3.5 w-3.5" /> : <CTAIconComponent icon={dynamicCTA.icon} />}
                <span className="relative z-10">{remixing ? 'Creating...' : dynamicCTA.label}</span>
              </button>
              {onQuickExport && (
                <button
                  onClick={(e) => { e.stopPropagation(); onQuickExport(clip) }}
                  disabled={isExporting}
                  className="h-9 px-2.5 flex-shrink-0 rounded-lg flex items-center justify-center gap-1 border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors relative z-10 text-[10px] font-medium"
                  title="Quick Export"
                >
                  {isExporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                  <span className="hidden sm:inline">Quick</span>
                </button>
              )}
              {onToggleSave && (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleSave(clip.id) }}
                  className={cn(
                    'h-9 w-9 flex-shrink-0 rounded-lg flex items-center justify-center border transition-colors relative z-10',
                    isSaved ? 'bg-orange-500/20 border-orange-500/30 text-orange-400' : 'bg-card/60 border-border text-muted-foreground hover:text-foreground hover:border-orange-500/30'
                  )}
                  title={isSaved ? 'Unsave' : 'Save'}
                >
                  <Bookmark className={cn('h-3.5 w-3.5', isSaved && 'fill-current')} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </motion.article>
  )
})
