/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Sparkles, Download,
  Type, Wand2, Eye, ExternalLink, Play,
  Monitor, Paintbrush, Zap, AtSign, Settings2,
  MessageSquare, Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
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
  duration_seconds: number | null
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
  autoCredit: boolean
  aspectRatio: '9:16' | '1:1' | '16:9'
  hookText: string
  hookEnabled: boolean
  platform: 'tiktok' | 'reels' | 'shorts'
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
  { id: 'banner-bottom', label: 'Bannière', description: 'Bande Twitch en bas', icon: 'twitch', baseScore: 12, position: 'bottom' as const },
  { id: 'none', label: 'Aucun', description: 'Pas de tag visible', icon: '🚫', baseScore: 0, position: 'none' as const },
]

const HOOK_PRESETS = [
  { id: 'wait', text: 'WAIT FOR IT...', emoji: '😳', score: 18 },
  { id: 'crazy', text: 'THIS IS CRAZY', emoji: '🤯', score: 16 },
  { id: 'bro', text: 'BRO DID NOT EXPECT THIS', emoji: '💀', score: 15 },
  { id: 'watch', text: 'WATCH TILL THE END', emoji: '👀', score: 14 },
  { id: 'no-way', text: 'NO WAY HE DID THIS', emoji: '😱', score: 17 },
  { id: 'none', text: 'Aucun hook', emoji: '—', score: 0 },
]

const PLATFORM_PRESETS: Record<string, { label: string; icon: string; captionStyle: string; animation: string; aspectRatio: '9:16' | '1:1' | '16:9' }> = {
  tiktok: { label: 'TikTok', icon: '🎵', captionStyle: 'hormozi', animation: 'pop', aspectRatio: '9:16' },
  reels: { label: 'Reels', icon: '📸', captionStyle: 'mrbeast', animation: 'highlight', aspectRatio: '9:16' },
  shorts: { label: 'Shorts', icon: '▶️', captionStyle: 'bold', animation: 'bounce', aspectRatio: '9:16' },
}

function formatCount(n: number | null): string {
  if (n === null) return '--'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function getScoreMessage(score: number): { text: string; color: string } {
  if (score >= 85) return { text: 'Maximum viral', color: 'text-green-400' }
  if (score >= 70) return { text: 'High chance to perform', color: 'text-emerald-400' }
  if (score >= 50) return { text: 'Very viral', color: 'text-orange-400' }
  if (score >= 30) return { text: 'Good', color: 'text-yellow-400' }
  return { text: 'Needs optimization', color: 'text-red-400' }
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'from-green-500 to-emerald-500'
  if (score >= 70) return 'from-emerald-500 to-teal-500'
  if (score >= 50) return 'from-orange-500 to-amber-500'
  if (score >= 30) return 'from-yellow-500 to-orange-500'
  return 'from-red-500 to-orange-500'
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

  const tagScores: ScoredOption[] = TAG_STYLES.map((t) => {
    let score = t.baseScore
    if (t.id === 'banner-bottom' && clip.author_handle) score += 5
    if (t.id === 'badge-top') score += 3
    return { id: t.id, score, isBest: false }
  })
  const maxTag = Math.max(...tagScores.map((s) => s.score))
  tagScores.forEach((s) => { s.isBest = s.score === maxTag })

  const WEIGHTS = { caption: 25, anim: 15, broll: 25, tag: 15, hook: 20 }

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
  const hookScore = settings.hookEnabled ? (HOOK_PRESETS.find((h) => h.text === settings.hookText)?.score ?? 12) : 0
  return (settings.captionsEnabled ? cs + as2 : 0) + bs + ts + hookScore
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
  settings,
}: {
  clip: TrendingClipData
  settings: EnhanceSettings
}) {
  const broll = BROLL_OPTIONS.find((b) => b.id === settings.brollVideo)
  const captionStyle = CAPTION_STYLES.find((s) => s.id === settings.captionStyle)
  const tagStyle = TAG_STYLES.find((t) => t.id === settings.tagStyle)
  const streamerName = clip.author_handle ? `@${clip.author_handle}` : clip.author_name ?? ''

  const animationClass = settings.captionAnimation === 'pop' ? 'animate-[pulse_2s_ease-in-out_infinite]'
    : settings.captionAnimation === 'bounce' ? 'animate-bounce'
    : settings.captionAnimation === 'glow' ? 'animate-[pulse_1.5s_ease-in-out_infinite]'
    : ''

  return (
    <>
    <style>{`
      @keyframes kenburns {
        0% { transform: scale(1) translate(0, 0); }
        100% { transform: scale(1.08) translate(-2%, -1%); }
      }
    `}</style>
    <div
      className="relative w-full rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl mx-auto transition-all duration-500"
      style={{ aspectRatio: '9/16', maxWidth: 280 }}
    >
      {/* Top: Clip video or thumbnail */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden transition-all duration-500"
        style={{ height: settings.splitScreenEnabled ? `${settings.splitRatio}%` : '100%' }}
      >
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt={clip.title ?? 'Clip'}
            className="w-full h-full object-cover animate-[kenburns_20s_ease-in-out_infinite_alternate]"
          />
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
      {settings.hookEnabled && settings.hookText && settings.hookText !== 'Aucun hook' && (
        <div className="absolute top-[12%] left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1.5 border border-white/10 animate-[pulse_2s_ease-in-out_infinite]">
            <span className="text-xs font-black text-white uppercase tracking-wide whitespace-nowrap">{settings.hookText}</span>
          </div>
        </div>
      )}

      {/* ── Tag overlays ── */}
      {tagStyle && tagStyle.id !== 'none' && streamerName && (
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
            <div className="absolute z-20 pointer-events-none transition-all duration-300 right-3"
              style={{ bottom: settings.splitScreenEnabled ? `calc(${100 - settings.splitRatio}% + 8px)` : '8px' }}>
              <div className="flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-full px-2 py-0.5 border border-white/10">
                <svg className="h-2.5 w-2.5 text-[#9146FF]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                <span className="text-[9px] font-semibold text-white/80">{streamerName}</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* Karaoke subtitle preview */}
      {settings.captionsEnabled && (
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
          <p className={cn('text-sm text-center transition-all duration-300', captionStyle?.preview, animationClass)}>
            This is{' '}
            <span className={cn('px-0.5 rounded', captionStyle?.highlightClass)}>
              {settings.captionAnimation === 'typewriter' ? 'CRA...' : 'CRAZY'}
            </span>{' '}
            bro
          </p>
        </div>
      )}

      {/* Split line */}
      {settings.splitScreenEnabled && (
        <div
          className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent z-10 transition-all duration-500"
          style={{ top: `${settings.splitRatio}%` }}
        />
      )}

      {/* Bottom: B-roll */}
      {settings.splitScreenEnabled && broll && (
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rendering, setRendering] = useState(false)
  const [renderMessage, setRenderMessage] = useState<string | null>(null)
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [viralApplied, setViralApplied] = useState(false)

  // Section refs for scroll navigation (advanced mode)
  const captionsRef = useRef<HTMLDivElement>(null)
  const splitscreenRef = useRef<HTMLDivElement>(null)
  const hookRef = useRef<HTMLDivElement>(null)
  const tagsRef = useRef<HTMLDivElement>(null)
  const styleRef = useRef<HTMLDivElement>(null)

  const scrollToSection = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

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
    autoCredit: true,
    aspectRatio: '9:16',
    hookText: '',
    hookEnabled: false,
    platform: 'tiktok',
  })

  useEffect(() => {
    async function loadClip() {
      try {
        const supabase = createClient()
        const { data, error: dbError } = await supabase
          .from('trending_clips')
          .select('*')
          .eq('id', clipId)
          .single()
        if (dbError) throw new Error(dbError.message)
        if (!data) throw new Error('Clip non trouvé')
        setClip(data as unknown as TrendingClipData)

        // Auto-enable split screen if clip > 15 seconds
        const duration = (data as unknown as TrendingClipData).duration_seconds
        if (duration && duration > 15) {
          setSettings((s) => ({ ...s, splitScreenEnabled: true, brollVideo: 'subway-surfers' }))
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    loadClip()
  }, [clipId])

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

  // ⚡ MAKE IT VIRAL — applies the best combo automatically
  const makeItViral = useCallback(() => {
    if (!scores) return
    const bestHook = HOOK_PRESETS.reduce((a, b) => a.score > b.score ? a : b)
    setSettings((s) => ({
      ...s,
      captionsEnabled: true,
      captionStyle: scores.best.captionStyle,
      captionAnimation: scores.best.captionAnimation,
      captionPosition: 'bottom',
      splitScreenEnabled: true,
      brollVideo: scores.best.brollVideo,
      splitRatio: 60,
      tagStyle: scores.best.tagStyle,
      hookEnabled: true,
      hookText: bestHook.text,
      aspectRatio: '9:16',
    }))
    setViralApplied(true)
    setTimeout(() => setViralApplied(false), 2000)
  }, [scores])

  // Apply platform preset
  const applyPlatformPreset = useCallback((platform: 'tiktok' | 'reels' | 'shorts') => {
    const preset = PLATFORM_PRESETS[platform]
    setSettings((s) => ({
      ...s,
      platform,
      captionStyle: preset.captionStyle,
      captionAnimation: preset.animation,
      aspectRatio: preset.aspectRatio,
    }))
  }, [])

  const handleRender = useCallback(async () => {
    if (!clip) return
    setRendering(true)
    setRenderMessage(null)
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clip_id: clip.id,
          settings: {
            captions: { enabled: settings.captionsEnabled, style: settings.captionStyle, animation: settings.captionAnimation },
            splitScreen: { enabled: settings.splitScreenEnabled, brollCategory: settings.brollVideo },
            hook: { enabled: settings.hookEnabled, text: settings.hookText },
            format: { aspectRatio: settings.aspectRatio },
          },
        }),
      })
      const data = await res.json() as { data: { clip_id: string } | null; error: string | null; message: string }
      if (!res.ok || !data.data) {
        setRenderMessage(data.message ?? 'Erreur lors du rendu')
      } else {
        setRenderMessage('Clip en cours de rendu !')
      }
    } catch {
      setRenderMessage('Erreur réseau')
    } finally {
      setRendering(false)
    }
  }, [clip, settings, router])

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
          <Button variant="outline" className="gap-2"><ChevronLeft className="h-4 w-4" />Retour au feed</Button>
        </Link>
      </div>
    )
  }

  const scoreMsg = getScoreMessage(currentScore)

  // ── Main layout ────────────────────────────────────────────────────────

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-start gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="mt-0.5"><ChevronLeft className="h-5 w-5" /></Button>
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
        {/* Mode toggle */}
        <button
          onClick={() => setMode(mode === 'simple' ? 'advanced' : 'simple')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
            mode === 'advanced'
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
          )}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {mode === 'simple' ? 'Mode avancé' : 'Mode simple'}
        </button>
      </div>

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-[300px_1fr] gap-6">
        {/* Left: Preview + Score + Generate — compact, sticky */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-3">
          {/* Score — enhanced with dynamic message */}
          {scores && (
            <div className="bg-card/60 border border-border rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center', getScoreColor(currentScore))}>
                    <Zap className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <span className="text-2xl font-black text-foreground leading-none">{currentScore}</span>
                    <span className="text-xs text-muted-foreground ml-0.5">/ 100</span>
                  </div>
                </div>
              </div>
              {/* Score bar */}
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-700', getScoreColor(currentScore))}
                  style={{ width: `${currentScore}%` }}
                />
              </div>
              <p className={cn('text-xs font-semibold', scoreMsg.color)}>{scoreMsg.text}</p>
            </div>
          )}

          {/* Preview */}
          <LivePreview clip={clip} settings={settings} />

          {/* Metadata inline */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{formatCount(clip.view_count)} vues</span>
            <a href={clip.external_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="h-3 w-3" />Original
            </a>
          </div>

          {/* ⚡ MAKE IT VIRAL — Big CTA */}
          <button
            onClick={makeItViral}
            className={cn(
              'w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300',
              viralApplied
                ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                : 'bg-gradient-to-r from-orange-500 via-red-500 to-pink-500 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02] active:scale-[0.98]'
            )}
          >
            {viralApplied ? (
              <><Sparkles className="h-5 w-5" /> Optimisé !</>
            ) : (
              <><Zap className="h-5 w-5" /> Make it viral</>
            )}
          </button>

          {/* Generate button */}
          <Button
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold gap-2 shadow-lg shadow-blue-500/20"
            onClick={handleRender}
            disabled={rendering}
          >
            {rendering ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Rendu en cours&hellip;</>
            ) : (
              <><Download className="h-4 w-4" /> Générer le clip</>
            )}
          </Button>
          {renderMessage && (
            <p className={cn('text-xs text-center font-medium', renderMessage.includes('Erreur') ? 'text-destructive' : 'text-green-400')}>
              {renderMessage}
            </p>
          )}
        </div>

        {/* Right: Settings panel */}
        <div>
          {/* ════════════════════════════════════════════════════════════════
              SIMPLE MODE — minimal UI, 3 quick toggles + platform
             ════════════════════════════════════════════════════════════════ */}
          {mode === 'simple' && (
            <div className="space-y-4">
              {/* Quick toggles */}
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-orange-400" />
                    Réglages rapides
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Captions toggle */}
                  <button
                    onClick={() => updateSetting('captionsEnabled', !settings.captionsEnabled)}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
                      settings.captionsEnabled
                        ? 'border-primary/50 bg-primary/10'
                        : 'border-border hover:border-primary/30'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', settings.captionsEnabled ? 'bg-primary/20' : 'bg-muted')}>
                        <Type className={cn('h-4 w-4', settings.captionsEnabled ? 'text-primary' : 'text-muted-foreground')} />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-foreground">Sous-titres</span>
                        <span className="text-[10px] text-muted-foreground block">Sous-titres karaoké automatiques</span>
                      </div>
                    </div>
                    <div className={cn(
                      'w-10 h-6 rounded-full transition-all relative',
                      settings.captionsEnabled ? 'bg-primary' : 'bg-muted'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all',
                        settings.captionsEnabled ? 'left-[18px]' : 'left-0.5'
                      )} />
                    </div>
                  </button>

                  {/* Split screen toggle */}
                  <button
                    onClick={() => {
                      const newEnabled = !settings.splitScreenEnabled
                      updateSetting('splitScreenEnabled', newEnabled)
                      if (newEnabled && settings.brollVideo === 'none') {
                        updateSetting('brollVideo', 'subway-surfers')
                      }
                    }}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
                      settings.splitScreenEnabled
                        ? 'border-emerald-500/50 bg-emerald-500/10'
                        : 'border-border hover:border-emerald-500/30'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', settings.splitScreenEnabled ? 'bg-emerald-500/20' : 'bg-muted')}>
                        <Monitor className={cn('h-4 w-4', settings.splitScreenEnabled ? 'text-emerald-400' : 'text-muted-foreground')} />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-foreground">Split-Screen</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {settings.splitScreenEnabled ? BROLL_OPTIONS.find((b) => b.id === settings.brollVideo)?.label ?? 'Activé' : 'Gameplay en bas'}
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      'w-10 h-6 rounded-full transition-all relative',
                      settings.splitScreenEnabled ? 'bg-emerald-500' : 'bg-muted'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all',
                        settings.splitScreenEnabled ? 'left-[18px]' : 'left-0.5'
                      )} />
                    </div>
                  </button>

                  {/* Quick B-roll presets when split is enabled */}
                  {settings.splitScreenEnabled && (
                    <div className="grid grid-cols-3 gap-2 pl-12">
                      {BROLL_OPTIONS.filter((b) => b.id !== 'none').slice(0, 3).map((broll) => (
                        <button
                          key={broll.id}
                          onClick={() => updateSetting('brollVideo', broll.id)}
                          className={cn(
                            'rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-all',
                            settings.brollVideo === broll.id
                              ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                              : 'border-border text-muted-foreground hover:border-emerald-500/30'
                          )}
                        >
                          {broll.label.replace(' Surfers', '').replace(' Parkour', '').replace(' Cutting', '')}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Hook toggle */}
                  <button
                    onClick={() => {
                      const newEnabled = !settings.hookEnabled
                      updateSetting('hookEnabled', newEnabled)
                      if (newEnabled && !settings.hookText) {
                        updateSetting('hookText', 'WAIT FOR IT...')
                      }
                    }}
                    className={cn(
                      'w-full flex items-center justify-between p-3 rounded-xl border transition-all',
                      settings.hookEnabled
                        ? 'border-amber-500/50 bg-amber-500/10'
                        : 'border-border hover:border-amber-500/30'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', settings.hookEnabled ? 'bg-amber-500/20' : 'bg-muted')}>
                        <MessageSquare className={cn('h-4 w-4', settings.hookEnabled ? 'text-amber-400' : 'text-muted-foreground')} />
                      </div>
                      <div className="text-left">
                        <span className="text-sm font-semibold text-foreground">Hook / Intro</span>
                        <span className="text-[10px] text-muted-foreground block">
                          {settings.hookEnabled && settings.hookText ? settings.hookText : 'Texte accrocheur au début'}
                        </span>
                      </div>
                    </div>
                    <div className={cn(
                      'w-10 h-6 rounded-full transition-all relative',
                      settings.hookEnabled ? 'bg-amber-500' : 'bg-muted'
                    )}>
                      <div className={cn(
                        'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all',
                        settings.hookEnabled ? 'left-[18px]' : 'left-0.5'
                      )} />
                    </div>
                  </button>

                  {/* Quick hook presets when enabled */}
                  {settings.hookEnabled && (
                    <div className="grid grid-cols-2 gap-2 pl-12">
                      {HOOK_PRESETS.filter((h) => h.id !== 'none').slice(0, 4).map((hook) => (
                        <button
                          key={hook.id}
                          onClick={() => updateSetting('hookText', hook.text)}
                          className={cn(
                            'rounded-lg border px-2 py-1.5 text-[10px] font-medium transition-all text-left',
                            settings.hookText === hook.text
                              ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                              : 'border-border text-muted-foreground hover:border-amber-500/30'
                          )}
                        >
                          <span className="mr-1">{hook.emoji}</span>{hook.text}
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Platform optimization */}
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-400" />
                    Optimiser pour
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(PLATFORM_PRESETS).map(([key, preset]) => (
                      <button
                        key={key}
                        onClick={() => applyPlatformPreset(key as 'tiktok' | 'reels' | 'shorts')}
                        className={cn(
                          'rounded-xl border p-3 text-center transition-all',
                          settings.platform === key
                            ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30'
                            : 'border-border hover:border-blue-500/30'
                        )}
                      >
                        <span className="text-lg block mb-1">{preset.icon}</span>
                        <span className={cn('text-xs font-semibold', settings.platform === key ? 'text-blue-400' : 'text-foreground')}>
                          {preset.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              ADVANCED MODE — all the detailed options
             ════════════════════════════════════════════════════════════════ */}
          {mode === 'advanced' && (
            <>
              {/* Sticky nav bar */}
              <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border mb-6 -mx-1 px-1">
                <div className="grid grid-cols-5 gap-1 py-2">
                  {([
                    { label: 'Sous-titres', icon: <Type className="h-3.5 w-3.5" />, ref: captionsRef },
                    { label: 'Split', icon: <Monitor className="h-3.5 w-3.5" />, ref: splitscreenRef },
                    { label: 'Hook', icon: <MessageSquare className="h-3.5 w-3.5" />, ref: hookRef },
                    { label: 'Tags', icon: <AtSign className="h-3.5 w-3.5" />, ref: tagsRef },
                    { label: 'Format', icon: <Paintbrush className="h-3.5 w-3.5" />, ref: styleRef },
                  ] as const).map((item) => (
                    <button
                      key={item.label}
                      onClick={() => scrollToSection(item.ref)}
                      className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      {item.icon}
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                {/* ─── Captions Section ─── */}
                <div ref={captionsRef} className="scroll-mt-16">
                  <Card className="bg-card/60 border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Sous-titres karaoké</CardTitle>
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
                <div ref={splitscreenRef} className="scroll-mt-16">
                  <Card className="bg-card/60 border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Split-Screen</CardTitle>
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

                {/* ─── Hook / Intro Section ─── */}
                <div ref={hookRef} className="scroll-mt-16">
                  <Card className="bg-card/60 border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-amber-400" />
                        Hook / Intro
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs text-muted-foreground">Texte accrocheur affiché dans les 2 premières secondes pour capter l&apos;attention.</p>
                      <div className="grid grid-cols-2 gap-2">
                        {HOOK_PRESETS.map((hook) => (
                          <button
                            key={hook.id}
                            onClick={() => {
                              updateSetting('hookText', hook.text)
                              updateSetting('hookEnabled', hook.id !== 'none')
                            }}
                            className={cn(
                              'relative rounded-xl border p-3 text-left transition-all',
                              settings.hookText === hook.text
                                ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30'
                                : 'border-border hover:border-amber-500/30'
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-base">{hook.emoji}</span>
                              {hook.score > 0 && (
                                <span className={cn(
                                  'text-[10px] font-bold rounded-full px-1.5 py-0.5',
                                  settings.hookText === hook.text ? 'bg-amber-500/20 text-amber-400' : 'bg-muted/50 text-muted-foreground'
                                )}>+{hook.score}</span>
                              )}
                            </div>
                            <span className={cn(
                              'text-[10px] font-semibold block',
                              settings.hookText === hook.text ? 'text-amber-400' : 'text-foreground'
                            )}>{hook.text}</span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* ─── Tags Section ─── */}
                <div ref={tagsRef} className="scroll-mt-16">
                  <Card className="bg-card/60 border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">Tag du streamer</CardTitle>
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
                                      ? 'border-purple-500/60 bg-purple-500/10 ring-1 ring-purple-500/30'
                                      : scored.isBest
                                      ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                                      : 'border-border hover:border-purple-500/40'
                                  )}
                                >
                                  <div className="flex items-center gap-2.5 mb-1.5">
                                    {tag.icon === 'twitch' ? (
                                      <div className="w-7 h-7 rounded-lg bg-[#9146FF]/20 flex items-center justify-center">
                                        <svg className="w-4 h-4 text-[#9146FF]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                                      </div>
                                    ) : (
                                      <div className={cn(
                                        'w-7 h-7 rounded-lg flex items-center justify-center text-sm',
                                        tag.id === 'badge-top' ? 'bg-blue-500/15' : tag.id === 'watermark-center' ? 'bg-cyan-500/15' : 'bg-muted/50'
                                      )}>
                                        {tag.icon}
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <span className={cn('text-xs font-semibold', scored.isBest ? 'text-orange-400' : 'text-foreground')}>{tag.label}</span>
                                        <ScoreBadge score={scored.score} isBest={scored.isBest} />
                                      </div>
                                      <span className="text-[10px] text-muted-foreground block">{tag.description}</span>
                                    </div>
                                  </div>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                </div>

                {/* ─── Format / Platform Section ─── */}
                <div ref={styleRef} className="scroll-mt-16">
                  <Card className="bg-card/60 border-border">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-400" />
                        Plateforme & Format
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Platform presets */}
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Optimiser pour</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.entries(PLATFORM_PRESETS).map(([key, preset]) => (
                            <button
                              key={key}
                              onClick={() => applyPlatformPreset(key as 'tiktok' | 'reels' | 'shorts')}
                              className={cn(
                                'rounded-xl border p-3 text-center transition-all',
                                settings.platform === key
                                  ? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30'
                                  : 'border-border hover:border-blue-500/30'
                              )}
                            >
                              <span className="text-lg block mb-1">{preset.icon}</span>
                              <span className={cn('text-xs font-semibold', settings.platform === key ? 'text-blue-400' : 'text-foreground')}>
                                {preset.label}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Format manual */}
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Format</Label>
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
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
