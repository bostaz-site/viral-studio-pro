/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Sparkles, Download,
  Type, Wand2, Eye, Heart, ExternalLink, Play,
  Monitor, Paintbrush, TrendingUp, Zap, CheckCircle2,
  Upload, FileVideo, Link2, AtSign,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
}

// ─── Scoring Constants ──────────────────────────────────────────────────────
// Chaque option a un score de base. Le moteur IA calcule le meilleur combo.

const CAPTION_STYLES = [
  { id: 'hormozi', label: 'Hormozi', preview: 'text-yellow-400 font-black uppercase', highlightClass: 'text-yellow-400 bg-yellow-400/20', baseScore: 12 },
  { id: 'mrbeast', label: 'MrBeast', preview: 'text-white font-black', highlightClass: 'text-red-500 bg-red-500/20', baseScore: 14 },
  { id: 'aliabdaal', label: 'Ali Abdaal', preview: 'text-blue-300 font-semibold', highlightClass: 'text-blue-300 bg-blue-300/20', baseScore: 8 },
  { id: 'neon', label: 'Neon', preview: 'text-green-400 font-bold', highlightClass: 'text-green-400 bg-green-400/20', baseScore: 10 },
  { id: 'bold', label: 'Bold', preview: 'text-white font-black text-lg', highlightClass: 'text-white bg-white/20', baseScore: 11 },
  { id: 'minimal', label: 'Minimal', preview: 'text-white/80 font-medium', highlightClass: 'text-white/80 bg-white/10', baseScore: 6 },
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
]

const TAG_STYLES = [
  { id: 'badge-top', label: 'Badge coin', description: 'Tag dans un badge en haut \u00e0 droite', baseScore: 10, position: 'top-right' as const },
  { id: 'watermark-center', label: 'Watermark', description: 'Semi-transparent au centre', baseScore: 6, position: 'center' as const },
  { id: 'banner-bottom', label: 'Banni\u00e8re bas', description: 'Bande en bas de la vid\u00e9o', baseScore: 12, position: 'bottom' as const },
  { id: 'none', label: 'Aucun tag', description: 'Pas de tag visible', baseScore: 0, position: 'none' as const },
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

  // Best combo
  const bestCaption = captionScores.find((s) => s.isBest)!.id
  const bestAnim = animScores.find((s) => s.isBest)!.id
  const bestBroll = brollScores.find((s) => s.isBest)!.id
  const bestTag = tagScores.find((s) => s.isBest)!.id
  const totalBestScore = maxCaption + maxAnim + maxBroll + maxTag

  return {
    captionScores,
    animScores,
    brollScores,
    tagScores,
    best: { captionStyle: bestCaption, captionAnimation: bestAnim, brollVideo: bestBroll, tagStyle: bestTag },
    totalBestScore,
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
    <div
      className="relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl mx-auto transition-all duration-500"
      style={{ aspectRatio: '9/16', maxWidth: 280 }}
    >
      {/* Top: Clip thumbnail */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden transition-all duration-500"
        style={{ height: settings.splitScreenEnabled ? `${settings.splitRatio}%` : '100%' }}
      >
        {clip.thumbnail_url ? (
          <img src={clip.thumbnail_url} alt={clip.title ?? 'Clip'} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <Play className="h-10 w-10 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Platform badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="outline" className="text-[10px] bg-black/50 backdrop-blur-sm border-white/20 text-white">
            {clip.platform === 'twitch' ? 'Twitch' : clip.platform}
          </Badge>
        </div>
      </div>

      {/* ── Tag overlays ── */}
      {tagStyle && tagStyle.id !== 'none' && streamerName && (
        <>
          {tagStyle.position === 'top-right' && (
            <div className="absolute top-3 right-3 z-20 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 transition-all duration-300">
              <span className="text-xs font-bold text-white">{streamerName}</span>
            </div>
          )}
          {tagStyle.position === 'center' && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <span className="text-2xl font-black text-white/15 rotate-[-20deg]">{streamerName}</span>
            </div>
          )}
          {tagStyle.position === 'bottom' && (
            <div className="absolute bottom-0 inset-x-0 z-20 bg-gradient-to-t from-black/80 to-transparent px-3 py-2 transition-all duration-300"
              style={{ bottom: settings.splitScreenEnabled ? `${100 - settings.splitRatio}%` : '0' }}>
              <div className="flex items-center gap-1.5">
                <AtSign className="h-3 w-3 text-blue-400" />
                <span className="text-xs font-bold text-white">{streamerName}</span>
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
        if (!data) throw new Error('Clip non trouv\u00e9')
        setClip(data as TrendingClipData)
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
      setRenderMessage('Erreur r\u00e9seau')
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
        <p className="text-destructive font-medium">{error ?? 'Clip non trouv\u00e9'}</p>
        <Link href="/dashboard">
          <Button variant="outline" className="gap-2"><ChevronLeft className="h-4 w-4" />Retour au feed</Button>
        </Link>
      </div>
    )
  }

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
      </div>

      {/* ── Score bar + Apply IA button ── */}
      {scores && (
        <div className="mb-6 flex items-center gap-4 bg-gradient-to-r from-orange-500/10 via-card to-primary/10 border border-orange-400/20 rounded-xl px-5 py-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black text-foreground">{currentScore}</span>
                <span className="text-sm text-muted-foreground">/ {scores.totalBestScore} pts</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Score viral de ta config actuelle</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex-1 max-w-[200px]">
            <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-500"
                style={{ width: `${Math.round((currentScore / scores.totalBestScore) * 100)}%` }}
              />
            </div>
          </div>

          <Button
            size="sm"
            className="shrink-0 gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold shadow-lg shadow-orange-500/20"
            onClick={applyBestCombo}
          >
            <Sparkles className="h-4 w-4" />
            Appliquer les choix IA
          </Button>
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-[340px_1fr] gap-8">
        {/* Left: Live Preview */}
        <div className="space-y-4">
          <Card className="bg-card/60 border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Preview live</span>
            </div>
            <LivePreview clip={clip} settings={settings} />
          </Card>

          {/* Clip metadata */}
          <Card className="bg-card/60 border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{formatCount(clip.view_count)} vues</span>
                {clip.like_count !== null && (
                  <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{formatCount(clip.like_count)}</span>
                )}
              </div>
              <a href={clip.external_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline">
                <ExternalLink className="h-3 w-3" />Voir l&apos;original sur {clip.platform}
              </a>
            </CardContent>
          </Card>

          {/* Render button */}
          <Button
            className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold gap-2 text-base shadow-lg shadow-blue-500/20"
            onClick={handleRender}
            disabled={rendering}
          >
            {rendering ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> Rendu en cours&hellip;</>
            ) : (
              <><Download className="h-5 w-5" /> G&eacute;n&eacute;rer le clip</>
            )}
          </Button>
          {renderMessage && (
            <p className={cn('text-sm text-center font-medium', renderMessage.includes('Erreur') ? 'text-destructive' : 'text-green-400')}>
              {renderMessage}
            </p>
          )}

          {/* Import your own */}
          <Card className="bg-card/40 border-dashed border-border hover:border-primary/40 transition-colors">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center"><Upload className="h-4 w-4 text-blue-400" /></div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Importer ton clip</p>
                  <p className="text-[10px] text-muted-foreground">Upload ou colle un lien</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 h-9 text-xs border-blue-500/20 text-blue-400 hover:bg-blue-500/10">
                    <FileVideo className="h-3.5 w-3.5" />Upload
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 h-9 text-xs border-purple-500/20 text-purple-400 hover:bg-purple-500/10">
                    <Link2 className="h-3.5 w-3.5" />Lien
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Settings Tabs */}
        <div>
          <Tabs defaultValue="captions" className="w-full">
            <TabsList className="grid grid-cols-4 mb-6">
              <TabsTrigger value="captions" className="gap-1.5"><Type className="h-3.5 w-3.5" />Sous-titres</TabsTrigger>
              <TabsTrigger value="splitscreen" className="gap-1.5"><Monitor className="h-3.5 w-3.5" />Split-Screen</TabsTrigger>
              <TabsTrigger value="tags" className="gap-1.5"><AtSign className="h-3.5 w-3.5" />Tags</TabsTrigger>
              <TabsTrigger value="style" className="gap-1.5"><Paintbrush className="h-3.5 w-3.5" />Style</TabsTrigger>
            </TabsList>

            {/* ─── Captions Tab ─── */}
            <TabsContent value="captions" className="space-y-6">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Sous-titres karaok&eacute;</CardTitle>
                    <Switch checked={settings.captionsEnabled} onCheckedChange={(v) => updateSetting('captionsEnabled', v)} />
                  </div>
                </CardHeader>
                {settings.captionsEnabled && scores && (
                  <CardContent className="space-y-5">
                    {/* Style selector with scores */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Style</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {CAPTION_STYLES.map((style) => {
                          const scored = scores.captionScores.find((s) => s.id === style.id)!
                          return (
                            <button
                              key={style.id}
                              onClick={() => updateSetting('captionStyle', style.id)}
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

                    {/* Animation with scores */}
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

                    {/* Position */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Position</Label>
                      <Select value={settings.captionPosition} onValueChange={(v) => updateSetting('captionPosition', v as 'top' | 'middle' | 'bottom')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Haut</SelectItem>
                          <SelectItem value="middle">Milieu</SelectItem>
                          <SelectItem value="bottom">Bas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Words per line */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mots par ligne</Label>
                        <span className="text-sm font-semibold text-foreground">{settings.wordsPerLine}</span>
                      </div>
                      <Slider value={[settings.wordsPerLine]} onValueChange={([v]) => updateSetting('wordsPerLine', v)} min={2} max={8} step={1} />
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>

            {/* ─── Split-Screen Tab ─── */}
            <TabsContent value="splitscreen" className="space-y-6">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Split-Screen</CardTitle>
                    <Switch checked={settings.splitScreenEnabled} onCheckedChange={(v) => updateSetting('splitScreenEnabled', v)} />
                  </div>
                </CardHeader>
                {settings.splitScreenEnabled && scores && (
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Vid&eacute;o B-roll</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {BROLL_OPTIONS.map((broll) => {
                          const scored = scores.brollScores.find((s) => s.id === broll.id)!
                          return (
                            <button
                              key={broll.id}
                              onClick={() => updateSetting('brollVideo', broll.id)}
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

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Ratio stream / B-roll</Label>
                        <span className="text-sm font-semibold text-foreground">{settings.splitRatio}% / {100 - settings.splitRatio}%</span>
                      </div>
                      <Slider value={[settings.splitRatio]} onValueChange={([v]) => updateSetting('splitRatio', v)} min={40} max={80} step={5} />
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>

            {/* ─── Tags Tab ─── */}
            <TabsContent value="tags" className="space-y-6">
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
                                'relative rounded-xl border p-3 text-left transition-all',
                                settings.tagStyle === tag.id
                                  ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                  : scored.isBest
                                  ? 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10'
                                  : 'border-border hover:border-primary/40'
                              )}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className={cn('text-xs font-semibold', scored.isBest ? 'text-orange-400' : 'text-foreground')}>{tag.label}</span>
                                <ScoreBadge score={scored.score} isBest={scored.isBest} />
                              </div>
                              <span className="text-[10px] text-muted-foreground">{tag.description}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Auto credit toggle */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div>
                        <Label className="text-sm">Cr&eacute;dit en description</Label>
                        <p className="text-[10px] text-muted-foreground">
                          Ajoute &laquo; Cr&eacute;dit : {clip.author_handle ? `@${clip.author_handle}` : '@streamer'} &raquo;
                        </p>
                      </div>
                      <Switch checked={settings.autoCredit} onCheckedChange={(v) => updateSetting('autoCredit', v)} />
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>

            {/* ─── Style Tab ─── */}
            <TabsContent value="style" className="space-y-6">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Format</CardTitle>
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

              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Position sous-titres</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={settings.captionPosition} onValueChange={(v) => updateSetting('captionPosition', v as 'top' | 'middle' | 'bottom')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="top">Haut</SelectItem>
                      <SelectItem value="middle">Milieu</SelectItem>
                      <SelectItem value="bottom">Bas</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
