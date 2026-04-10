'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Loader2, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  CAPTION_STYLES, EMPHASIS_EFFECTS, EMPHASIS_COLORS, BROLL_OPTIONS, TAG_STYLES,
  type TrendingClipData, type EnhanceSettings,
} from '@/lib/enhance/scoring'

// ─── Score Badge Component ──────────────────────────────────────────────────

export function ScoreBadge({ score, isBest }: { score: number; isBest: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5',
      isBest
        ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
        : 'bg-muted/50 text-muted-foreground'
    )}>
      +{score}
    </span>
  )
}

// ─── Live Preview Component ─────────────────────────────────────────────────

export function LivePreview({
  clip,
  videoUrl,
  settings,
  showEnhancements,
  isRenderedVideo,
  renderedThumbnailUrl,
}: {
  clip: TrendingClipData
  videoUrl: string | null
  settings: EnhanceSettings
  showEnhancements: boolean
  isRenderedVideo: boolean
  renderedThumbnailUrl: string | null
}) {
  const broll = BROLL_OPTIONS.find((b) => b.id === settings.brollVideo)
  const captionStyle = CAPTION_STYLES.find((s) => s.id === settings.captionStyle)
  const tagStyle = TAG_STYLES.find((t) => t.id === settings.tagStyle)
  const streamerName = clip.author_handle ? `@${clip.author_handle}` : clip.author_name ?? ''
  // Animation is now derived from the selected caption style (not a separate setting)
  const currentAnimation = captionStyle?.animation ?? 'highlight'

  // Detect important words (mirrors backend logic in subtitle-generator.js)
  const IMPORTANT_WORDS_SET = useMemo(() => new Set([
    'crazy', 'insane', 'omg', 'wtf', 'bruh', 'fire', 'goat', 'goated',
    'clutch', 'cracked', 'broken', 'destroyed', 'killed', 'dead',
    'impossible', 'legendary', 'epic', 'massive', 'unreal', 'sick', 'nuts',
    'wild', 'lit', 'god', 'godlike', 'demon', 'monster',
    'million', 'money', 'free', 'secret', 'hack', 'exposed', 'banned',
    'never', 'always', 'best', 'worst', 'first', 'last', 'only',
  ]), [])
  const isImportantWord = useCallback((word: string) => {
    const clean = word.replace(/[^a-zA-Z]/g, '')
    if (clean.length >= 3 && clean === clean.toUpperCase()) return true
    if (word.includes('!')) return true
    if (IMPORTANT_WORDS_SET.has(clean.toLowerCase())) return true
    return false
  }, [IMPORTANT_WORDS_SET])

  // Sample caption sequence — cycles word-by-word to mirror FFmpeg render behavior.
  // Each word is displayed active for ~400ms (matches typical Whisper timestamps),
  // then yields to the next word. The active word gets the STATIC peak-state transform
  // (scale/lift/halo) — no CSS loop animation — exactly like each PNG in the render.
  const allSampleWords = useMemo(() => ['This', 'is', 'CRAZY', 'bro', 'let\'s', 'go'], [])
  // Show only wordsPerLine words in the preview to reflect the setting
  const sampleWords = useMemo(() => allSampleWords.slice(0, Math.max(1, settings.wordsPerLine)), [allSampleWords, settings.wordsPerLine])
  const [activeWordIdx, setActiveWordIdx] = useState(0)
  const [typewriterLen, setTypewriterLen] = useState(0)

  useEffect(() => {
    // Main word-cycling clock (~400ms per word)
    const wordTimer = setInterval(() => {
      setActiveWordIdx((i) => (i + 1) % sampleWords.length)
      setTypewriterLen(0)
    }, 400)
    return () => clearInterval(wordTimer)
  }, [sampleWords.length])

  useEffect(() => {
    // Typewriter progression inside each active-word window
    if (currentAnimation !== 'typewriter') return
    const activeWord = sampleWords[activeWordIdx] ?? ''
    setTypewriterLen(0)
    const perChar = 400 / Math.max(1, activeWord.length + 1)
    const tick = setInterval(() => {
      setTypewriterLen((n) => Math.min(n + 1, activeWord.length))
    }, perChar)
    return () => clearInterval(tick)
  }, [activeWordIdx, currentAnimation, sampleWords])

  // ── Rendered video: show as-is, no CSS effects (everything is baked in) ──
  // Only show rendered video when NOT in enhanced preview mode (showEnhancements=false)
  // When user is tweaking options (showEnhancements=true), always show CSS preview so they can see changes
  const [renderedVideoReady, setRenderedVideoReady] = useState(false)
  if (isRenderedVideo && videoUrl && !showEnhancements) {
    return (
      <div
        className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl mx-auto transition-all duration-500"
        style={{ aspectRatio: '9/16', maxWidth: 280 }}
      >
        {/* Show thumbnail as poster while video loads */}
        {renderedThumbnailUrl && !renderedVideoReady && (
          <img
            src={renderedThumbnailUrl}
            alt="Rendered clip preview"
            className="absolute inset-0 w-full h-full object-contain z-[1]"
          />
        )}
        {/* Loading spinner overlay */}
        {!renderedVideoReady && (
          <div className="absolute inset-0 flex items-center justify-center z-[2]">
            <div className="bg-black/60 rounded-full p-3">
              <Loader2 className="h-6 w-6 text-white animate-spin" />
            </div>
          </div>
        )}
        <video
          key={videoUrl}
          src={videoUrl}
          className={cn('w-full h-full object-contain', !renderedVideoReady && 'opacity-0')}
          autoPlay loop muted playsInline
          poster={renderedThumbnailUrl || undefined}
          onCanPlay={() => setRenderedVideoReady(true)}
        />
      </div>
    )
  }

  return (
    <>
    <style>{`
      @keyframes kenburns {
        0% { transform: scale(1) translate(0, 0); }
        100% { transform: scale(1.08) translate(-2%, -1%); }
      }
      @keyframes glow {
        0%, 100% { box-shadow: 0 0 15px rgba(249, 115, 22, 0.3); }
        50% { box-shadow: 0 0 25px rgba(249, 115, 22, 0.5), 0 0 50px rgba(249, 115, 22, 0.15); }
      }
      @keyframes smartZoomMicro {
        0% { transform: scale(var(--sz-from)); }
        100% { transform: scale(var(--sz-to)); }
      }
      @keyframes smartZoomDynamic {
        0% { transform: scale(var(--sz-from)); }
        15% { transform: scale(var(--sz-to)); }
        25% { transform: scale(var(--sz-from)); }
        50% { transform: scale(var(--sz-from)); }
        65% { transform: scale(var(--sz-to)); }
        75% { transform: scale(var(--sz-from)); }
        100% { transform: scale(var(--sz-from)); }
      }
      @keyframes smartZoomFollow {
        0%   { transform: scale(var(--sz-to)) translate(0%, 0%); }
        20%  { transform: scale(var(--sz-to)) translate(-0.8%, 0.3%); }
        40%  { transform: scale(var(--sz-to)) translate(0.5%, -0.4%); }
        60%  { transform: scale(var(--sz-to)) translate(1%, 0.2%); }
        80%  { transform: scale(var(--sz-to)) translate(-0.3%, -0.2%); }
        100% { transform: scale(var(--sz-to)) translate(0%, 0%); }
      }
    `}</style>
    <div
      className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl mx-auto transition-all duration-500"
      style={{ aspectRatio: '9/16', maxWidth: 280 }}
    >
      {/* Top: Clip video or thumbnail */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden transition-all duration-500"
        style={{ height: showEnhancements && settings.splitScreenEnabled ? `${settings.splitRatio}%` : '100%' }}
      >
        {clip.thumbnail_url || videoUrl ? (
          <>
            {/* Blurred background fill — matches FFmpeg gblur sigma=40 + eq(brightness=-0.35, sat=1.25, contrast=1.1) */}
            {!(showEnhancements && settings.splitScreenEnabled) && (
              videoUrl ? (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  className="absolute inset-0 w-full h-full object-cover scale-110"
                  style={{ filter: 'blur(12px) brightness(0.65) saturate(1.25) contrast(1.1)' }}
                  aria-hidden="true"
                  autoPlay loop muted playsInline
                />
              ) : (
                <img
                  src={clip.thumbnail_url!}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover scale-110"
                  style={{ filter: 'blur(12px) brightness(0.65) saturate(1.25) contrast(1.1)' }}
                  aria-hidden="true"
                />
              )
            )}
            {/* Main video layer — zoom makes the element LARGER than container with object-contain */}
            {/* Parent overflow-hidden clips the excess. Video stays landscape, just bigger. */}
            {/* Contenir: 100%, Remplir: 115%, Immersif: 135% */}
            {(() => {
              const isSplit = showEnhancements && settings.splitScreenEnabled
              // Zoom: element bigger than container, object-contain keeps video landscape
              // 115% = subtle zoom, video ~15% bigger, still lots of blur
              // 135% = noticeable zoom, video ~35% bigger, less blur
              const sizePct = showEnhancements && settings.videoZoom !== 'contain'
                ? (settings.videoZoom === 'immersive' ? 135 : 115)
                : 100
              const baseZoom = sizePct / 100
              const hasSmartZoom = showEnhancements && settings.smartZoomEnabled
              const objectFit = isSplit ? 'object-cover' : 'object-contain'
              const isZoomed = sizePct > 100
              const needsAbsolute = isZoomed || hasSmartZoom

              // Build style: cadrage (static scale) + optional smart zoom (animated scale)
              // Smart zoom keyframes use --sz-from and --sz-to CSS vars so they
              // combine properly with the cadrage level.
              let zoomStyle: React.CSSProperties = {}
              if (needsAbsolute) {
                const smartZoomExtra = 1.05 // smart zoom adds 5% on top of cadrage
                zoomStyle = {
                  position: 'absolute' as const,
                  width: '100%', height: '100%',
                  top: 0, left: 0,
                  transformOrigin: 'center center',
                }
                if (hasSmartZoom) {
                  // Animated: keyframes handle the transform via CSS vars
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ;(zoomStyle as any)['--sz-from'] = baseZoom
                  // Follow mode zooms in 20% (matching FFmpeg 1.2x) for pan room
                  const followZoom = settings.smartZoomMode === 'follow' ? 1.20 : smartZoomExtra
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ;(zoomStyle as any)['--sz-to'] = baseZoom * followZoom
                  zoomStyle.animation = settings.smartZoomMode === 'follow'
                    ? 'smartZoomFollow 8s ease-in-out infinite'
                    : settings.smartZoomMode === 'dynamic'
                    ? 'smartZoomDynamic 4s ease-in-out infinite'
                    : 'smartZoomMicro 5s ease-in-out forwards'
                } else {
                  // Static cadrage only
                  zoomStyle.transform = `scale(${baseZoom})`
                }
              }
              const styleOrUndefined = Object.keys(zoomStyle).length ? zoomStyle : undefined
              return videoUrl ? (
                <video
                  key={videoUrl}
                  src={videoUrl}
                  className={cn(
                    'z-[1] transition-all duration-500',
                    objectFit,
                    !needsAbsolute && 'relative w-full h-full',
                  )}
                  style={styleOrUndefined}
                  autoPlay loop muted playsInline
                />
              ) : (
                <img
                  src={clip.thumbnail_url!}
                  alt={clip.title ?? 'Clip'}
                  className={cn(
                    'z-[1] transition-all duration-500',
                    objectFit,
                    !needsAbsolute && 'relative w-full h-full',
                  )}
                  style={styleOrUndefined}
                />
              )
            })()}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <Play className="h-10 w-10 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none z-10" />

        {/* Platform badge */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <Badge variant="outline" className="text-[10px] bg-black/50 backdrop-blur-sm border-white/20 text-white">
            {clip.platform === 'twitch' ? 'Twitch' : clip.platform}
          </Badge>
        </div>
      </div>

      {/* ── Hook text overlay ── */}
      {showEnhancements && settings.hookEnabled && settings.hookTextEnabled && settings.hookText && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none animate-in fade-in zoom-in-95 duration-300 w-full px-2"
          style={{ top: `${settings.hookTextPosition}%` }}
        >
          <div
            className="px-3 py-1.5 rounded-md text-center whitespace-nowrap overflow-hidden mx-auto w-fit"
            style={{
              background: 'rgba(0,0,0,0.75)',
              border: '2px solid #9146FF',
              boxShadow: '0 0 10px #9146FF88, 0 0 24px #9146FF44',
              maxWidth: '100%',
            }}
          >
            <span className="text-[10px] font-black text-white uppercase tracking-wide leading-none">
              {settings.hookText}
            </span>
          </div>
        </div>
      )}

      {/* ── Tag overlays ── */}
      {/* Streamer Tag — 3 viral styles */}
      {showEnhancements && tagStyle && tagStyle.id !== 'none' && streamerName && (
        <div
          className="absolute z-20 pointer-events-none flex justify-start px-3 origin-bottom-left"
          style={{
            bottom: showEnhancements && settings.splitScreenEnabled
              ? `calc(${100 - settings.splitRatio}% + 10px)` : '10px',
            left: 0,
            transform: `scale(${(settings.tagSize || 100) / 100})`,
          }}
        >
          {/* VIRAL GLOW — capsule noire, bordure violet néon, glow */}
          {tagStyle.id === 'viral-glow' && (
            <div
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 animate-in fade-in slide-in-from-left-2 duration-300"
              style={{
                background: 'rgba(0,0,0,0.75)',
                border: '1.5px solid #9146FF',
                boxShadow: '0 0 8px #9146FF88, 0 0 20px #9146FF44, 0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              <svg className="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="#9146FF">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
              </svg>
              <span className="text-[11px] font-bold text-white tracking-wide">{streamerName}</span>
            </div>
          )}

          {/* POP CREATOR — fond violet plein, outline blanc, pop effect */}
          {tagStyle.id === 'pop-creator' && (
            <div
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 animate-in zoom-in-95 duration-200"
              style={{
                background: '#9146FF',
                border: '1.5px solid rgba(255,255,255,0.3)',
                boxShadow: '0 2px 12px rgba(145,70,255,0.5), 0 1px 4px rgba(0,0,0,0.3)',
              }}
            >
              <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="white">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
              </svg>
              <span className="text-[11px] font-bold text-white tracking-wide">{streamerName}</span>
            </div>
          )}

          {/* MINIMAL PRO — noir clean, logo Twitch discret, ultra pro */}
          {tagStyle.id === 'minimal-pro' && (
            <div
              className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 animate-in fade-in duration-300"
              style={{
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <svg className="h-3 w-3 flex-shrink-0 opacity-60" viewBox="0 0 24 24" fill="#9146FF">
                <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
              </svg>
              <span className="text-[11px] font-medium text-white/85 tracking-wide">{streamerName}</span>
            </div>
          )}
        </div>
      )}

      {/* Karaoke subtitle preview — hidden when style is 'none' */}
      {showEnhancements && settings.captionsEnabled && settings.captionStyle !== 'none' && (
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 z-20 rounded-lg px-3 py-1.5 max-w-[85%] transition-all duration-500',
            currentAnimation === 'glow'
              ? 'bg-black/60 shadow-[0_0_20px_rgba(255,255,255,0.15)]'
              : 'bg-black/80 backdrop-blur-sm'
          )}
          style={{
            top: settings.splitScreenEnabled
              ? `${Math.min(settings.captionPosition, settings.splitRatio - 6)}%`
              : `${settings.captionPosition}%`,
          }}
        >
          {/* Word Pop mode: show ONLY the active word, large, with pop animation */}
          {/* Important words appear in RED + bigger; normal words use the style color */}
          {/* Emphasis effects add static visual distinction on important words */}
          {(() => {
            const isImp = isImportantWord(sampleWords[activeWordIdx] || '')
            const empColor = EMPHASIS_COLORS.find((c) => c.id === settings.emphasisColor)?.hex ?? '#EF4444'
            const hasEffect = settings.emphasisEffect !== 'none'
            if (currentAnimation === 'word-pop') return (
              <p className={cn(
                'font-black text-center uppercase tracking-wide',
                isImp && hasEffect ? 'text-xl' : cn('text-lg', captionStyle?.preview || 'text-white'),
              )}
                style={{
                  WebkitTextStroke: '1px black',
                  color: isImp && hasEffect ? empColor : undefined,
                  textShadow: isImp && hasEffect
                    ? `2px 2px 4px rgba(0,0,0,0.8), 0 0 12px ${empColor}66`
                      + (settings.emphasisEffect === 'glow' ? `, 0 0 16px ${empColor}AA, 0 0 32px ${empColor}66` : '')
                    : '2px 2px 4px rgba(0,0,0,0.8)',
                  animation: 'wordPopIn 0.2s ease-out',
                  transform: isImp && settings.emphasisEffect === 'scale' ? 'scale(1.35)'
                    : isImp && settings.emphasisEffect === 'bounce' ? 'translateY(-6px) scale(1.15)'
                    : undefined,
                }}
                key={activeWordIdx}
              >
                {sampleWords[activeWordIdx] || ''}
              </p>
            )
            return (
          <p className={cn('text-sm text-center', captionStyle?.preview)}>
            {sampleWords.map((word, i) => {
              const isActive = i === activeWordIdx
              const wordImp = isActive && isImportantWord(word)
              const eff = settings.emphasisEffect
              // Active-word transform — matches FFmpeg render exactly
              let activeTransform = ''
              if (isActive) {
                if (currentAnimation === 'pop') activeTransform = 'scale(1.85)'
                else if (currentAnimation === 'bounce') activeTransform = 'translateY(-45%) scale(1.3)'
              }
              // Emphasis effect overrides on important words
              if (wordImp && eff === 'scale') activeTransform = 'scale(1.5)'
              else if (wordImp && eff === 'bounce') activeTransform = 'translateY(-30%) scale(1.25)'
              // Glow: colored text-shadow halo on active word — uses empColor
              const glowFromStyle = isActive && currentAnimation === 'glow'
              const glowFromEmphasis = wordImp && eff === 'glow'
              const activeTextShadow = glowFromStyle
                ? `0 0 8px ${empColor}, 0 0 18px ${empColor}, 0 0 32px ${empColor}AA, 0 0 48px ${empColor}66`
                : glowFromEmphasis
                ? `0 0 8px ${empColor}, 0 0 18px ${empColor}, 0 0 32px ${empColor}AA`
                : undefined
              // Typewriter: reveal chars progressively on active word
              const displayText = isActive && currentAnimation === 'typewriter'
                ? word.slice(0, typewriterLen) + (typewriterLen < word.length ? '|' : '')
                : word
              return (
                <span key={i}>
                  <span
                    className={cn(
                      'inline-block px-0.5 rounded',
                      isActive ? captionStyle?.highlightClass : '',
                    )}
                    style={{
                      color: wordImp && hasEffect ? empColor : undefined,
                      transform: activeTransform || undefined,
                      transformOrigin: 'center bottom',
                      textShadow: activeTextShadow,
                    }}
                  >
                    {displayText}
                  </span>
                  {i < sampleWords.length - 1 ? ' ' : ''}
                </span>
              )
            })}
          </p>
            )
          })()}
        </div>
      )}

      {/* Split line */}
      {showEnhancements && settings.splitScreenEnabled && (
        <div
          className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent z-10 transition-all duration-500"
          style={{ top: `${settings.splitRatio}%` }}
        />
      )}

      {/* Bottom: B-roll */}
      {showEnhancements && settings.splitScreenEnabled && broll && (
        <div
          className={cn('absolute inset-x-0 bottom-0 overflow-hidden transition-all duration-500', `bg-gradient-to-br ${broll.color}`)}
          style={{ height: `${100 - settings.splitRatio}%` }}
        >
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)',
            backgroundSize: '22px 22px',
          }} />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Play className="h-5 w-5 text-white/40" />
            <span className="text-[10px] text-white/60 font-semibold">{broll.label}</span>
          </div>
        </div>
      )}

      {/* Format badge */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <span className="text-[9px] text-white/40 font-medium bg-black/30 rounded-full px-2 py-0.5">{settings.aspectRatio}</span>
      </div>
    </div>
    </>
  )
}
