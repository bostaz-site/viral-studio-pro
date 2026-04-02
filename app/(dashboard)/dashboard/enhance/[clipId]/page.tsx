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
  { id: 'hormozi', label: 'Hormozi', preview: 'text-yellow-400 font-black uppercase', highlightClass: 'text-yellow-400 bg-yellow-400/20' },
  { id: 'mrbeast', label: 'MrBeast', preview: 'text-white font-black', highlightClass: 'text-red-500 bg-red-500/20' },
  { id: 'aliabdaal', label: 'Ali Abdaal', preview: 'text-blue-300 font-semibold', highlightClass: 'text-blue-300 bg-blue-300/20' },
  { id: 'neon', label: 'Neon', preview: 'text-green-400 font-bold', highlightClass: 'text-green-400 bg-green-400/20' },
  { id: 'bold', label: 'Bold', preview: 'text-white font-black text-lg', highlightClass: 'text-white bg-white/20' },
  { id: 'minimal', label: 'Minimal', preview: 'text-white/80 font-medium', highlightClass: 'text-white/80 bg-white/10' },
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

// ─── AI Badge Component ────────────────────────────────────────────────────

function AIBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-1.5 py-0.5 ml-1.5">
      <Sparkles className="h-2.5 w-2.5" />
      IA
    </span>
  )
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

  // Animation classes for the subtitle preview
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

        {/* Streamer tag overlay */}
        {settings.streamerTag && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-full px-2.5 py-1 transition-all duration-300">
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

      {/* Karaoke subtitle preview — live updates with style */}
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

      {/* Bottom: B-roll gameplay preview */}
      {settings.splitScreenEnabled && broll && (
        <div
          className={cn(
            'absolute inset-x-0 bottom-0 overflow-hidden transition-all duration-500',
            `bg-gradient-to-br ${broll.color}`
          )}
          style={{ height: `${100 - settings.splitRatio}%` }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 8px, rgba(255,255,255,0.15) 8px, rgba(255,255,255,0.15) 16px)',
              backgroundSize: '22px 22px',
            }}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <Play className="h-5 w-5 text-white/40" />
            <span className="text-[10px] text-white/60 font-semibold">{broll.label}</span>
          </div>
        </div>
      )}

      {/* No split screen — full screen indicator */}
      {!settings.splitScreenEnabled && (
        <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm rounded-lg px-2 py-1 z-20">
          <span className="text-[10px] text-white/50">Plein \u00e9cran</span>
        </div>
      )}

      {/* Viral score */}
      <div className="absolute bottom-3 left-3 bg-gradient-to-r from-yellow-500 to-amber-500 rounded-lg px-2 py-1 shadow-lg z-20">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-black" />
          <span className="text-xs font-black text-black">{clip.velocity_score ?? '\u2014'}</span>
        </div>
      </div>

      {/* Format badge */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
        <span className="text-[9px] text-white/40 font-medium bg-black/30 rounded-full px-2 py-0.5">
          {settings.aspectRatio}
        </span>
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

function computeStyleSuggestion(clip: TrendingClipData): StyleSuggestion {
  const velocity = clip.velocity_score ?? 50
  const views = clip.view_count ?? 0
  const niche = clip.niche?.toLowerCase() ?? 'irl'

  const isHighEnergy = velocity >= 70 || views >= 1_000_000
  const isMidEnergy = velocity >= 40 || views >= 100_000

  let captionStyle = 'hormozi'
  let captionAnimation = 'highlight'
  let captionReason = ''

  if (isHighEnergy) {
    captionStyle = 'mrbeast'
    captionAnimation = 'pop'
    captionReason = 'Clip haute \u00e9nergie \u2014 MrBeast + Pop maximise l\u2019impact'
  } else if (niche === 'irl' || niche === 'just chatting') {
    captionStyle = 'hormozi'
    captionAnimation = 'highlight'
    captionReason = 'Contenu IRL \u2014 Hormozi + Highlight met en avant les punchlines'
  } else if (isMidEnergy) {
    captionStyle = 'bold'
    captionAnimation = 'bounce'
    captionReason = '\u00c9nergie moyenne \u2014 Bold + Bounce garde l\u2019attention'
  } else {
    captionStyle = 'aliabdaal'
    captionAnimation = 'typewriter'
    captionReason = 'Clip calme \u2014 Ali Abdaal + Typewriter donne un ton pro'
  }

  let brollVideo = 'subway-surfers'
  let brollReason = ''

  if (isHighEnergy) {
    brollVideo = 'minecraft-parkour'
    brollReason = 'Minecraft Parkour synce avec l\u2019\u00e9nergie rapide'
  } else if (niche === 'irl') {
    brollVideo = 'subway-surfers'
    brollReason = 'Subway Surfers \u2014 le classique pour les clips IRL'
  } else {
    brollVideo = 'sand-cutting'
    brollReason = 'Sand Cutting ASMR pour un clip plus pos\u00e9'
  }

  const splitRatio = isHighEnergy ? 65 : 60

  let score = 72
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

      {/* AI suggestion banner — compact, at top */}
      {aiSuggestion && (
        <div className="mb-6 flex items-center gap-3 bg-gradient-to-r from-amber-500/10 via-primary/5 to-purple-500/10 border border-amber-400/20 rounded-xl px-4 py-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-primary flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <p className="text-xs text-muted-foreground flex-1">
            <span className="font-semibold text-foreground">Suggestion IA :</span>{' '}
            {aiSuggestion.reason}
          </p>
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full px-2.5 py-1 shrink-0">
            <Zap className="h-3 w-3 text-white" />
            <span className="text-xs font-black text-white">{aiSuggestion.score}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 gap-1.5 text-xs border-amber-400/30 text-amber-400 hover:bg-amber-400/10"
            onClick={applyAISuggestion}
          >
            <CheckCircle2 className="h-3 w-3" />
            Appliquer
          </Button>
        </div>
      )}

      {/* Two-column layout: Preview | Settings */}
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
                              'relative rounded-xl border p-3 text-left transition-all',
                              settings.captionStyle === style.id
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40'
                            )}
                          >
                            <span className={cn('text-xs block', style.preview)}>Aa</span>
                            <span className="text-[10px] text-muted-foreground mt-1 block">
                              {style.label}
                            </span>
                            {aiSuggestion?.captionStyle === style.id && <AIBadge />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Animation */}
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Animation</Label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {CAPTION_ANIMATIONS.map((anim) => (
                          <button
                            key={anim.id}
                            onClick={() => updateSetting('captionAnimation', anim.id)}
                            className={cn(
                              'relative rounded-xl border px-3 py-2.5 text-center transition-all',
                              settings.captionAnimation === anim.id
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40'
                            )}
                          >
                            <span className="text-[10px] font-medium text-foreground">{anim.label}</span>
                            {aiSuggestion?.captionAnimation === anim.id && (
                              <span className="absolute -top-1.5 -right-1.5">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] text-black font-bold">
                                  <Sparkles className="h-2.5 w-2.5" />
                                </span>
                              </span>
                            )}
                          </button>
                        ))}
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
                              'relative rounded-xl border p-3 transition-all',
                              settings.brollVideo === broll.id
                                ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                                : 'border-border hover:border-primary/40'
                            )}
                          >
                            <div className={`w-full h-8 rounded-lg bg-gradient-to-r ${broll.color} mb-1.5`} />
                            <span className="text-[10px] text-muted-foreground">{broll.label}</span>
                            {aiSuggestion?.brollVideo === broll.id && (
                              <span className="absolute -top-1.5 -right-1.5">
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[8px] text-black font-bold">
                                  <Sparkles className="h-2.5 w-2.5" />
                                </span>
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Split ratio */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                          Ratio stream / B-roll
                          {aiSuggestion && settings.splitRatio === aiSuggestion.splitRatio && <AIBadge />}
                        </Label>
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
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
