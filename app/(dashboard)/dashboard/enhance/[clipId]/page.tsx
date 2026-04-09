/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Sparkles, Download,
  Type, Wand2, Eye, ExternalLink, Play,
  Monitor, Paintbrush, Zap, AtSign,
  Flame, Focus, X, Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useTrendingStore } from '@/stores/trending-store'
import { cn } from '@/lib/utils'
import { captureHookOverlayPNG } from '@/lib/capture-hook-overlay'
import { captureTagOverlayPNG } from '@/lib/capture-tag-overlay'
// ─── Types ──────────────────────────────────────────────────────────────────

interface TrendingClipData {
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
}

interface EnhanceSettings {
  captionsEnabled: boolean
  captionStyle: string
  emphasisEffect: string
  emphasisColor: string
  customImportantWords: string[]
  captionPosition: number // 0-100, vertical % from top
  wordsPerLine: number
  splitScreenEnabled: boolean
  brollVideo: string
  splitRatio: number
  videoZoom: 'contain' | 'fill' | 'immersive'
  tagStyle: string
  tagSize: number // 50-150, percentage scale
  aspectRatio: '9:16' | '1:1' | '16:9'
  smartZoomEnabled: boolean
  smartZoomMode: 'micro' | 'dynamic' | 'follow'
  hookEnabled: boolean
  hookTextEnabled: boolean   // show text overlay
  hookReorderEnabled: boolean // put peak moment first
  hookText: string
  hookStyle: 'choc' | 'curiosite' | 'suspense'
  hookTextPosition: number // 5-90, vertical % from top
  hookLength: number // 1-3 seconds
  hookReorder: { segments: { start: number; end: number; duration: number; label: string }[]; totalDuration: number; peakTime: number } | null
}

interface HookVariant {
  style: string
  label: string
  text: string
}

interface HookAnalysis {
  peak: { peakTime: number; peakScore: number; scores: number[]; windowSize: number }
  hooks: HookVariant[]
  reorder: { segments: { start: number; end: number; duration: number; label: string }[]; totalDuration: number; peakTime: number }
}

// ─── Scoring Constants ──────────────────────────────────────────────────────

const CAPTION_STYLES = [
  { id: 'hormozi', label: 'Hormozi', preview: 'text-white font-black uppercase', highlightClass: 'text-white bg-white/20', baseScore: 12, animation: 'word-pop', animLabel: 'Word Pop' },
  { id: 'mrbeast', label: 'MrBeast', preview: 'text-white font-black', highlightClass: 'text-red-500 bg-red-500/20', baseScore: 14, animation: 'highlight', animLabel: 'Highlight' },
  { id: 'aliabdaal', label: 'Ali Abdaal', preview: 'text-blue-300 font-semibold', highlightClass: 'text-blue-300 bg-blue-300/20', baseScore: 8, animation: 'typewriter', animLabel: 'Typewriter' },
  { id: 'neon', label: 'Neon', preview: 'text-green-400 font-bold', highlightClass: 'text-green-400 bg-green-400/20', baseScore: 10, animation: 'glow', animLabel: 'Glow' },
  { id: 'bold', label: 'Bold', preview: 'text-white font-black text-lg', highlightClass: 'text-white bg-white/20', baseScore: 11, animation: 'pop', animLabel: 'Pop' },
  { id: 'minimal', label: 'Minimal', preview: 'text-white/80 font-medium', highlightClass: 'text-white/80 bg-white/10', baseScore: 6, animation: 'highlight', animLabel: 'Highlight' },
  { id: 'none', label: 'Aucun', preview: 'text-muted-foreground line-through', highlightClass: '', baseScore: 0, animation: 'highlight', animLabel: '' },
]

const EMPHASIS_EFFECTS = [
  { id: 'none', label: 'Aucun', description: 'Pas d\'emphase', baseScore: 0 },
  { id: 'scale', label: 'Scale Up', description: 'Mot clé grossit', baseScore: 14 },
  { id: 'bounce', label: 'Bounce', description: 'Mot clé rebondit', baseScore: 10 },
  { id: 'glow', label: 'Glow', description: 'Mot clé brille', baseScore: 8 },
]

const EMPHASIS_COLORS = [
  { id: 'red', label: 'Rouge', tw: 'bg-red-500', hex: '#EF4444' },
  { id: 'yellow', label: 'Jaune', tw: 'bg-yellow-400', hex: '#FACC15' },
  { id: 'cyan', label: 'Cyan', tw: 'bg-cyan-400', hex: '#22D3EE' },
  { id: 'green', label: 'Vert', tw: 'bg-green-400', hex: '#4ADE80' },
  { id: 'orange', label: 'Orange', tw: 'bg-orange-500', hex: '#F97316' },
  { id: 'pink', label: 'Rose', tw: 'bg-pink-500', hex: '#EC4899' },
  { id: 'white', label: 'Blanc', tw: 'bg-white', hex: '#FFFFFF' },
]

const BROLL_OPTIONS = [
  { id: 'subway-surfers', label: 'Subway Surfers', color: 'from-emerald-500 to-teal-500', baseScore: 14 },
  { id: 'minecraft-parkour', label: 'Minecraft Parkour', color: 'from-green-600 to-lime-500', baseScore: 12 },
  { id: 'sand-cutting', label: 'Sand Cutting', color: 'from-amber-500 to-orange-500', baseScore: 10 },
  { id: 'soap-cutting', label: 'Soap Cutting', color: 'from-pink-500 to-rose-500', baseScore: 9 },
  { id: 'slime-satisfying', label: 'Slime', color: 'from-purple-500 to-violet-500', baseScore: 8 },
  { id: 'none', label: 'Aucun', color: 'from-slate-700 to-slate-800', baseScore: 0 },
]

const TAG_STYLES = [
  { id: 'viral-glow', label: 'Viral Glow', description: 'Capsule noire + bordure violet néon + glow', icon: '🔥', baseScore: 14, position: 'bottom-left' as const },
  { id: 'pop-creator', label: 'Pop Creator', description: 'Fond violet plein, outline blanc, effet pop', icon: '⚡', baseScore: 12, position: 'bottom-left' as const },
  { id: 'minimal-pro', label: 'Minimal Pro', description: 'Clean noir, logo Twitch, ultra discret', icon: '🧠', baseScore: 10, position: 'bottom-left' as const },
  { id: 'none', label: 'Aucun', description: 'Pas de tag visible', icon: '🚫', baseScore: 0, position: 'none' as const },
]

function formatCount(n: number | null): string {
  if (n === null) return '--'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ─── Scoring Engine ─────────────────────────────────────────────────────────

interface ScoredOption {
  id: string
  score: number
  isBest: boolean
}

function computeScores(clip: TrendingClipData) {
  const velocity = clip.velocity_score ?? 50
  const views = clip.view_count ?? 0
  const niche = clip.niche?.toLowerCase() ?? 'irl'
  const isHighEnergy = velocity >= 70 || views >= 1_000_000
  const isMidEnergy = velocity >= 40 || views >= 100_000

  // Score caption styles based on clip characteristics
  const captionScores: ScoredOption[] = CAPTION_STYLES.map((s) => {
    let score = s.baseScore
    if (isHighEnergy && (s.id === 'mrbeast' || s.id === 'bold')) score += 6
    if (!isHighEnergy && (s.id === 'hormozi' || s.id === 'aliabdaal')) score += 4
    if (niche === 'irl' && s.id === 'hormozi') score += 5
    if (niche === 'gaming' && s.id === 'mrbeast') score += 5
    if (isMidEnergy && s.id === 'neon') score += 3
    return { id: s.id, score, isBest: false }
  })
  const maxCaption = Math.max(...captionScores.map((s) => s.score))
  captionScores.forEach((s) => { s.isBest = s.score === maxCaption })

  // Score emphasis effects
  const emphasisScores: ScoredOption[] = EMPHASIS_EFFECTS.map((e) => {
    let score = e.baseScore
    if (isHighEnergy && (e.id === 'scale' || e.id === 'bounce')) score += 5
    if (!isHighEnergy && e.id === 'color') score += 4
    if (niche === 'gaming' && e.id === 'scale') score += 3
    if (niche === 'irl' && e.id === 'color') score += 3
    return { id: e.id, score, isBest: false }
  })
  const maxEmphasis = Math.max(...emphasisScores.map((s) => s.score))
  emphasisScores.forEach((s) => { s.isBest = s.score === maxEmphasis })

  // Score b-roll
  const brollScores: ScoredOption[] = BROLL_OPTIONS.map((b) => {
    let score = b.baseScore
    if (isHighEnergy && b.id === 'minecraft-parkour') score += 6
    if (niche === 'irl' && b.id === 'subway-surfers') score += 7
    if (!isHighEnergy && (b.id === 'sand-cutting' || b.id === 'soap-cutting')) score += 4
    if (isMidEnergy && b.id === 'subway-surfers') score += 3
    return { id: b.id, score, isBest: false }
  })
  const maxBroll = Math.max(...brollScores.map((s) => s.score))
  brollScores.forEach((s) => { s.isBest = s.score === maxBroll })

  // Score tag styles
  const tagScores: ScoredOption[] = TAG_STYLES.map((t) => {
    let score = t.baseScore
    if (t.id === 'viral-glow' && clip.author_handle) score += 5
    if (t.id === 'pop-creator') score += 2
    return { id: t.id, score, isBest: false }
  })
  const maxTag = Math.max(...tagScores.map((s) => s.score))
  tagScores.forEach((s) => { s.isBest = s.score === maxTag })

  // Normalize scores to /100 — weights: captions 35, emphasis 15, b-roll 30, tags 20
  const WEIGHTS = { caption: 35, emphasis: 15, broll: 30, tag: 20 }

  const normCaption = captionScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxCaption) * WEIGHTS.caption),
  }))
  const normEmphasis = emphasisScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxEmphasis) * WEIGHTS.emphasis),
  }))
  const normBroll = brollScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxBroll) * WEIGHTS.broll),
  }))
  const normTag = tagScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxTag) * WEIGHTS.tag),
  }))

  // Best combo
  const bestCaption = captionScores.find((s) => s.isBest)!.id
  const bestEmphasis = emphasisScores.find((s) => s.isBest)!.id
  const bestBroll = brollScores.find((s) => s.isBest)!.id
  const bestTag = tagScores.find((s) => s.isBest)!.id

  return {
    captionScores: normCaption,
    emphasisScores: normEmphasis,
    brollScores: normBroll,
    tagScores: normTag,
    best: { captionStyle: bestCaption, emphasisEffect: bestEmphasis, brollVideo: bestBroll, tagStyle: bestTag },
    totalBestScore: 100,
  }
}

function computeCurrentScore(
  settings: EnhanceSettings,
  scores: ReturnType<typeof computeScores>
) {
  const cs = scores.captionScores.find((s) => s.id === settings.captionStyle)?.score ?? 0
  const es = scores.emphasisScores.find((s) => s.id === settings.emphasisEffect)?.score ?? 0
  const bs = settings.splitScreenEnabled ? (scores.brollScores.find((s) => s.id === settings.brollVideo)?.score ?? 0) : 0
  const ts = scores.tagScores.find((s) => s.id === settings.tagStyle)?.score ?? 0
  return (settings.captionsEnabled ? cs + es : 0) + bs + ts
}

// ─── Score Label ────────────────────────────────────────────────────────────

function getScoreLabel(score: number): { text: string; color: string } {
  if (score >= 90) return { text: 'High chance to blow up', color: 'text-orange-400' }
  if (score >= 75) return { text: 'Very viral', color: 'text-green-400' }
  if (score >= 50) return { text: 'Good potential', color: 'text-blue-400' }
  if (score >= 30) return { text: 'Needs improvement', color: 'text-yellow-400' }
  return { text: 'Low viral score', color: 'text-muted-foreground' }
}

// ─── Score Badge Component ──────────────────────────────────────────────────

function ScoreBadge({ score, isBest }: { score: number; isBest: boolean }) {
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

function LivePreview({
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

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function EnhancePage() {
  const params = useParams()
  const router = useRouter()
  const clipId = params.clipId as string

  const [clip, setClip] = useState<TrendingClipData | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [renderMessage, setRenderMessage] = useState<string | null>(null)
  const [renderOriginalUrl, setRenderOriginalUrl] = useState<string | null>(null)
  const [renderDownloadUrl, setRenderDownloadUrl] = useState<string | null>(null)
  const [renderJobId, setRenderJobId] = useState<string | null>(null)
  const [isRenderedVideo, setIsRenderedVideo] = useState(false)
  const [renderedThumbnailUrl, setRenderedThumbnailUrl] = useState<string | null>(null)
  const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const [showEnhancements, setShowEnhancements] = useState(true)
  const [hookAnalysis, setHookAnalysis] = useState<HookAnalysis | null>(null)
  const [hookGenerating, setHookGenerating] = useState(false)
  const [hookError, setHookError] = useState<string | null>(null)
  const sectionRefs = {
    captions: useRef<HTMLDivElement>(null),
    splitscreen: useRef<HTMLDivElement>(null),
    tags: useRef<HTMLDivElement>(null),
    style: useRef<HTMLDivElement>(null),
  }

  const [settings, setSettings] = useState<EnhanceSettings>({
    captionsEnabled: false,
    captionStyle: 'none',
    emphasisEffect: 'none',
    emphasisColor: 'red',
    customImportantWords: [],
    captionPosition: 72,
    wordsPerLine: 4,
    splitScreenEnabled: false,
    brollVideo: 'none',
    splitRatio: 60,
    videoZoom: 'contain',
    tagStyle: 'none',
    tagSize: 100,
    aspectRatio: '9:16',
    smartZoomEnabled: false,
    smartZoomMode: 'micro',
    hookEnabled: false,
    hookTextEnabled: true,
    hookReorderEnabled: true,
    hookText: '',
    hookStyle: 'suspense',
    hookTextPosition: 15,
    hookLength: 1.5,
    hookReorder: null,
  })

  // Load clip data — try trending store first, then Supabase
  const storeClips = useTrendingStore((s) => s.clips)

  useEffect(() => {
    async function loadClip() {
      // 1. Try the trending store (works for seed data + already-fetched clips)
      const storeClip = storeClips.find((c) => c.id === clipId)
      if (storeClip) {
        const clipData: TrendingClipData = {
          id: storeClip.id,
          external_url: storeClip.external_url,
          platform: storeClip.platform,
          author_name: storeClip.author_name,
          author_handle: storeClip.author_handle,
          title: storeClip.title,
          description: storeClip.description,
          niche: storeClip.niche,
          view_count: storeClip.view_count,
          like_count: storeClip.like_count,
          velocity_score: storeClip.velocity_score,
          thumbnail_url: storeClip.thumbnail_url,
        }
        setClip(clipData)
        setLoading(false)
        return
      }

      // 2. Fallback to Supabase query
      try {
        const supabase = createClient()
        const { data, error: dbError } = await supabase
          .from('trending_clips')
          .select('*')
          .eq('id', clipId)
          .single()

        if (dbError) throw new Error(dbError.message)
        if (!data) throw new Error('Clip non trouvé')

        const clipData = data as TrendingClipData
        setClip(clipData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }

    loadClip()
  }, [clipId, storeClips])

  // Resolve direct MP4 URL for live preview (Twitch only)
  useEffect(() => {
    if (!clip || clip.platform !== 'twitch' || !clip.external_url) return
    // Extract slug from https://clips.twitch.tv/SLUG or https://www.twitch.tv/CHANNEL/clip/SLUG
    const m = clip.external_url.match(/clips\.twitch\.tv\/([A-Za-z0-9_-]+)|\/clip\/([A-Za-z0-9_-]+)/)
    const slug = m ? (m[1] || m[2]) : null
    if (!slug) return
    let cancelled = false
    fetch(`/api/clips/video-url?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (!cancelled && j?.video_url) setVideoUrl(j.video_url) })
      .catch(() => { /* silent — fallback to thumbnail */ })
    return () => { cancelled = true }
  }, [clip])

  const updateSetting = useCallback(<K extends keyof EnhanceSettings>(key: K, value: EnhanceSettings[K]) => {
    setSettings((s) => ({ ...s, [key]: value }))
  }, [])

  const scores = useMemo(() => {
    if (!clip) return null
    return computeScores(clip)
  }, [clip])

  const currentScore = useMemo(() => {
    if (!scores) return 0
    return computeCurrentScore(settings, scores)
  }, [settings, scores])

  // ── Polling for render job status ──
  const startPolling = useCallback((jobId: string) => {
    // Clear any existing poll
    if (pollRef.current) clearInterval(pollRef.current)

    setRenderJobId(jobId)
    setRenderDownloadUrl(null)

    let pollCount = 0
    const maxPolls = 60 // 60 × 3s = 3 minutes max

    pollRef.current = setInterval(async () => {
      pollCount++
      if (pollCount > maxPolls) {
        if (pollRef.current) clearInterval(pollRef.current)
        setRenderMessage('⚠️ Le rendu prend plus longtemps que prévu. Reviens vérifier plus tard.')
        setRendering(false)
        return
      }

      try {
        const res = await fetch(`/api/render/status?jobId=${jobId}`)
        const json = await res.json() as {
          data: { status: string; downloadUrl?: string | null; publicUrl?: string | null; thumbnailUrl?: string | null; errorMessage?: string | null } | null
          message: string
        }

        if (!json.data) return

        if (json.data.status === 'done' && json.data.downloadUrl) {
          if (pollRef.current) clearInterval(pollRef.current)
          setRenderDownloadUrl(json.data.downloadUrl)
          // Switch the live preview to show the RENDERED video (with subtitles baked in)
          // Save original URL so user can re-edit later
          if (json.data.publicUrl) {
            setOriginalVideoUrl(videoUrl)
            setVideoUrl(json.data.publicUrl)
            setIsRenderedVideo(true)
            if (json.data.thumbnailUrl) {
              setRenderedThumbnailUrl(json.data.thumbnailUrl)
            }
          }
          setRenderMessage('✅ Clip rendu avec sous-titres ! Regarde la preview ci-dessus.')
          setRendering(false)
        } else if (json.data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
          setRenderMessage(`❌ Erreur : ${json.data.errorMessage || 'Erreur inconnue'}`)
          setRendering(false)
        } else if (json.data.status === 'rendering') {
          setRenderMessage('⏳ Rendu en cours... ça peut prendre 30-60 secondes.')
        }
      } catch {
        // Silently retry on network errors
      }
    }, 3000) // Poll every 3 seconds
  }, [])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleRender = useCallback(async () => {
    if (!clip) return
    setRendering(true)
    setRenderMessage('⏳ Lancement du rendu...')
    setRenderDownloadUrl(null)
    setRenderOriginalUrl(null)
    // Revert to CSS preview mode (restore original video URL if we were showing rendered video)
    if (isRenderedVideo && originalVideoUrl) {
      setVideoUrl(originalVideoUrl)
    }
    setIsRenderedVideo(false)

    try {
      // Capture overlays as PNGs from browser (pixel-perfect match to CSS preview)
      setRenderMessage('📸 Capture des overlays...')

      let hookOverlayData: { png: string; capsuleW: number; capsuleH: number; positionPct: number } | null = null
      if (settings.hookEnabled && settings.hookTextEnabled && settings.hookText) {
        hookOverlayData = await captureHookOverlayPNG({
          text: settings.hookText,
          positionPct: settings.hookTextPosition,
          videoWidth: 720,
          videoHeight: 1280,
        })
        console.log('[handleRender] Hook capture:', hookOverlayData ? `OK ${hookOverlayData.capsuleW}x${hookOverlayData.capsuleH}` : 'FAILED')
      }

      let tagOverlayData: { png: string; w: number; h: number; anchorX: number; anchorY: number } | null = null
      const streamerName = clip.author_handle ? `@${clip.author_handle}` : (clip.author_name || null)
      if (settings.tagStyle && settings.tagStyle !== 'none' && streamerName) {
        tagOverlayData = await captureTagOverlayPNG({
          streamerName,
          style: settings.tagStyle as 'viral-glow' | 'pop-creator' | 'minimal-pro',
          tagSize: settings.tagSize || 100,
          videoWidth: 720,
          videoHeight: 1280,
          splitScreenEnabled: settings.splitScreenEnabled,
          splitRatio: settings.splitRatio,
        })
        console.log('[handleRender] Tag capture:', tagOverlayData ? `OK ${tagOverlayData.w}x${tagOverlayData.h}` : 'FAILED/skipped')
      }

      setRenderMessage('⏳ Lancement du rendu...')
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip_id: clip.id,
          source: 'trending',
          settings: {
            captions: {
              enabled: settings.captionsEnabled,
              style: settings.captionStyle,
              wordsPerLine: settings.wordsPerLine,
              animation: CAPTION_STYLES.find(s => s.id === settings.captionStyle)?.animation ?? 'highlight',
              emphasisEffect: settings.emphasisEffect,
              emphasisColor: settings.emphasisColor,
              customImportantWords: settings.customImportantWords,
              position: settings.captionPosition,
            },
            splitScreen: {
              enabled: settings.splitScreenEnabled,
              brollCategory: settings.brollVideo,
              ratio: settings.splitRatio,
              layout: 'top-bottom',
            },
            tag: {
              style: settings.tagStyle,
              size: settings.tagSize || 100,
              authorName: clip.author_name || null,
              authorHandle: clip.author_handle || null,
              overlayPng: tagOverlayData?.png || null,
              overlayAnchorX: tagOverlayData?.anchorX || null,
              overlayAnchorY: tagOverlayData?.anchorY || null,
            },
            format: {
              aspectRatio: settings.aspectRatio,
              videoZoom: settings.videoZoom,
            },
            smartZoom: {
              enabled: settings.smartZoomEnabled,
              mode: settings.smartZoomMode,
            },
            hook: (() => {
              console.log('[handleRender] Hook settings:', {
                enabled: settings.hookEnabled,
                textEnabled: settings.hookTextEnabled,
                reorderEnabled: settings.hookReorderEnabled,
                hasReorder: !!settings.hookReorder,
                segments: settings.hookReorder?.segments?.length || 0,
                segmentDetails: settings.hookReorder?.segments?.map(s => `${s.label}(${s.start}-${s.end}s)`) || [],
                totalDuration: settings.hookReorder?.totalDuration || 0,
                hookText: settings.hookText?.substring(0, 30) || '(empty)',
              })
              return {
              enabled: settings.hookEnabled,
              textEnabled: settings.hookTextEnabled,
              reorderEnabled: settings.hookReorderEnabled,
              text: settings.hookText,
              style: settings.hookStyle,
              textPosition: settings.hookTextPosition,
              length: settings.hookLength,
              reorder: settings.hookReorder,
              overlayPng: hookOverlayData?.png || null,
              overlayCapsuleW: hookOverlayData?.capsuleW || null,
              overlayCapsuleH: hookOverlayData?.capsuleH || null,
            }})(),
          },
        }),
      })
      const data = await res.json() as {
        data: { clip_id: string; jobId?: string; rendered: boolean; vpsReady?: boolean; originalUrl?: string } | null
        error: string | null
        message: string
      }

      if (!res.ok || !data.data) {
        setRenderMessage(data.message ?? 'Erreur lors du rendu')
        setRendering(false)
      } else if (data.data.vpsReady === false) {
        setRenderMessage(`⚠️ ${data.message}`)
        if (data.data.originalUrl) {
          setRenderOriginalUrl(data.data.originalUrl)
        }
        setRendering(false)
      } else if (data.data.jobId) {
        // Start polling for job completion
        setRenderMessage('⏳ Rendu en cours... ça peut prendre 30-60 secondes.')
        startPolling(data.data.jobId)
      } else {
        setRenderMessage('✅ Rendu lancé !')
        setRendering(false)
      }
    } catch {
      setRenderMessage('Erreur réseau')
      setRendering(false)
    }
  }, [clip, settings, startPolling])

  const [makeViralLoading, setMakeViralLoading] = useState(false)

  const applyBestCombo = useCallback(async () => {
    if (!clip) return

    // 1. Apply all optimal settings immediately
    setSettings((s) => ({
      ...s,
      // Sous-titres: Hormozi word-pop, scale up rouge, 1 mot/ligne, 60%
      captionsEnabled: true,
      captionStyle: 'hormozi',
      emphasisEffect: 'scale',
      emphasisColor: 'red',
      captionPosition: 60,
      wordsPerLine: 1,
      // Pas de split-screen, zoom remplir
      splitScreenEnabled: false,
      brollVideo: 'none',
      videoZoom: 'fill',
      // Tag Viral Glow 85%
      tagStyle: 'viral-glow',
      tagSize: 85,
      // Smart zoom dynamique
      smartZoomEnabled: true,
      smartZoomMode: 'dynamic',
      // Hook viral: suspense, texte + reorder, 15%, 1.5s
      hookEnabled: true,
      hookTextEnabled: true,
      hookReorderEnabled: true,
      hookStyle: 'suspense',
      hookTextPosition: 15,
      hookLength: 1.5,
    }))

    // 2. Generate hook in parallel (Claude API)
    setMakeViralLoading(true)
    setHookGenerating(true)
    setHookError(null)
    try {
      const res = await fetch('/api/render/hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: clip.description || '',
          title: clip.title || '',
          wordTimestamps: [],
          audioPeaks: [],
          duration: 30,
          streamerName: clip.author_name || clip.author_handle || '',
          niche: clip.niche || 'irl',
          hookLength: 1.5,
          maxContext: 8,
        }),
      })
      const json = await res.json()
      if (res.ok && !json.error && json.data) {
        setHookAnalysis(json.data)
        // Auto-select suspense hook + always store reorder data
        const suspenseHook = json.data.hooks.find((h: HookVariant) => h.style === 'suspense')
        const bestHook = suspenseHook || json.data.hooks[0]
        setSettings((s) => ({
          ...s,
          ...(bestHook ? {
            hookText: bestHook.text,
            hookStyle: bestHook.style as 'choc' | 'curiosite' | 'suspense',
          } : {}),
          hookReorder: json.data.reorder,
        }))
      }
    } catch {
      // Silent fail — hook text stays empty but everything else works
    }
    setHookGenerating(false)
    setMakeViralLoading(false)
  }, [clip])

  // ── Hook Generator ────────────────────────────────────────────────────
  const generateHook = useCallback(async () => {
    if (!clip) return
    setHookGenerating(true)
    setHookError(null)
    try {
      const res = await fetch('/api/render/hook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: clip.description || '',
          title: clip.title || '',
          wordTimestamps: [],
          audioPeaks: [],
          duration: 30,
          streamerName: clip.author_name || clip.author_handle || '',
          niche: clip.niche || 'irl',
          hookLength: settings.hookLength,
          maxContext: 8,
        }),
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        setHookError(json.message || json.error || 'Erreur lors de la génération')
        setHookGenerating(false)
        return
      }
      setHookAnalysis(json.data)
      // Always store reorder data (even if no matching hook text)
      const matchingHook = json.data.hooks.find((h: HookVariant) => h.style === settings.hookStyle)
      const bestHook = matchingHook || json.data.hooks?.[0]
      setSettings((s) => ({
        ...s,
        ...(bestHook ? { hookText: bestHook.text } : {}),
        hookReorder: json.data.reorder,
      }))
    } catch {
      setHookError('Erreur réseau')
    }
    setHookGenerating(false)
  }, [clip, settings.hookLength, settings.hookStyle])

  // ── Loading / Error ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground">Chargement du clip&hellip;</p>
      </div>
    )
  }

  if (error || !clip) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <p className="text-destructive font-medium">{error ?? 'Clip non trouvé'}</p>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Retour au feed
          </Button>
        </Link>
      </div>
    )
  }

  // ── Main layout ────────────────────────────────────────────────────────

  return (
    <div className="animate-in fade-in duration-500">
      {/* Back button + clip info header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-start gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mt-0.5">
              <ChevronLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Wand2 className="h-6 w-6 text-primary" />
              Enhance Clip
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {clip.title ?? 'Clip de stream'} &mdash; {clip.author_handle ? `@${clip.author_handle}` : clip.author_name}
            </p>
          </div>
        </div>
      </div>

      {/* Two-column layout: Sticky Preview | Scrollable Settings */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: Preview only — truly sticky, fits in viewport */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-3">
          {/* ── Before/After Preview Toggle ── */}
          <div className="flex gap-2">
            <Button
              variant={!showEnhancements ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowEnhancements(false)}
              className="flex-1 text-xs h-8"
            >
              Original
            </Button>
            <Button
              variant={showEnhancements ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowEnhancements(true)}
              className="flex-1 text-xs h-8"
            >
              Enhanced
            </Button>
          </div>

          {/* ── Preview ── */}
          <LivePreview clip={clip} videoUrl={showEnhancements && isRenderedVideo && originalVideoUrl ? originalVideoUrl : videoUrl} settings={settings} showEnhancements={showEnhancements} isRenderedVideo={isRenderedVideo} renderedThumbnailUrl={renderedThumbnailUrl} />

          {/* Generate button — orange, always visible with preview */}
          <Button
            className="w-full h-12 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-base gap-2 shadow-lg shadow-orange-500/25 rounded-xl"
            onClick={handleRender}
            disabled={rendering}
          >
            {rendering ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Rendu en cours&hellip;</>
            ) : (
              <><Zap className="h-5 w-5" /> Générer le clip</>
            )}
          </Button>

          {/* Render status messages */}
          {renderMessage && (
            <div className="text-center space-y-3">
              <p className={cn(
                'text-sm font-medium',
                renderMessage.includes('Erreur') || renderMessage.includes('❌') ? 'text-destructive' :
                renderMessage.includes('⚠️') ? 'text-amber-400' :
                renderMessage.includes('⏳') ? 'text-blue-400' : 'text-green-400'
              )}>
                {renderMessage}
              </p>
              {renderDownloadUrl && (
                <a
                  href={renderDownloadUrl}
                  download="viral-clip.mp4"
                  className="inline-flex items-center justify-center gap-2 w-full h-12 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-bold text-base shadow-lg shadow-green-500/20 transition-all animate-pulse"
                >
                  <Download className="h-5 w-5" />
                  Télécharger le clip (avec sous-titres)
                </a>
              )}
              {renderOriginalUrl && !renderDownloadUrl && (
                <a
                  href={renderOriginalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs text-blue-400 hover:text-blue-300 underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Télécharger le clip original
                </a>
              )}
            </div>
          )}
        </div>

        {/* Right: Actions + Settings — scrollable */}
        <div className="space-y-6">
          {/* ── Make it viral button ── */}
          <button
            onClick={applyBestCombo}
            disabled={makeViralLoading}
            className="group relative w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-[1px] shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 animate-[glow_3s_ease-in-out_infinite] disabled:opacity-80"
          >
            <div className="relative flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-4 py-3.5">
              {makeViralLoading ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Zap className="h-5 w-5 text-white drop-shadow-lg" />
              )}
              <div className="text-left">
                <span className="text-base font-black text-white tracking-tight block leading-tight">
                  {makeViralLoading ? 'Analyse en cours...' : 'Make it viral'}
                </span>
                <span className="text-[10px] font-medium text-white/70 block">
                  {makeViralLoading ? 'Hook IA + paramètres optimaux' : '1 click = viral clip'}
                </span>
              </div>
              <Sparkles className={cn('h-4 w-4 text-white/80 ml-auto', makeViralLoading ? 'animate-spin' : 'group-hover:animate-spin')} />
            </div>
          </button>

          {/* ── Settings ── */}
          <div className="opacity-90 hover:opacity-100 transition-opacity duration-300">

          {/* Blowup score bar */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-white/5 -mx-1 px-1 pb-3 pt-1 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Chance de blowup</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="relative w-full h-8 rounded-full bg-card/60 border border-white/10 overflow-hidden">
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out',
                  currentScore >= 75 ? 'bg-gradient-to-r from-orange-500 to-amber-400' :
                  currentScore >= 50 ? 'bg-gradient-to-r from-blue-500 to-cyan-400' :
                  currentScore >= 30 ? 'bg-gradient-to-r from-yellow-500 to-amber-400' :
                  'bg-gradient-to-r from-slate-500 to-slate-400'
                )}
                style={{ width: `${currentScore}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-sm font-black text-white drop-shadow-md">{currentScore} / 100</span>
              </div>
            </div>
          </div>

            <div className="space-y-6">

            {/* ─── Captions Section ─── */}
            <div ref={sectionRefs.captions} className="scroll-mt-32">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Type className="h-4 w-4 text-primary" />
                    Sous-titres karaoké
                  </CardTitle>
                </CardHeader>
                {scores && (
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Style</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {CAPTION_STYLES.map((style) => {
                          const scored = scores.captionScores.find((s) => s.id === style.id)!
                          return (
                            <button
                              key={style.id}
                              onClick={() => {
                                updateSetting('captionStyle', style.id)
                                updateSetting('captionsEnabled', style.id !== 'none')
                              }}
                              className={cn(
                                'relative rounded-xl border p-3 text-left transition-all',
                                settings.captionStyle === style.id
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                  : scored.isBest
                                  ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                                  : 'border-border hover:border-primary/40'
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={cn('text-xs block', style.preview, scored.isBest && 'drop-shadow-[0_0_6px_rgba(249,115,22,0.4)]')}>Aa</span>
                                <ScoreBadge score={scored.score} isBest={scored.isBest} />
                              </div>
                              <span className={cn('text-[10px] block', scored.isBest ? 'text-orange-400 font-bold' : 'text-muted-foreground')}>
                                {style.label}
                              </span>
                              {style.animLabel && (
                                <span className="text-[8px] block text-muted-foreground/60 mt-0.5">{style.animLabel}</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {settings.captionStyle !== 'none' && <>
                    {/* Animation intégrée au style — affichage info seulement */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30 border border-border/50">
                      <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Animation :</span>
                      <span className="text-xs font-semibold text-foreground">{CAPTION_STYLES.find(s => s.id === settings.captionStyle)?.animLabel || 'Highlight'}</span>
                    </div>

                    {/* Emphase mots clés */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Emphase mots clés</Label>
                      <p className="text-[10px] text-muted-foreground">Effet appliqué aux mots importants détectés</p>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {EMPHASIS_EFFECTS.map((effect) => {
                          const scored = scores.emphasisScores.find((s) => s.id === effect.id)!
                          return (
                            <button
                              key={effect.id}
                              onClick={() => updateSetting('emphasisEffect', effect.id)}
                              className={cn(
                                'relative rounded-xl border px-3 py-2.5 text-center transition-all',
                                settings.emphasisEffect === effect.id
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                  : scored.isBest
                                  ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                                  : 'border-border hover:border-primary/40'
                              )}
                            >
                              <span className={cn('text-[10px] font-medium block', scored.isBest ? 'text-orange-400 font-bold' : 'text-foreground')}>{effect.label}</span>
                              <ScoreBadge score={scored.score} isBest={scored.isBest} />
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Couleur d'emphase — toujours visible, grisé si aucun effet */}
                    <div className={cn('space-y-2 transition-opacity', settings.emphasisEffect === 'none' && 'opacity-40 pointer-events-none')}>
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Couleur d&apos;emphase</Label>
                      {settings.emphasisEffect === 'none' && (
                        <p className="text-[10px] text-muted-foreground">Sélectionne un effet ci-dessus pour choisir la couleur</p>
                      )}
                      <div className="flex gap-2">
                        {EMPHASIS_COLORS.map((c) => (
                          <button
                            key={c.id}
                            onClick={() => updateSetting('emphasisColor', c.id)}
                            className={cn(
                              'w-7 h-7 rounded-full transition-all',
                              c.tw,
                              settings.emphasisColor === c.id
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                                : 'opacity-60 hover:opacity-100 hover:scale-105'
                            )}
                            title={c.label}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Mots importants — auto-détectés + custom */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mots importants</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Mots en <span className="text-red-400 font-bold">rouge</span> dans les sous-titres. Auto-détectés (CAPS, mots viraux) + tes propres mots.
                      </p>

                      {/* Auto-detected words preview */}
                      <div className="flex flex-wrap gap-1.5">
                        <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mr-1 self-center">Auto</span>
                        {['CAPS', 'OMG', 'CRAZY', 'INSANE', 'WTF'].map((w) => (
                          <span key={w} className="inline-flex items-center px-2 py-0.5 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] font-bold text-red-400">
                            {w}
                          </span>
                        ))}
                        <span className="text-[9px] text-muted-foreground/40 self-center">+ mots viraux</span>
                      </div>

                      {/* Custom words */}
                      {settings.customImportantWords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mr-1 self-center">Custom</span>
                          {settings.customImportantWords.map((w) => (
                            <span key={w} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/15 border border-red-500/30 text-[10px] font-bold text-red-400">
                              {w}
                              <button
                                onClick={() => setSettings((s) => ({
                                  ...s,
                                  customImportantWords: s.customImportantWords.filter((cw) => cw !== w),
                                }))}
                                className="hover:text-red-300 transition-colors"
                              >
                                <X className="h-2.5 w-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Add custom word input */}
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault()
                          const input = (e.currentTarget.elements.namedItem('newWord') as HTMLInputElement)
                          const word = input.value.trim()
                          if (word && !settings.customImportantWords.includes(word.toLowerCase())) {
                            setSettings((s) => ({
                              ...s,
                              customImportantWords: [...s.customImportantWords, word.toLowerCase()],
                            }))
                            input.value = ''
                          }
                        }}
                      >
                        <input
                          name="newWord"
                          type="text"
                          placeholder="Ajouter un mot..."
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                        <Button type="submit" size="sm" variant="outline" className="h-7 px-2">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </form>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Position verticale</Label>
                        <span className="text-xs font-semibold text-foreground">{settings.captionPosition}%</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Haut</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={1}
                          value={settings.captionPosition}
                          onChange={(e) => updateSetting('captionPosition', Number(e.target.value))}
                          className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md"
                        />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">Bas</span>
                      </div>
                      <div className="flex justify-center gap-2">
                        {([
                          { label: 'Haut', value: 8 },
                          { label: 'Milieu', value: 42 },
                          { label: 'Bas', value: 72 },
                        ]).map((preset) => (
                          <button
                            key={preset.label}
                            onClick={() => updateSetting('captionPosition', preset.value)}
                            className={cn(
                              'rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-all',
                              Math.abs(settings.captionPosition - preset.value) <= 3
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border hover:border-primary/40 text-muted-foreground'
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Words per line slider */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mots par ligne</Label>
                        <span className="text-xs font-mono text-muted-foreground">{settings.wordsPerLine}</span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={8}
                        step={1}
                        value={settings.wordsPerLine}
                        onChange={(e) => updateSetting('wordsPerLine', Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground/60">
                        <span>1 (un mot)</span>
                        <span>8 (compact)</span>
                      </div>
                    </div>
                    </>}
                  </CardContent>
                )}
              </Card>
            </div>

            {/* ─── Split-Screen Section ─── */}
            <div ref={sectionRefs.splitscreen} className="scroll-mt-32">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Monitor className="h-4 w-4 text-primary" />
                    Split-Screen
                  </CardTitle>
                </CardHeader>
                {scores && (
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Vidéo B-roll</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {BROLL_OPTIONS.map((broll) => {
                          const scored = scores.brollScores.find((s) => s.id === broll.id)!
                          return (
                            <button
                              key={broll.id}
                              onClick={() => {
                                updateSetting('brollVideo', broll.id)
                                updateSetting('splitScreenEnabled', broll.id !== 'none')
                              }}
                              className={cn(
                                'relative rounded-xl border p-3 transition-all',
                                settings.brollVideo === broll.id
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                  : scored.isBest
                                  ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                                  : 'border-border hover:border-primary/40'
                              )}
                            >
                              <div className={`w-full h-8 rounded-lg bg-gradient-to-r ${broll.color} mb-1.5`} />
                              <div className="flex items-center justify-between">
                                <span className={cn('text-[10px]', scored.isBest ? 'text-orange-400 font-bold' : 'text-muted-foreground')}>{broll.label}</span>
                                <ScoreBadge score={scored.score} isBest={scored.isBest} />
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {settings.brollVideo !== 'none' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ratio stream / B-roll</Label>
                        <span className="text-sm font-semibold text-foreground">{settings.splitRatio}% / {100 - settings.splitRatio}%</span>
                      </div>
                      <Slider
                        value={[settings.splitRatio]}
                        onValueChange={([v]) => updateSetting('splitRatio', v)}
                        min={40}
                        max={80}
                        step={5}
                        className="accent-orange-500 [&::-webkit-slider-thumb]:bg-orange-500 [&::-webkit-slider-thumb]:border-orange-400 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-orange-500/30 [&::-moz-range-thumb]:bg-orange-500 [&::-moz-range-thumb]:border-orange-400 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 h-2 bg-orange-500/20"
                      />
                    </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cadrage vidéo</Label>
                      <p className="text-[10px] text-muted-foreground">Zoom sur la vidéo principale</p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { id: 'contain' as const, label: 'Contenir', desc: '100% visible' },
                          { id: 'fill' as const, label: 'Remplir', desc: 'Zoom subtil' },
                          { id: 'immersive' as const, label: 'Immersif', desc: 'Zoom moyen' },
                        ]).map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => updateSetting('videoZoom', opt.id)}
                            className={cn(
                              'relative rounded-xl border p-3 transition-all text-left',
                              settings.videoZoom === opt.id
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40'
                            )}
                          >
                            <span className="text-xs font-semibold block">{opt.label}</span>
                            <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>

            {/* ─── Tags Section ─── */}
            <div ref={sectionRefs.tags} className="scroll-mt-32">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AtSign className="h-4 w-4 text-primary" />
                    Tag du streamer
                  </CardTitle>
                </CardHeader>
                {scores && (
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Style du tag</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {TAG_STYLES.map((tag) => {
                          const scored = scores.tagScores.find((s) => s.id === tag.id)!
                          return (
                            <button
                              key={tag.id}
                              onClick={() => updateSetting('tagStyle', tag.id)}
                              className={cn(
                                'relative rounded-xl border p-3 text-left transition-all group',
                                settings.tagStyle === tag.id
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                  : scored.isBest
                                  ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                                  : 'border-border hover:border-primary/40'
                              )}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-base">{tag.icon}</span>
                                <span className={cn('text-xs font-semibold flex-1', scored.isBest ? 'text-orange-400' : 'text-foreground')}>{tag.label}</span>
                                <ScoreBadge score={scored.score} isBest={scored.isBest} />
                              </div>
                              <span className="text-[10px] text-muted-foreground pl-7">{tag.description}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Taille du tag — slider 50-150% */}
                    {settings.tagStyle !== 'none' && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Taille du tag</Label>
                          <span className="text-xs font-mono text-muted-foreground">{settings.tagSize || 100}%</span>
                        </div>
                        <input
                          type="range"
                          min={50}
                          max={150}
                          step={5}
                          value={settings.tagSize || 100}
                          onChange={(e) => updateSetting('tagSize', Number(e.target.value))}
                          className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>50%</span>
                          <span>100%</span>
                          <span>150%</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            </div>

            {/* ─── Style Section ─── */}
            <div ref={sectionRefs.style} className="scroll-mt-32">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Paintbrush className="h-4 w-4 text-primary" />
                    Format
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-2">
                    {(['9:16', '1:1', '16:9'] as const).map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => updateSetting('aspectRatio', ratio)}
                        className={cn(
                          'rounded-xl border p-3 text-center transition-all',
                          settings.aspectRatio === ratio
                            ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                            : 'border-border hover:border-primary/40'
                        )}
                      >
                        <span className="text-sm font-semibold text-foreground">{ratio}</span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          {ratio === '9:16' ? 'TikTok / Reels' : ratio === '1:1' ? 'Instagram' : 'YouTube'}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ─── Smart Zoom Section ─── */}
            <div className="scroll-mt-32">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Focus className="h-4 w-4 text-primary" />
                    Smart Zoom
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground bg-primary/10 text-primary px-2 py-0.5 rounded-full border border-primary/20">
                      Nouveau
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Master toggle */}
                  <button
                    onClick={() => updateSetting('smartZoomEnabled', !settings.smartZoomEnabled)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between',
                      settings.smartZoomEnabled
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border hover:border-primary/40'
                    )}
                  >
                    <div>
                      <span className="text-sm font-semibold text-foreground block">
                        {settings.smartZoomEnabled ? 'Activé' : 'Désactivé'}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Zoom dynamique pour plus de mouvement & rétention
                      </span>
                    </div>
                    <div className={cn(
                      'w-10 h-5 rounded-full relative transition-all',
                      settings.smartZoomEnabled ? 'bg-primary' : 'bg-border'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                        settings.smartZoomEnabled ? 'left-[22px]' : 'left-0.5'
                      )} />
                    </div>
                  </button>

                  {/* Mode selector */}
                  {settings.smartZoomEnabled && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mode</Label>
                      <div className="grid grid-cols-1 gap-2">
                        {([
                          {
                            id: 'micro' as const,
                            label: 'Micro zoom',
                            desc: 'Breathing zoom cinématique (1.05 → 1.21). Subtil et pro.',
                            badge: 'Safe',
                          },
                          {
                            id: 'dynamic' as const,
                            label: 'Dynamique',
                            desc: 'Punch zooms sur pics audio + cooldown 2.5s. Max impact.',
                            badge: 'New',
                          },
                          {
                            id: 'follow' as const,
                            label: 'Follow face',
                            desc: 'Suit le visage avec lissage cinématique. Détection auto + pan smooth.',
                            badge: 'New',
                          },
                        ]).map((mode) => (
                          <button
                            key={mode.id}
                            onClick={() => updateSetting('smartZoomMode', mode.id)}
                            className={cn(
                              'rounded-xl border p-3 text-left transition-all',
                              settings.smartZoomMode === mode.id
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40'
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold text-foreground flex-1">{mode.label}</span>
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                                {mode.badge}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{mode.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ─── Hook Viral Section ─── */}
            <div className="scroll-mt-32">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    Hook Viral
                    <span className="ml-auto text-[10px] font-normal text-muted-foreground bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full border border-orange-500/20">
                      Nouveau
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Master toggle */}
                  <button
                    onClick={() => updateSetting('hookEnabled', !settings.hookEnabled)}
                    className={cn(
                      'w-full rounded-xl border p-3 text-left transition-all flex items-center justify-between',
                      settings.hookEnabled
                        ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                        : 'border-border hover:border-orange-500/40'
                    )}
                  >
                    <div>
                      <span className="text-sm font-semibold text-foreground block">
                        {settings.hookEnabled ? 'Activé' : 'Désactivé'}
                      </span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        Gros moment en premier → contexte après. Loop parfait pour TikTok.
                      </span>
                    </div>
                    <div className={cn(
                      'w-10 h-5 rounded-full relative transition-all',
                      settings.hookEnabled ? 'bg-orange-500' : 'bg-border'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                        settings.hookEnabled ? 'left-[22px]' : 'left-0.5'
                      )} />
                    </div>
                  </button>

                  {/* Hook controls — only shown when enabled */}
                  {settings.hookEnabled && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-1">

                      {/* Sub-toggles: text overlay + reorder */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => updateSetting('hookTextEnabled', !settings.hookTextEnabled)}
                          className={cn(
                            'rounded-xl border p-2.5 text-center transition-all',
                            settings.hookTextEnabled
                              ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                              : 'border-border hover:border-orange-500/40'
                          )}
                        >
                          <Type className="h-4 w-4 mx-auto mb-1 text-orange-400" />
                          <span className="text-[10px] font-bold text-foreground block">Texte hook</span>
                          <span className="text-[8px] text-muted-foreground block">Overlay au début</span>
                        </button>
                        <button
                          onClick={() => {
                            const newVal = !settings.hookReorderEnabled
                            updateSetting('hookReorderEnabled', newVal)
                            // Auto-generate hook analysis if toggling ON with no reorder data
                            if (newVal && !settings.hookReorder) {
                              generateHook()
                            }
                          }}
                          className={cn(
                            'rounded-xl border p-2.5 text-center transition-all',
                            settings.hookReorderEnabled
                              ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                              : 'border-border hover:border-orange-500/40'
                          )}
                        >
                          <Zap className="h-4 w-4 mx-auto mb-1 text-orange-400" />
                          <span className="text-[10px] font-bold text-foreground block">Moment fort 1er</span>
                          <span className="text-[8px] text-muted-foreground block">Réordonne le clip</span>
                        </button>
                      </div>

                      {/* Hook text position slider */}
                      {settings.hookTextEnabled && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Position du texte</Label>
                            <span className="text-xs font-bold text-orange-400">{settings.hookTextPosition}%</span>
                          </div>
                          <Slider
                            value={[settings.hookTextPosition]}
                            onValueChange={([v]) => updateSetting('hookTextPosition', v)}
                            min={5}
                            max={85}
                            step={1}
                            className="w-full accent-orange-500 [&::-webkit-slider-thumb]:border-orange-500/50 [&::-moz-range-thumb]:border-orange-500/50"
                          />
                          <div className="flex justify-between text-[9px] text-muted-foreground">
                            <span>Haut</span>
                            <span>Centre</span>
                            <span>Bas</span>
                          </div>
                        </div>
                      )}

                      {/* Hook length slider */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Durée du hook</Label>
                          <span className="text-xs font-bold text-orange-400">{settings.hookLength}s</span>
                        </div>
                        <Slider
                          value={[settings.hookLength]}
                          onValueChange={([v]) => updateSetting('hookLength', v)}
                          min={1}
                          max={3}
                          step={0.5}
                          className="w-full accent-orange-500 [&::-webkit-slider-thumb]:border-orange-500/50 [&::-moz-range-thumb]:border-orange-500/50"
                        />
                        <div className="flex justify-between text-[9px] text-muted-foreground">
                          <span>1s</span>
                          <span>2s</span>
                          <span>3s</span>
                        </div>
                      </div>

                      {/* Generate button */}
                      <Button
                        onClick={generateHook}
                        disabled={hookGenerating}
                        className="w-full h-10 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm gap-2 rounded-xl"
                      >
                        {hookGenerating ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Analyse en cours&hellip;</>
                        ) : hookAnalysis ? (
                          <><Wand2 className="h-4 w-4" /> Regénérer les hooks</>
                        ) : (
                          <><Wand2 className="h-4 w-4" /> Détecter le moment viral</>
                        )}
                      </Button>

                      {hookError && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {hookError}
                        </p>
                      )}

                      {/* Hook analysis results */}
                      {hookAnalysis && (
                        <div className="space-y-3 animate-in fade-in slide-in-from-top-1">
                          {/* Peak info */}
                          <div className="rounded-lg bg-orange-500/5 border border-orange-500/20 p-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] uppercase tracking-wider text-orange-400 font-bold">Moment viral détecté</span>
                              <span className="text-xs font-mono font-bold text-orange-300">
                                {hookAnalysis.peak.peakTime.toFixed(1)}s
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all"
                                  style={{ width: `${Math.min(100, hookAnalysis.peak.peakScore * 5)}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-muted-foreground">
                                Score: {hookAnalysis.peak.peakScore}
                              </span>
                            </div>
                            {/* Reorder structure */}
                            <div className="mt-2 flex gap-1">
                              {hookAnalysis.reorder.segments.map((seg, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    'flex-1 rounded px-1.5 py-1 text-center',
                                    seg.label === 'hook' && 'bg-orange-500/20 border border-orange-500/30',
                                    seg.label === 'context' && 'bg-blue-500/10 border border-blue-500/20',
                                    seg.label === 'payoff' && 'bg-emerald-500/10 border border-emerald-500/20',
                                  )}
                                  style={{ flex: seg.duration }}
                                >
                                  <span className={cn(
                                    'text-[9px] font-bold block',
                                    seg.label === 'hook' && 'text-orange-400',
                                    seg.label === 'context' && 'text-blue-400',
                                    seg.label === 'payoff' && 'text-emerald-400',
                                  )}>
                                    {seg.label === 'hook' ? 'HOOK' : seg.label === 'context' ? 'CONTEXTE' : 'PAYOFF'}
                                  </span>
                                  <span className="text-[8px] text-muted-foreground block">{seg.duration.toFixed(1)}s</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Style selector */}
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Style du hook</Label>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { id: 'choc' as const, label: 'Choc', emoji: '💀', desc: 'Max impact' },
                              { id: 'curiosite' as const, label: 'Curiosité', emoji: '👀', desc: 'Tease la suite' },
                              { id: 'suspense' as const, label: 'Suspense', emoji: '⏳', desc: 'Wait for it' },
                            ]).map((style) => (
                              <button
                                key={style.id}
                                onClick={() => {
                                  updateSetting('hookStyle', style.id)
                                  // Auto-select matching hook text
                                  const match = hookAnalysis?.hooks.find((h) => h.style === style.id)
                                  if (match) updateSetting('hookText', match.text)
                                }}
                                className={cn(
                                  'rounded-xl border p-2.5 text-center transition-all',
                                  settings.hookStyle === style.id
                                    ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                                    : 'border-border hover:border-orange-500/40'
                                )}
                              >
                                <span className="text-lg block">{style.emoji}</span>
                                <span className="text-[10px] font-bold text-foreground block mt-1">{style.label}</span>
                                <span className="text-[8px] text-muted-foreground block">{style.desc}</span>
                              </button>
                            ))}
                          </div>

                          {/* Hook text variants */}
                          <Label className="text-xs uppercase tracking-wider text-muted-foreground">Texte du hook</Label>
                          <div className="space-y-2">
                            {hookAnalysis.hooks.map((hook, i) => (
                              <button
                                key={i}
                                onClick={() => {
                                  updateSetting('hookText', hook.text)
                                  updateSetting('hookStyle', hook.style as 'choc' | 'curiosite' | 'suspense')
                                }}
                                className={cn(
                                  'w-full rounded-xl border p-3 text-left transition-all',
                                  settings.hookText === hook.text
                                    ? 'border-orange-500 bg-orange-500/10 ring-1 ring-orange-500/30'
                                    : 'border-border hover:border-orange-500/40'
                                )}
                              >
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[9px] font-bold text-orange-400 uppercase">{hook.label}</span>
                                  {settings.hookText === hook.text && (
                                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300">
                                      Sélectionné
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-bold text-foreground">{hook.text}</span>
                              </button>
                            ))}
                          </div>

                          {/* Custom hook text input */}
                          <div className="space-y-1.5">
                            <Label className="text-[10px] text-muted-foreground">Ou écris ton propre hook :</Label>
                            <input
                              type="text"
                              value={settings.hookText}
                              onChange={(e) => updateSetting('hookText', e.target.value)}
                              placeholder="VOTRE HOOK PERSONNALISÉ..."
                              className="w-full rounded-lg border border-border bg-background/50 px-3 py-2 text-xs font-bold text-foreground placeholder:text-muted-foreground/50 focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 outline-none transition-all"
                              maxLength={60}
                            />
                            <span className="text-[9px] text-muted-foreground">{settings.hookText.length}/60</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
