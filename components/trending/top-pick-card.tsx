'use client'

import { useEffect, useRef, useState } from 'react'
import { Zap, CheckCircle2, Archive, Film } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { timeAgo } from '@/lib/trending/utils'
import { getClipInsight } from '@/types/trending'
import type { TrendingClip } from '@/types/trending'
import type { QuickExportState } from '@/components/trending/trending-card'

interface TopPickCardProps {
  clip: TrendingClip
  onEnhance: (clip: TrendingClip) => void
  onQuickExport?: (clip: TrendingClip) => void
  quickExportState?: QuickExportState | null
  /** True when the grid contains a clip with a higher score but older than 12h */
  hasHigherOlderClip?: boolean
  isBanked?: boolean
  isPublished?: boolean
  isRendered?: boolean
}

/* ── SVG defs (namespaced tp-* to avoid grid conflicts) ── */
const TopPickGemDefs = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }}>
    <defs>
      <linearGradient id="tp-gc1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFE9A8"/><stop offset="100%" stopColor="#DAA520"/></linearGradient>
      <linearGradient id="tp-gc2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="30%" stopColor="#FFFDE8"/><stop offset="100%" stopColor="#F5D478"/></linearGradient>
      <linearGradient id="tp-gc3" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFFFFF"/><stop offset="25%" stopColor="#FFF8E1"/><stop offset="100%" stopColor="#E8B850"/></linearGradient>
      <linearGradient id="tp-gt" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFF8E1"/><stop offset="40%" stopColor="#FFE9A8"/><stop offset="100%" stopColor="#FFD700"/></linearGradient>
      <linearGradient id="tp-gpl" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8B6914"/><stop offset="50%" stopColor="#B8860B"/><stop offset="100%" stopColor="#996515"/></linearGradient>
      <linearGradient id="tp-gpml" x1=".3" y1="0" x2=".7" y2="1"><stop offset="0%" stopColor="#DAA520"/><stop offset="50%" stopColor="#C9962E"/><stop offset="100%" stopColor="#A07818"/></linearGradient>
      <linearGradient id="tp-gpmr" x1=".7" y1="0" x2=".3" y2="1"><stop offset="0%" stopColor="#FFD700"/><stop offset="50%" stopColor="#E8B850"/><stop offset="100%" stopColor="#C9962E"/></linearGradient>
      <linearGradient id="tp-gpr" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFF0C0"/><stop offset="50%" stopColor="#F5D478"/><stop offset="100%" stopColor="#DAA520"/></linearGradient>
    </defs>
  </svg>
)

const TopPickGem = () => (
  <svg width={24} height={28} viewBox="0 0 110 140" fill="none">
    <path d="M10 42 L35 42 L55 10Z" fill="url(#tp-gc1)"/>
    <path d="M35 42 L55 10 L75 42Z" fill="url(#tp-gc2)"/>
    <path d="M75 42 L55 10 L100 42Z" fill="url(#tp-gc3)"/>
    <path d="M30 42 L40 32 L70 32 L80 42Z" fill="url(#tp-gt)" opacity=".6"/>
    <path d="M10 42 L35 42 L55 120Z" fill="url(#tp-gpl)"/>
    <path d="M35 42 L55 42 L55 120Z" fill="url(#tp-gpml)"/>
    <path d="M55 42 L75 42 L55 120Z" fill="url(#tp-gpmr)"/>
    <path d="M75 42 L100 42 L55 120Z" fill="url(#tp-gpr)"/>
    <path d="M32 42 L38 42 L55 80Z" fill="#FFFDE8" opacity=".35"/>
    <circle cx="42" cy="36" r="2" fill="#FFF" opacity=".8"/>
  </svg>
)

/* ── Faceted GoldCrown — built from triangular facets like the gems ── */
const GoldCrown = () => (
  <svg width={92} height={66} viewBox="0 0 74 52" fill="none"
    style={{ filter: 'drop-shadow(0 3px 12px rgba(218,165,32,.55))' }}
  >
    {/* Center prong — tallest, kite shape split into 2 facets */}
    <path d="M37 4 L44 20 L37 26Z" fill="url(#tp-gc2)" stroke="#8B6914" strokeWidth=".8"/>
    <path d="M37 4 L30 20 L37 26Z" fill="url(#tp-gpml)" stroke="#8B6914" strokeWidth=".8"/>
    {/* Left prong */}
    <path d="M16 12 L23 24 L16 28Z" fill="url(#tp-gc3)" stroke="#8B6914" strokeWidth=".8"/>
    <path d="M16 12 L9 24 L16 28Z" fill="url(#tp-gpl)" stroke="#8B6914" strokeWidth=".8"/>
    {/* Right prong */}
    <path d="M58 12 L65 24 L58 28Z" fill="url(#tp-gc2)" stroke="#8B6914" strokeWidth=".8"/>
    <path d="M58 12 L51 24 L58 28Z" fill="url(#tp-gpmr)" stroke="#8B6914" strokeWidth=".8"/>
    {/* Small left ear */}
    <path d="M5 18 L10 28 L5 30Z" fill="url(#tp-gc1)" stroke="#8B6914" strokeWidth=".6"/>
    <path d="M5 18 L2 28 L5 30Z" fill="url(#tp-gpl)" stroke="#8B6914" strokeWidth=".6"/>
    {/* Small right ear */}
    <path d="M69 18 L72 28 L69 30Z" fill="url(#tp-gc1)" stroke="#8B6914" strokeWidth=".6"/>
    <path d="M69 18 L64 28 L69 30Z" fill="url(#tp-gpr)" stroke="#8B6914" strokeWidth=".6"/>
    {/* Band — row of alternating triangular facets */}
    <path d="M6 34 L14 34 L10 42Z" fill="url(#tp-gpml)" stroke="#8B6914" strokeWidth=".5"/>
    <path d="M14 34 L22 34 L18 42Z" fill="url(#tp-gc2)" stroke="#8B6914" strokeWidth=".5"/>
    <path d="M22 34 L30 34 L26 42Z" fill="url(#tp-gpmr)" stroke="#8B6914" strokeWidth=".5"/>
    <path d="M30 34 L38 34 L34 42Z" fill="url(#tp-gc2)" stroke="#8B6914" strokeWidth=".5"/>
    <path d="M38 34 L46 34 L42 42Z" fill="url(#tp-gpml)" stroke="#8B6914" strokeWidth=".5"/>
    <path d="M46 34 L54 34 L50 42Z" fill="url(#tp-gc3)" stroke="#8B6914" strokeWidth=".5"/>
    <path d="M54 34 L62 34 L58 42Z" fill="url(#tp-gpmr)" stroke="#8B6914" strokeWidth=".5"/>
    <path d="M62 34 L68 34 L65 42Z" fill="url(#tp-gc2)" stroke="#8B6914" strokeWidth=".5"/>
    {/* Band fill behind facets */}
    <rect x="5" y="34" width="64" height="8" rx="2" fill="url(#tp-gt)" opacity=".3"/>
    {/* Jewels on band */}
    <circle cx="37" cy="38" r="3" fill="url(#tp-gc2)" stroke="#B8860B" strokeWidth=".8"/>
    <circle cx="20" cy="38" r="2" fill="url(#tp-gc2)" stroke="#B8860B" strokeWidth=".6"/>
    <circle cx="54" cy="38" r="2" fill="url(#tp-gc2)" stroke="#B8860B" strokeWidth=".6"/>
    {/* Tip highlights */}
    <circle cx="37" cy="4" r="1.5" fill="#FFF8E1"/>
    <circle cx="16" cy="12" r="1.2" fill="#FFF8E1" opacity=".8"/>
    <circle cx="58" cy="12" r="1.2" fill="#FFF8E1" opacity=".8"/>
  </svg>
)

/* ── Animated score with count-up (re-animates when value changes) ── */
function AnimatedScore({ value }: { value: number }) {
  const [display, setDisplay] = useState(0)
  const prevRef = useRef(0)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    prevRef.current = to
    if (from === to) return
    const duration = 800
    const start = performance.now()
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + eased * (to - from)))
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
  }, [value])

  return <span className="tp-score tp-score-sweep">{display}</span>
}

export function TopPickCard({ clip, onEnhance, onQuickExport, quickExportState, hasHigherOlderClip = false, isBanked = false, isPublished = false, isRendered = false }: TopPickCardProps) {
  const [showScoreTooltip, setShowScoreTooltip] = useState(false)
  const isExporting = quickExportState?.clipId === clip.id && quickExportState.status === 'rendering'
  const isExported = (quickExportState?.clipId === clip.id && quickExportState.status === 'done') || isBanked || isPublished || isRendered
  const score = Math.round(clip.velocity_score ?? 0)
  const insight = getClipInsight(clip)
  const age = timeAgo(clip.clip_created_at ?? clip.scraped_at)
  const niche = clip.niche ?? ''

  return (
    <>
      <TopPickGemDefs />

      {/* Label */}
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-zinc-500 mb-2">
        Top pick right now
      </p>

      <div
        className="tp-royal group/tp relative max-w-[680px] cursor-pointer overflow-visible mt-10 md:mt-10"
        onClick={() => onEnhance(clip)}
      >
        {/* Crown — centered, floating above the frame */}
        <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[72%] z-30 pointer-events-none tp-crown">
          <GoldCrown />
        </div>

        {/* Legendary frame layers */}
        <div className="leg-frame tp-frame-full relative z-10">
          <div className="leg-frame-inner-border tp-frame-full">
            <div className="leg-frame-inner-gold tp-frame-full">

              {/* 4 corner gems */}
              <div className="leg-gem tp-gem-tl"><TopPickGem /></div>
              <div className="leg-gem tp-gem-tr"><TopPickGem /></div>
              <div className="leg-gem tp-gem-bl"><TopPickGem /></div>
              <div className="leg-gem tp-gem-br"><TopPickGem /></div>

              {/* Card content */}
              <div
                className="relative flex flex-col sm:flex-row items-stretch gap-2 sm:gap-3 p-2.5 sm:p-4 tp-content"
                style={{ background: 'linear-gradient(180deg, rgba(15,23,42,.97), rgba(4,9,24,.95))' }}
              >
                {/* Thumbnail */}
                {clip.thumbnail_url && (
                  <div className="relative w-full sm:w-[150px] h-[120px] sm:h-[96px] shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clip.thumbnail_url}
                      alt={clip.title ?? ''}
                      className="w-full h-full rounded-lg object-cover"
                    />
                    {isPublished ? (
                      <span className="absolute bottom-1.5 right-1.5 z-[7] flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 backdrop-blur-sm pointer-events-none">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Posted
                      </span>
                    ) : isBanked ? (
                      <span className="absolute bottom-1.5 right-1.5 z-[7] flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 backdrop-blur-sm pointer-events-none">
                        <Archive className="h-2.5 w-2.5" />
                        In bank
                      </span>
                    ) : isRendered ? (
                      <span className="absolute bottom-1.5 right-1.5 z-[7] flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-white/10 text-white/60 backdrop-blur-sm pointer-events-none">
                        <Film className="h-2.5 w-2.5" />
                        Rendered
                      </span>
                    ) : null}
                  </div>
                )}

                {/* Center */}
                <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 sm:gap-1">
                  {/* Early-catch explanation badge — above title, always visible when relevant */}
                  {hasHigherOlderClip ? (
                    <span className="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ color: '#67E8F9', background: 'rgba(34,211,238,.10)', border: '1px solid rgba(34,211,238,.25)' }}
                    >
                      {'\uD83D\uDC8E'} EARLY — catch it before it peaks
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1.5 self-start px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-[0.14em]"
                      style={{
                        color: '#FDE68A',
                        background: 'rgba(245,158,11,.10)',
                        border: '1px solid rgba(245,158,11,.28)',
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Top Pick &middot; {clip.feed_category === 'early_gem' ? 'Early Gem' : 'Surging'}
                    </span>
                  )}

                  <p className="text-[14px] sm:text-[15.5px] font-extrabold text-white truncate leading-tight">
                    {clip.title || 'Untitled clip'}
                  </p>

                  <p className="text-[11px] text-zinc-400 truncate">
                    @{clip.author_handle ?? clip.author_name ?? 'unknown'}
                    {niche && ` \u00b7 ${niche}`}
                    {age && (
                      <span style={{ color: '#F59E0B', fontWeight: 700 }}>
                        {' \u00b7 '}{age} ago
                      </span>
                    )}
                  </p>

                  {/* Desktop insight line */}
                  <p className="hidden sm:block text-[11px] font-medium text-zinc-500">
                    <span style={{ color: '#F59E0B' }}>{insight?.icon ?? '\u26A1'}</span>{' '}
                    {insight?.text ?? 'High momentum \u00b7 detected before peak'}
                  </p>
                </div>

                {/* Right — score + trajectory + CTA */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 sm:gap-1.5 shrink-0">
                  {/* Score + trajectory badge */}
                  <div
                    className="relative flex flex-col items-center sm:items-end"
                    onMouseEnter={() => setShowScoreTooltip(true)}
                    onMouseLeave={() => setShowScoreTooltip(false)}
                    onClick={(e) => { e.stopPropagation(); setShowScoreTooltip(v => !v) }}
                  >
                    <AnimatedScore value={score} />
                    {/* Trajectory indicator */}
                    <span
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold animate-pulse"
                      style={{ color: '#4ADE80' }}
                    >
                      {'\u2197'} still climbing
                    </span>
                    {/* Score tooltip */}
                    {showScoreTooltip && (
                      <div
                        className="absolute top-full mt-1 right-0 z-50 w-52 px-3 py-2 rounded-lg text-[11px] leading-snug text-zinc-300 pointer-events-none"
                        style={{ background: 'rgba(15,23,42,.95)', border: '1px solid rgba(255,255,255,.12)', boxShadow: '0 8px 24px rgba(0,0,0,.5)' }}
                      >
                        Top Pick = best opportunity right now, not highest score. High scores below already peaked.
                      </div>
                    )}
                  </div>
                  {/* Desktop CTA */}
                  <div className="hidden sm:flex items-center gap-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); onEnhance(clip) }}
                      className="leg-cta tp-cta-compact"
                      style={{ borderTopRightRadius: onQuickExport ? 0 : undefined, borderBottomRightRadius: onQuickExport ? 0 : undefined }}
                    >
                      Steal this clip<span className="tp-cta-arrow">&nbsp;&rarr;</span>
                    </button>
                    {onQuickExport && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onQuickExport(clip) }}
                        disabled={isExporting}
                        className="h-[36px] px-2.5 flex items-center justify-center"
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
                  </div>
                </div>

                {/* Mobile CTA — full width below content */}
                <div className="sm:hidden flex items-center gap-0 w-full">
                  <button
                    onClick={(e) => { e.stopPropagation(); onEnhance(clip) }}
                    className="leg-cta tp-cta-compact"
                    style={{ flex: 1, borderTopRightRadius: onQuickExport ? 0 : undefined, borderBottomRightRadius: onQuickExport ? 0 : undefined }}
                  >
                    Steal this clip<span className="tp-cta-arrow">&nbsp;&rarr;</span>
                  </button>
                  {onQuickExport && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onQuickExport(clip) }}
                      disabled={isExporting}
                      className="h-[38px] px-3 flex items-center justify-center"
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
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
