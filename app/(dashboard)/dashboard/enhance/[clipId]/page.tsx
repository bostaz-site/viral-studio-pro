/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Loader2, AlertCircle, Sparkles, Download,
  Type, Wand2, Eye, Heart, ExternalLink, Play,
  Monitor, Paintbrush, TrendingUp, Zap, CheckCircle2,
  Upload, FileVideo, Link2,
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

  streamerTag: string
  autoCredit: boolean

  aspectRatio: '9:16' | '1:1' | '16:9'
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CAPTION_STYLES = [
  { id: 'hormozi', label: 'Hormozi', preview: 'text-yellow-400 font-black uppercase' },
  { id: 'mrbeast', label: 'MrBeast', preview: 'text-white font-black' },
  { id: 'aliabdaal', label: 'Ali Abdaal', preview: 'text-blue-300 font-semibold' },
  { id: 'neon', label: 'Neon', preview: 'text-green-400 font-bold' },
  { id: 'bold', label: 'Bold', preview: 'text-white font-black text-lg' },
  { id: 'minimal', label: 'Minimal', preview: 'text-white/80 font-medium' },
]

const CAPTION_ANIMATIONS = [
  { id: 'highlight', label: 'Highlight' },
  { id: 'pop', label: 'Pop' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'glow', label: 'Glow' },
]

const BROLL_OPTIONS = [
  { id: 'subway-surfers', label: 'Subway Surfers', color: 'from-emerald-500 to-teal-500' },
  { id: 'minecraft-parkour', label: 'Minecraft Parkour', color: 'from-green-600 to-lime-500' },
  { id: 'sand-cutting', label: 'Sand Cutting', color: 'from-amber-500 to-orange-500' },
  { id: 'soap-cutting', label: 'Soap Cutting', color: 'from-pink-500 to-rose-500' },
  { id: 'slime-satisfying', label: 'Slime', color: 'from-purple-500 to-violet-500' },
]

function formatCount(n: number | null): string {
  if (n === null) return '--'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

// ─── Viral Score Badge ──────────────────────────────────────────────────────

function ViralScoreBadge({ score }: { score: number | null }) {
  if (!score) return null
  const color = score >= 70
    ? 'from-green-500 to-emerald-500'
    : score >= 40
    ? 'from-yellow-500 to-amber-500'
    : 'from-red-500 to-orange-500'

  return (
    <div className={`bg-gradient-to-r ${color} rounded-xl px-4 py-2 shadow-lg`}>
      <div className="flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-white" />
        <span className="text-2xl font-black text-white">{score}</span>
        <span className="text-xs text-white/70 font-medium">/100</span>
      </div>
    </div>
  )
}

// ─── Split-Screen Preview ───────────────────────────────────────────────────

function SplitScreenPreview({
  clip,
  settings,
}: {
  clip: TrendingClipData
  settings: EnhanceSettings
}) {
  const broll = BROLL_OPTIONS.find((b) => b.id === settings.brollVideo)
  const captionStyle = CAPTION_STYLES.find((s) => s.id === settings.captionStyle)

  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl mx-auto"
      style={{ aspectRatio: '9/16', maxWidth: 280 }}
    >
      {/* Top: Clip thumbnail */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden"
        style={{ height: settings.splitScreenEnabled ? `${settings.splitRatio}%` : '100%' }}
      >
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt={clip.title ?? 'Clip'}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
            <Play className="h-10 w-10 text-white/20" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Streamer tag */}
        {settings.streamerTag && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1">
            <span className="text-xs font-bold text-white">{settings.streamerTag}</span>
          </div>
        )}

        {/* Platform badge */}
        <div className="absolute top-3 left-3">
          <Badge variant="outline" className="text-[10px] bg-black/50 backdrop-blur-sm border-white/20 text-white">
            {clip.platform === 'twitch' ? 'Twitch' : clip.platform}
          </Badge>
        </div>
      </div>

      {/* Karaoke subtitles */}
      {settings.captionsEnabled && (
        <div
          className="absolute left-1/2 -translate-x-1/2 z-20 bg-black/80 rounded-lg px-3 py-1.5 backdrop-blur-sm max-w-[85%]"
          style={{
            top: settings.captionPosition === 'top' ? '15%'
              : settings.captionPosition === 'middle' ? (settings.splitScreenEnabled ? `${settings.splitRatio - 8}%` : '45%')
              : settings.splitScreenEnabled ? `${settings.splitRatio - 8}%` : '75%',
          }}
        >
          <p className={cn('text-sm text-center', captionStyle?.preview)}>
            This is <span className="text-yellow-400 bg-yellow-400/20 px-0.5 rounded">CRAZY</span> bro
          </p>
        </div>
      )}

      {/* Split line */}
      {settings.splitScreenEnabled && (
        <div
          className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent z-10"
          style={{ top: `${settings.splitRatio}%` }}
        />
      )}

      {/* Bottom: B-roll */}
      {settings.splitScreenEnabled && broll && (
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-br ${broll.color} overflow-hidden`}
          style={{ height: `${100 - settings.splitRatio}%` }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-white/50 font-medium">{broll.label}</span>
          </div>
        </div>
      )}

      {/* Viral score */}
      <div className="absolute bottom-3 left-3 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg px-2 py-1 shadow-lg z-20">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-black" />
          <span className="text-xs font-black text-black">{clip.velocity_score ?? '—'}</span>
        </div>
      </div>
    </div>
  )
}

// ─── AI Style Suggestion Engine ─────────────────────────────────────────────

interface StyleSuggestion {
  captionStyle: string
  captionAnimation: string
  brollVideo: string
  splitRatio: number
  score: number
  reason: string
}

/**
 * Compute the best style suggestion based on clip metadata.
 * Uses heuristics based on streamer type, niche, velocity, and view count.
 */
function computeStyleSuggestion(clip: TrendingClipData): StyleSuggestion {
  const velocity = clip.velocity_score ?? 50
  const views = clip.view_count ?? 0
  const niche = clip.niche?.toLowerCase() ?? 'irl'
  const author = clip.author_handle?.toLowerCase() ?? ''

  // Determine energy level from velocity + views
  const isHighEnergy = velocity >= 70 || views >= 1_000_000
  const isMidEnergy = velocity >= 40 || views >= 100_000

  // Caption style scoring
  let captionStyle = 'hormozi'
  let captionAnimation = 'highlight'
  let captionReason = ''

  if (isHighEnergy) {
    captionStyle = 'mrbeast'
    captionAnimation = 'pop'
    captionReason = 'Clip haute \u00e9nergie — le style MrBeast bold + animation Pop maximise l\u2019impact visuel'
  } else if (niche === 'irl' || niche === 'just chatting') {
    captionStyle = 'hormozi'
    captionAnimation = 'highlight'
    captionReason = 'Contenu IRL/talking — Hormozi + Highlight met en avant les punchlines'
  } else if (isMidEnergy) {
    captionStyle = 'bold'
    captionAnimation = 'bounce'
    captionReason = '\u00c9nergie moyenne — Bold + Bounce garde l\u2019attention sans surcharger'
  } else {
    captionStyle = 'aliabdaal'
    captionAnimation = 'typewriter'
    captionReason = 'Clip calme — Ali Abdaal + Typewriter donne un ton pro et clean'
  }

  // B-roll scoring
  let brollVideo = 'subway-surfers'
  let brollReason = ''

  if (isHighEnergy) {
    brollVideo = 'minecraft-parkour'
    brollReason = 'Minecraft Parkour synce bien avec l\u2019\u00e9nergie rapide du clip'
  } else if (niche === 'irl') {
    brollVideo = 'subway-surfers'
    brollReason = 'Subway Surfers est le classique pour les clips IRL — maximise la r\u00e9tention'
  } else {
    brollVideo = 'sand-cutting'
    brollReason = 'Sand Cutting ASMR pour un clip plus pos\u00e9 — satisfaction visuelle'
  }

  // Split ratio
  const splitRatio = isHighEnergy ? 65 : 60

  // Compute overall score
  let score = 72 // base
  if (isHighEnergy) score += 15
  else if (isMidEnergy) score += 8
  if (niche === 'irl') score += 5
  if (velocity >= 80) score += 5
  score = Math.min(98, score)

  return {
    captionStyle,
    captionAnimation,
    brollVideo,
    splitRatio,
    score,
    reason: `${captionReason}. ${brollReason}.`,
  }
}

function AISuggestionPanel({
  clip,
  suggestion,
  onApply,
}: {
  clip: TrendingClipData
  suggestion: StyleSuggestion
  onApply: () => void
}) {
  const captionLabel = CAPTION_STYLES.find((s) => s.id === suggestion.captionStyle)?.label ?? suggestion.captionStyle
  const animLabel = CAPTION_ANIMATIONS.find((a) => a.id === suggestion.captionAnimation)?.label ?? suggestion.captionAnimation
  const brollLabel = BROLL_OPTIONS.find((b) => b.id === suggestion.brollVideo)?.label ?? suggestion.brollVideo

  return (
    <Card className="bg-gradient-to-br from-primary/10 via-card/80 to-purple-500/10 border-primary/30 shadow-lg shadow-primary/5">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center shadow-lg shadow-primary/30">
              <Sparkles className="h-4.5 w-4.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Suggestion IA</p>
              <p className="text-[10px] text-muted-foreground">
                Bas\u00e9e sur le type de contenu et la v\u00e9locit\u00e9
              </p>
            </div>
          </div>
          {/* Score badge */}
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full px-3 py-1.5 shadow-lg shadow-green-500/20">
            <Zap className="h-3.5 w-3.5 text-white" />
            <span className="text-sm font-black text-white">{suggestion.score}</span>
            <span className="text-[10px] text-white/70">/100</span>
          </div>
        </div>

        {/* Recommended settings */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-card/60 border border-border p-2.5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Sous-titres</p>
            <p className="text-xs font-semibold text-foreground">{captionLabel}</p>
            <p className="text-[10px] text-primary">{animLabel}</p>
          </div>
          <div className="rounded-lg bg-card/60 border border-border p-2.5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Split-Screen</p>
            <p className="text-xs font-semibold text-foreground">{brollLabel}</p>
            <p className="text-[10px] text-primary">{suggestion.splitRatio}% / {100 - suggestion.splitRatio}%</p>
          </div>
          <div className="rounded-lg bg-card/60 border border-border p-2.5 space-y-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Format</p>
            <p className="text-xs font-semibold text-foreground">9:16</p>
            <p className="text-[10px] text-primary">TikTok / Reels</p>
          </div>
        </div>

        {/* Explanation */}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {suggestion.reason}
        </p>

        {/* Apply button */}
        <Button
          size="sm"
          className="w-full gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 text-white font-semibold shadow-lg shadow-primary/20"
          onClick={onApply}
        >
          <CheckCircle2 className="h-4 w-4" />
          Appliquer la suggestion IA
        </Button>
      </CardContent>
    </Card>
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
    streamerTag: '',
    autoCredit: true,
    aspectRatio: '9:16',
  })

  // Load clip data from Supabase
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

        setClip(data as TrendingClipData)
        if (data.author_handle) {
          setSettings((s) => ({ ...s, streamerTag: `@${data.author_handle}` }))
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
            captions: {
              enabled: settings.captionsEnabled,
              style: settings.captionStyle,
              animation: settings.captionAnimation,
            },
            splitScreen: {
              enabled: settings.splitScreenEnabled,
              brollCategory: settings.brollVideo,
            },
            format: {
              aspectRatio: settings.aspectRatio,
            },
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

  // ── AI Suggestion ──────────────────────────────────────────────────────

  const aiSuggestion = useMemo(() => {
    if (!clip) return null
    return computeStyleSuggestion(clip)
  }, [clip])

  const applyAISuggestion = useCallback(() => {
    if (!aiSuggestion) return
    setSettings((s) => ({
      ...s,
      captionStyle: aiSuggestion.captionStyle,
      captionAnimation: aiSuggestion.captionAnimation,
      brollVideo: aiSuggestion.brollVideo,
      splitRatio: aiSuggestion.splitRatio,
      splitScreenEnabled: true,
      captionsEnabled: true,
    }))
  }, [aiSuggestion])

  // ── Loading / Error states ─────────────────────────────────────────────

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
        <ViralScoreBadge score={clip.velocity_score} />
      </div>

      {/* Two-column layout: Preview | Settings */}
      <div className="grid lg:grid-cols-[340px_1fr] gap-8">
        {/* Left: Preview */}
        <div className="space-y-4">
          <Card className="bg-card/60 border-border p-4">
            <SplitScreenPreview clip={clip} settings={settings} />
          </Card>

          {/* Clip metadata */}
          <Card className="bg-card/60 border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Eye className="h-3.5 w-3.5" />
                  {formatCount(clip.view_count)} vues
                </span>
                {clip.like_count !== null && (
                  <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" />
                    {formatCount(clip.like_count)}
                  </span>
                )}
              </div>
              <a
                href={clip.external_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Voir l&apos;original sur {clip.platform}
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
            <p className={cn(
              'text-sm text-center font-medium',
              renderMessage.includes('Erreur') ? 'text-destructive' : 'text-green-400'
            )}>
              {renderMessage}
            </p>
          )}

          {/* Import your own clip */}
          <Card className="bg-card/40 border-dashed border-border hover:border-primary/40 transition-colors">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <Upload className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Importer ton clip</p>
                  <p className="text-[10px] text-muted-foreground">Upload ou colle un lien pour enhance ton propre contenu</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 h-9 text-xs border-blue-500/20 text-blue-400 hover:bg-blue-500/10">
                    <FileVideo className="h-3.5 w-3.5" />
                    Upload fichier
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 h-9 text-xs border-purple-500/20 text-purple-400 hover:bg-purple-500/10">
                    <Link2 className="h-3.5 w-3.5" />
                    Coller un lien
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Settings Tabs */}
        <div>
          <Tabs defaultValue="captions" className="w-full">
            <TabsList className="grid grid-cols-3 mb-6">
              <TabsTrigger value="captions" className="gap-1.5">
                <Type className="h-3.5 w-3.5" />
                Sous-titres
              </TabsTrigger>
              <TabsTrigger value="splitscreen" className="gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
                Split-Screen
              </TabsTrigger>
              <TabsTrigger value="style" className="gap-1.5">
                <Paintbrush className="h-3.5 w-3.5" />
                Style
              </TabsTrigger>
            </TabsList>

            {/* ─── Captions Tab ───────────────────────────────────────── */}
            <TabsContent value="captions" className="space-y-6">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Sous-titres karaok&eacute;</CardTitle>
                    <Switch
                      checked={settings.captionsEnabled}
                      onCheckedChange={(v) => updateSetting('captionsEnabled', v)}
                    />
                  </div>
                </CardHeader>
                {settings.captionsEnabled && (
                  <CardContent className="space-y-5">
                    {/* Style selector */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Style</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {CAPTION_STYLES.map((style) => (
                          <button
                            key={style.id}
                            onClick={() => updateSetting('captionStyle', style.id)}
                            className={cn(
                              'rounded-xl border p-3 text-left transition-all',
                              settings.captionStyle === style.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/40'
                            )}
                          >
                            <span className={cn('text-xs block', style.preview)}>Aa</span>
                            <span className="text-[10px] text-muted-foreground mt-1 block">{style.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Animation */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Animation</Label>
                      <Select value={settings.captionAnimation} onValueChange={(v) => updateSetting('captionAnimation', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CAPTION_ANIMATIONS.map((a) => (
                            <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <Slider
                        value={[settings.wordsPerLine]}
                        onValueChange={([v]) => updateSetting('wordsPerLine', v)}
                        min={2}
                        max={8}
                        step={1}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>

            {/* ─── Split-Screen Tab ───────────────────────────────────── */}
            <TabsContent value="splitscreen" className="space-y-6">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Split-Screen</CardTitle>
                    <Switch
                      checked={settings.splitScreenEnabled}
                      onCheckedChange={(v) => updateSetting('splitScreenEnabled', v)}
                    />
                  </div>
                </CardHeader>
                {settings.splitScreenEnabled && (
                  <CardContent className="space-y-5">
                    {/* B-roll selector */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Vid&eacute;o B-roll</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {BROLL_OPTIONS.map((broll) => (
                          <button
                            key={broll.id}
                            onClick={() => updateSetting('brollVideo', broll.id)}
                            className={cn(
                              'rounded-xl border p-3 transition-all',
                              settings.brollVideo === broll.id
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/40'
                            )}
                          >
                            <div className={`w-full h-8 rounded-lg bg-gradient-to-r ${broll.color} mb-1.5`} />
                            <span className="text-[10px] text-muted-foreground">{broll.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Split ratio */}
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
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            </TabsContent>

            {/* ─── Style Tab ───────────────────────────────────────────── */}
            <TabsContent value="style" className="space-y-6">
              <Card className="bg-card/60 border-border">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Cr&eacute;dit & Tag</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Streamer tag */}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tag streamer</Label>
                    <input
                      type="text"
                      value={settings.streamerTag}
                      onChange={(e) => updateSetting('streamerTag', e.target.value)}
                      className="w-full bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                      placeholder="@kaicenat"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Ajout&eacute; automatiquement depuis le clip. Modifiable.
                    </p>
                  </div>

                  {/* Auto credit */}
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-sm">Cr&eacute;dit automatique</Label>
                      <p className="text-[10px] text-muted-foreground">
                        Ajoute &laquo; Cr&eacute;dit : {settings.streamerTag || '@streamer'} &raquo; dans la description
                      </p>
                    </div>
                    <Switch
                      checked={settings.autoCredit}
                      onCheckedChange={(v) => updateSetting('autoCredit', v)}
                    />
                  </div>
                </CardContent>
              </Card>

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
                            ? 'border-primary bg-primary/10'
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

            </TabsContent>
          </Tabs>

          {/* AI Style Suggestion — below all tabs */}
          {clip && aiSuggestion && (
            <div className="mt-6">
              <AISuggestionPanel
                clip={clip}
                suggestion={aiSuggestion}
                onApply={applyAISuggestion}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
