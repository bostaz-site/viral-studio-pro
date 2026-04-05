/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Sparkles, Download,
  Type, Wand2, Eye, ExternalLink, Play,
  Monitor, Paintbrush, Zap, AtSign,
  Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { useTrendingStore } from '@/stores/trending-store'
import { cn } from '@/lib/utils'

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
  captionAnimation: string
  captionPosition: 'top' | 'middle' | 'bottom'
  wordsPerLine: number
  splitScreenEnabled: boolean
  brollVideo: string
  splitRatio: number
  tagStyle: string
  aspectRatio: '9:16' | '1:1' | '16:9'
}

// ─── Scoring Constants ──────────────────────────────────────────────────────

const CAPTION_STYLES = [
  { id: 'hormozi', label: 'Hormozi', preview: 'text-yellow-400 font-black uppercase', highlightClass: 'text-yellow-400 bg-yellow-400/20', baseScore: 12 },
  { id: 'mrbeast', label: 'MrBeast', preview: 'text-white font-black', highlightClass: 'text-red-500 bg-red-500/20', baseScore: 14 },
  { id: 'aliabdaal', label: 'Ali Abdaal', preview: 'text-blue-300 font-semibold', highlightClass: 'text-blue-300 bg-blue-300/20', baseScore: 8 },
  { id: 'neon', label: 'Neon', preview: 'text-green-400 font-bold', highlightClass: 'text-green-400 bg-green-400/20', baseScore: 10 },
  { id: 'bold', label: 'Bold', preview: 'text-white font-black text-lg', highlightClass: 'text-white bg-white/20', baseScore: 11 },
  { id: 'minimal', label: 'Minimal', preview: 'text-white/80 font-medium', highlightClass: 'text-white/80 bg-white/10', baseScore: 6 },
  { id: 'none', label: 'Aucun', preview: 'text-muted-foreground line-through', highlightClass: '', baseScore: 0 },
]

const CAPTION_ANIMATIONS = [
  { id: 'highlight', label: 'Highlight', baseScore: 10 },
  { id: 'pop', label: 'Pop', baseScore: 12 },
  { id: 'bounce', label: 'Bounce', baseScore: 9 },
  { id: 'typewriter', label: 'Typewriter', baseScore: 7 },
  { id: 'glow', label: 'Glow', baseScore: 8 },
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
  { id: 'badge-top', label: 'Badge coin', description: 'Badge arrondi en haut à droite', icon: '🏷️', baseScore: 10, position: 'top-right' as const },
  { id: 'watermark-center', label: 'Watermark', description: 'Semi-transparent au centre', icon: '💧', baseScore: 6, position: 'center' as const },
  { id: 'banner-bottom', label: 'Bannière', description: 'Bande colorée en bas', icon: 'discord', baseScore: 12, position: 'bottom' as const },
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

  // Score animations
  const animScores: ScoredOption[] = CAPTION_ANIMATIONS.map((a) => {
    let score = a.baseScore
    if (isHighEnergy && (a.id === 'pop' || a.id === 'bounce')) score += 5
    if (!isHighEnergy && a.id === 'highlight') score += 4
    if (niche === 'irl' && a.id === 'highlight') score += 3
    if (velocity < 30 && a.id === 'typewriter') score += 4
    return { id: a.id, score, isBest: false }
  })
  const maxAnim = Math.max(...animScores.map((s) => s.score))
  animScores.forEach((s) => { s.isBest = s.score === maxAnim })

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
    if (t.id === 'banner-bottom' && clip.author_handle) score += 5
    if (t.id === 'badge-top') score += 3
    return { id: t.id, score, isBest: false }
  })
  const maxTag = Math.max(...tagScores.map((s) => s.score))
  tagScores.forEach((s) => { s.isBest = s.score === maxTag })

  // Normalize scores to /100 — weights: captions 30, animation 20, b-roll 30, tags 20
  const WEIGHTS = { caption: 30, anim: 20, broll: 30, tag: 20 }

  const normCaption = captionScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxCaption) * WEIGHTS.caption),
  }))
  const normAnim = animScores.map((s) => ({
    ...s,
    score: Math.round((s.score / maxAnim) * WEIGHTS.anim),
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
  const bestAnim = animScores.find((s) => s.isBest)!.id
  const bestBroll = brollScores.find((s) => s.isBest)!.id
  const bestTag = tagScores.find((s) => s.isBest)!.id

  return {
    captionScores: normCaption,
    animScores: normAnim,
    brollScores: normBroll,
    tagScores: normTag,
    best: { captionStyle: bestCaption, captionAnimation: bestAnim, brollVideo: bestBroll, tagStyle: bestTag },
    totalBestScore: 100,
  }
}

function computeCurrentScore(
  settings: EnhanceSettings,
  scores: ReturnType<typeof computeScores>
) {
  const cs = scores.captionScores.find((s) => s.id === settings.captionStyle)?.score ?? 0
  const as2 = scores.animScores.find((s) => s.id === settings.captionAnimation)?.score ?? 0
  const bs = settings.splitScreenEnabled ? (scores.brollScores.find((s) => s.id === settings.brollVideo)?.score ?? 0) : 0
  const ts = scores.tagScores.find((s) => s.id === settings.tagStyle)?.score ?? 0
  return (settings.captionsEnabled ? cs + as2 : 0) + bs + ts
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
}: {
  clip: TrendingClipData
  videoUrl: string | null
  settings: EnhanceSettings
  showEnhancements: boolean
}) {
  const broll = BROLL_OPTIONS.find((b) => b.id === settings.brollVideo)
  const captionStyle = CAPTION_STYLES.find((s) => s.id === settings.captionStyle)
  const tagStyle = TAG_STYLES.find((t) => t.id === settings.tagStyle)
  const streamerName = clip.author_handle ? `@${clip.author_handle}` : clip.author_name ?? ''

  // Sample caption sequence — cycles word-by-word to mirror FFmpeg render behavior.
  // Each word is displayed active for ~400ms (matches typical Whisper timestamps),
  // then yields to the next word. The active word gets the STATIC peak-state transform
  // (scale/lift/halo) — no CSS loop animation — exactly like each PNG in the render.
  const sampleWords = ['This', 'is', 'CRAZY', 'bro', 'let\'s', 'go']
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
    if (settings.captionAnimation !== 'typewriter') return
    const activeWord = sampleWords[activeWordIdx] ?? ''
    setTypewriterLen(0)
    const perChar = 400 / Math.max(1, activeWord.length + 1)
    const tick = setInterval(() => {
      setTypewriterLen((n) => Math.min(n + 1, activeWord.length))
    }, perChar)
    return () => clearInterval(tick)
  }, [activeWordIdx, settings.captionAnimation, sampleWords])

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
      /* No keyframe loops — active-word styles are static snap transitions,
         matching the per-word PNG baking done by the FFmpeg render. */
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
            {/* Main layer — object-contain when no split-screen (blur bg), object-cover with split */}
            {videoUrl ? (
              <video
                src={videoUrl}
                className={cn(
                  'relative w-full h-full z-[1]',
                  showEnhancements && settings.splitScreenEnabled ? 'object-cover' : 'object-contain'
                )}
                autoPlay loop muted playsInline
              />
            ) : (
              <img
                src={clip.thumbnail_url!}
                alt={clip.title ?? 'Clip'}
                className={cn(
                  'relative w-full h-full animate-[kenburns_20s_ease-in-out_infinite_alternate] z-[1]',
                  showEnhancements && settings.splitScreenEnabled ? 'object-cover' : 'object-contain'
                )}
              />
            )}
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

      {/* ── Tag overlays ── */}
      {showEnhancements && tagStyle && tagStyle.id !== 'none' && streamerName && (
        <>
          {tagStyle.position === 'top-right' && (
            <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 transition-all duration-300 pointer-events-none">
              <span className="text-xs font-bold text-white">{streamerName}</span>
            </div>
          )}
          {tagStyle.position === 'center' && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <span className="text-2xl font-black text-white/15 rotate-[-20deg]">{streamerName}</span>
            </div>
          )}
          {tagStyle.position === 'bottom' && (
            <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 transition-all duration-300 pointer-events-none"
              style={{ bottom: showEnhancements && settings.splitScreenEnabled ? `${100 - settings.splitRatio}%` : '0' }}>
              <div className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-indigo-400" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.12-.094.246-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
                <span className="text-xs font-bold text-white">{streamerName}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Karaoke subtitle preview */}
      {showEnhancements && settings.captionsEnabled && (
        <div
          className={cn(
            'absolute left-1/2 -translate-x-1/2 z-20 rounded-lg px-3 py-1.5 max-w-[85%] transition-all duration-500',
            settings.captionAnimation === 'glow'
              ? 'bg-black/60 shadow-[0_0_20px_rgba(255,255,255,0.15)]'
              : 'bg-black/80 backdrop-blur-sm'
          )}
          style={{
            top: settings.captionPosition === 'top' ? '8%'
              : settings.captionPosition === 'middle' ? (settings.splitScreenEnabled ? `${settings.splitRatio / 2}%` : '42%')
              : settings.splitScreenEnabled ? `${settings.splitRatio - 10}%` : '72%',
          }}
        >
          <p className={cn('text-sm text-center', captionStyle?.preview)}>
            {sampleWords.map((word, i) => {
              const isActive = i === activeWordIdx
              // Active-word transform — matches FFmpeg render exactly
              let activeTransform = ''
              if (isActive) {
                if (settings.captionAnimation === 'pop') activeTransform = 'scale(1.85)'
                else if (settings.captionAnimation === 'bounce') activeTransform = 'translateY(-45%) scale(1.3)'
              }
              // Glow: colored text-shadow halo on active word — amplified for visibility
              const activeTextShadow = isActive && settings.captionAnimation === 'glow'
                ? '0 0 8px #fde047, 0 0 18px #fde047, 0 0 32px #facc15, 0 0 48px #eab308'
                : undefined
              // Typewriter: reveal chars progressively on active word
              const displayText = isActive && settings.captionAnimation === 'typewriter'
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
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const [showEnhancements, setShowEnhancements] = useState(true)
  const sectionRefs = {
    captions: useRef<HTMLDivElement>(null),
    splitscreen: useRef<HTMLDivElement>(null),
    tags: useRef<HTMLDivElement>(null),
    style: useRef<HTMLDivElement>(null),
  }

  const [settings, setSettings] = useState<EnhanceSettings>({
    captionsEnabled: true,
    captionStyle: 'hormozi',
    captionAnimation: 'highlight',
    captionPosition: 'bottom',
    wordsPerLine: 4,
    splitScreenEnabled: true,
    brollVideo: 'subway-surfers',
    splitRatio: 60,
    tagStyle: 'badge-top',
    aspectRatio: '9:16',
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

        // Auto-enable split-screen for long descriptions or low view counts
        const descriptionWordCount = clipData.description?.split(/\s+/).length ?? 0
        const shouldAutoEnableSplitScreen = descriptionWordCount > 20 || (clipData.view_count ?? 0) < 1000
        if (shouldAutoEnableSplitScreen) {
          setSettings((s) => ({ ...s, splitScreenEnabled: true }))
        }

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

        // Auto-enable split-screen for long descriptions or low view counts
        const descriptionWordCount = clipData.description?.split(/\s+/).length ?? 0
        const shouldAutoEnableSplitScreen = descriptionWordCount > 20 || (clipData.view_count ?? 0) < 1000
        if (shouldAutoEnableSplitScreen) {
          setSettings((s) => ({ ...s, splitScreenEnabled: true }))
        }
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
          data: { status: string; downloadUrl?: string | null; errorMessage?: string | null } | null
          message: string
        }

        if (!json.data) return

        if (json.data.status === 'done' && json.data.downloadUrl) {
          if (pollRef.current) clearInterval(pollRef.current)
          setRenderDownloadUrl(json.data.downloadUrl)
          setRenderMessage('✅ Clip prêt ! Clique pour télécharger.')
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

    try {
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
              animation: settings.captionAnimation,
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
              authorName: clip.author_name || null,
              authorHandle: clip.author_handle || null,
            },
            format: {
              aspectRatio: settings.aspectRatio,
            },
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

  const applyBestCombo = useCallback(() => {
    if (!scores) return
    setSettings((s) => ({
      ...s,
      captionStyle: scores.best.captionStyle,
      captionAnimation: scores.best.captionAnimation,
      brollVideo: scores.best.brollVideo,
      tagStyle: scores.best.tagStyle,
      splitScreenEnabled: true,
      captionsEnabled: true,
    }))
  }, [scores])

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
          <LivePreview clip={clip} videoUrl={videoUrl} settings={settings} showEnhancements={showEnhancements} />

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
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 w-full h-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white font-semibold text-sm shadow-lg shadow-green-500/20 transition-all"
                >
                  <Download className="h-4 w-4" />
                  Télécharger le clip
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
          {scores && (
            <button
              onClick={applyBestCombo}
              className="group relative w-full rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-[1px] shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 animate-[glow_3s_ease-in-out_infinite]"
            >
              <div className="relative flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 px-4 py-3.5">
                <Zap className="h-5 w-5 text-white drop-shadow-lg" />
                <div className="text-left">
                  <span className="text-base font-black text-white tracking-tight block leading-tight">Make it viral</span>
                  <span className="text-[10px] font-medium text-white/70 block">1 click = viral clip</span>
                </div>
                <Sparkles className="h-4 w-4 text-white/80 ml-auto group-hover:animate-spin" />
              </div>
            </button>
          )}

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
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {settings.captionStyle !== 'none' && <>
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Animation</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {CAPTION_ANIMATIONS.map((anim) => {
                          const scored = scores.animScores.find((s) => s.id === anim.id)!
                          return (
                            <button
                              key={anim.id}
                              onClick={() => updateSetting('captionAnimation', anim.id)}
                              className={cn(
                                'relative rounded-xl border px-3 py-2.5 text-center transition-all',
                                settings.captionAnimation === anim.id
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                  : scored.isBest
                                  ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                                  : 'border-border hover:border-primary/40'
                              )}
                            >
                              <span className={cn('text-[10px] font-medium block', scored.isBest ? 'text-orange-400 font-bold' : 'text-foreground')}>{anim.label}</span>
                              <ScoreBadge score={scored.score} isBest={scored.isBest} />
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Position</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {([['top', 'Haut'], ['middle', 'Milieu'], ['bottom', 'Bas']] as const).map(([pos, label]) => (
                          <button
                            key={pos}
                            onClick={() => updateSetting('captionPosition', pos)}
                            className={cn(
                              'rounded-xl border px-3 py-2 text-center text-xs font-medium transition-all',
                              settings.captionPosition === pos
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30 text-foreground'
                                : 'border-border hover:border-primary/40 text-muted-foreground'
                            )}
                          >
                            {label}
                          </button>
                        ))}
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
                                <span className="text-base">{tag.icon === 'discord' ? '📢' : tag.icon}</span>
                                <span className={cn('text-xs font-semibold flex-1', scored.isBest ? 'text-orange-400' : 'text-foreground')}>{tag.label}</span>
                                <ScoreBadge score={scored.score} isBest={scored.isBest} />
                              </div>
                              <span className="text-[10px] text-muted-foreground pl-7">{tag.description}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
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
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}
