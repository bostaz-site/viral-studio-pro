'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ChevronLeft,
  Loader2,
  AlertCircle,
  Sparkles,
  Download,
  Share2,
  Type,
  Zap,
  Copy,
  Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { VideoPlayer, type VideoPlayerHandle } from '@/components/video/video-player'
import { TimelineEditor } from '@/components/video/timeline-editor'
import type { CaptionConfig } from '@/components/captions/caption-editor'
import { RemakeModal } from '@/components/clips/remake-modal'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import type { Database } from '@/lib/supabase/types'

type ClipRow = Database['public']['Tables']['clips']['Row']
type VideoRow = Database['public']['Tables']['videos']['Row']
type TranscriptionRow = Database['public']['Tables']['transcriptions']['Row']
type ViralScoreRow = Database['public']['Tables']['viral_scores']['Row']

// ─── Types ──────────────────────────────────────────────────────────────

interface ClipEditorState {
  clip: ClipRow | null
  video: VideoRow | null
  transcription: TranscriptionRow | null
  viralScore: ViralScoreRow | null
  videoUrl: string | null
  loading: boolean
  error: string | null
}

interface EditorSettings {
  // Captions
  captionsEnabled: boolean
  captionConfig: CaptionConfig
  autoEmojis: boolean
  captionAnimation: 'highlight' | 'pop' | 'bounce' | 'shake' | 'typewriter' | 'glow'

  // Split Screen
  splitScreenEnabled: boolean
  splitScreenLayout: 'top-bottom' | 'side-by-side' | 'pip'
  brollCategory: string
  splitScreenRatio: number

  // Format
  aspectRatio: '9:16' | '1:1' | '16:9'
  smartZoom: boolean
  smartReframe: boolean
  facecamPosition: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'none'
  backgroundBlur: boolean

  // Branding
  watermarkEnabled: boolean
  watermarkPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  introOutroEnabled: boolean
  creditText: string
  brandTemplateId: string | null
  brandLogoPath: string | null
}

interface BrandTemplate {
  id: string
  name: string
  primary_color: string | null
  secondary_color: string | null
  font_family: string | null
  logo_path: string | null
  watermark_path: string | null
  intro_video_path: string | null
  outro_video_path: string | null
  is_default: boolean | null
}

// ─── UI Components ──────────────────────────────────────────────────────

function ViralScoreBadge({ score }: { score: number | null }) {
  if (!score) return null

  let color: string
  if (score >= 70) color = 'bg-green-500/15 text-green-400 border-green-500/30'
  else if (score >= 40) color = 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
  else color = 'bg-red-500/15 text-red-400 border-red-500/30'

  return (
    <Badge variant="outline" className={`${color} border px-3 py-1.5 text-base font-semibold`}>
      Viral Score: {score}
    </Badge>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────

export default function ClipEditorPage() {
  const params = useParams()
  const router = useRouter()
  const clipId = params.clipId as string

  const [state, setState] = useState<ClipEditorState>({
    clip: null,
    video: null,
    transcription: null,
    viralScore: null,
    videoUrl: null,
    loading: true,
    error: null,
  })

  const [editorSettings, setEditorSettings] = useState<EditorSettings>({
    captionsEnabled: true,
    captionConfig: {
      templateId: 'hormozi',
      textColor: '#ffffff',
      position: 'bottom',
      wordsPerLine: 4,
    },
    autoEmojis: true,
    captionAnimation: 'highlight',
    splitScreenEnabled: false,
    splitScreenLayout: 'top-bottom',
    brollCategory: 'parkour',
    splitScreenRatio: 50,
    aspectRatio: '9:16',
    smartZoom: false,
    smartReframe: false,
    facecamPosition: 'bottom-left',
    backgroundBlur: false,
    watermarkEnabled: true,
    watermarkPosition: 'bottom-right',
    introOutroEnabled: false,
    creditText: '',
    brandTemplateId: null,
    brandLogoPath: null,
  })

  const [rendering, setRendering] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [remakeOpen, setRemakeOpen] = useState(false)
  const [brandTemplates, setBrandTemplates] = useState<BrandTemplate[]>([])
  const playerRef = useRef<VideoPlayerHandle>(null)

  // Fetch brand templates
  useEffect(() => {
    fetch('/api/brand-templates')
      .then((r) => r.json())
      .then((d: { data: BrandTemplate[] | null }) => {
        if (d.data) setBrandTemplates(d.data)
      })
      .catch(() => null)
  }, [])

  // ── Fetch clip data ──────────────────────────────────────────────────

  useEffect(() => {
    async function loadClipData() {
      if (!clipId) {
        setState((s) => ({ ...s, error: 'Clip ID not found', loading: false }))
        return
      }

      try {
        const supabase = createClient()

        // Fetch clip
        const { data: clipData, error: clipError } = await supabase
          .from('clips')
          .select('*')
          .eq('id', clipId)
          .single()

        if (clipError) throw new Error(`Failed to load clip: ${clipError.message}`)
        if (!clipData) throw new Error('Clip not found')

        // Fetch video
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('*')
          .eq('id', clipData.video_id ?? '')
          .single()

        if (videoError) throw new Error(`Failed to load video: ${videoError.message}`)

        // Fetch transcription
        let transcriptionData = null
        if (videoData?.id) {
          const { data: transData } = await supabase
            .from('transcriptions')
            .select('*')
            .eq('video_id', videoData.id)
            .single()
          transcriptionData = transData
        }

        // Fetch viral score
        const { data: scoreData } = await supabase
          .from('viral_scores')
          .select('*')
          .eq('clip_id', clipId)
          .single()

        // Get signed URL for video
        let videoUrl: string | null = null
        if (videoData?.storage_path) {
          const { data } = supabase.storage
            .from('videos')
            .getPublicUrl(videoData.storage_path)
          videoUrl = data.publicUrl
        }

        setState({
          clip: clipData,
          video: videoData,
          transcription: transcriptionData,
          viralScore: scoreData || null,
          videoUrl,
          loading: false,
          error: null,
        })

        // Set aspect ratio from clip
        if (clipData.aspect_ratio) {
          setEditorSettings((s) => ({
            ...s,
            aspectRatio: (clipData.aspect_ratio as '9:16' | '1:1' | '16:9') || '9:16',
          }))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load clip'
        setState((s) => ({ ...s, error: msg, loading: false }))
      }
    }

    loadClipData()
  }, [clipId])

  // ── Handle render ────────────────────────────────────────────────────

  const handleRender = useCallback(
    async (publishAfter: boolean = false) => {
      if (!state.clip) return

      setRendering(true)
      setRenderError(null)

      try {
        // Map editor settings to API format
        const apiSettings = {
          captions: {
            enabled: editorSettings.captionsEnabled,
            style: editorSettings.captionConfig.templateId,
            color: editorSettings.captionConfig.textColor,
            position: editorSettings.captionConfig.position,
            wordsPerLine: editorSettings.captionConfig.wordsPerLine,
            autoEmojis: editorSettings.autoEmojis,
            animation: editorSettings.captionAnimation,
          },
          splitScreen: {
            enabled: editorSettings.splitScreenEnabled,
            layout: editorSettings.splitScreenLayout,
            brollCategory: editorSettings.brollCategory,
            ratio: editorSettings.splitScreenRatio,
          },
          format: {
            aspectRatio: editorSettings.aspectRatio,
            smartZoom: editorSettings.smartZoom,
            smartReframe: editorSettings.smartReframe,
            facecamPosition: editorSettings.facecamPosition,
            backgroundBlur: editorSettings.backgroundBlur,
          },
          branding: {
            watermark: editorSettings.watermarkEnabled,
            watermarkPosition: editorSettings.watermarkPosition,
            creditText: editorSettings.creditText || null,
            brandTemplateId: editorSettings.brandTemplateId || null,
            brandLogoPath: editorSettings.brandLogoPath || null,
          },
        }

        const res = await fetch('/api/render', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clip_id: state.clip.id,
            settings: apiSettings,
          }),
        })

        const data = (await res.json()) as { error: string | null; message: string }

        if (!res.ok) {
          throw new Error(data.message || 'Render failed')
        }

        // Success
        if (publishAfter) {
          router.push(`/publish?clip_id=${state.clip.id}`)
        } else {
          // Download the rendered clip
          const downloadUrl = `/api/clips/download?clip_id=${state.clip.id}&format=${editorSettings.aspectRatio}`
          window.open(downloadUrl, '_blank')
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Render failed'
        setRenderError(msg)
      } finally {
        setRendering(false)
      }
    },
    [state.clip, editorSettings, router]
  )

  // ─────────────────────────────────────────────────────────────────────

  if (state.loading) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <Button variant="ghost" size="sm" className="gap-1.5" disabled>
          <ChevronLeft className="h-4 w-4" />
          Retour
        </Button>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Video preview skeleton */}
          <div className="lg:col-span-2 space-y-4">
            <Skeleton className="aspect-[9/16] rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </div>

          {/* Right: Tabs skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-10 rounded-lg" />
            <Skeleton className="h-96 rounded-xl" />
          </div>
        </div>

        <Skeleton className="h-12 rounded-xl" />
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
          Retour
        </Button>

        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-6 flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-destructive">Erreur</h3>
              <p className="text-sm text-muted-foreground mt-1">{state.error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.back()}
              >
                Retour aux clips
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!state.clip) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4" />
          Retour
        </Button>
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Clip not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const aspectRatioLabel = {
    '9:16': 'Vertical (TikTok/Reels)',
    '1:1': 'Carré (Instagram)',
    '16:9': 'Horizontal (YouTube)',
  }[editorSettings.aspectRatio]

  const BROLL_CATEGORIES = [
    'Parkour',
    'Satisfying (sand/slime)',
    'Minecraft',
    'Cooking',
    'Subway Surfers',
    'Custom',
  ]

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header with back button */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4" />
          Retour
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">
            {state.clip.title || `Clip ${state.clip.start_time.toFixed(1)}s`}
          </h1>
        </div>
        <ViralScoreBadge score={state.viralScore?.score ?? null} />
      </div>

      {/* Main grid: Left (video) + Right (controls) */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ────── LEFT PANEL: Video Preview ────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video Player */}
          {state.videoUrl ? (
            <Card className="bg-card/50 border-border overflow-hidden">
              <CardContent className="p-0">
                <VideoPlayer
                  ref={playerRef}
                  src={state.videoUrl}
                  className="w-full aspect-[9/16] max-h-96"
                />
              </CardContent>
            </Card>
          ) : (
            <Skeleton className="aspect-[9/16] rounded-xl" />
          )}

          {/* Timeline Editor */}
          {state.clip && state.video && (
            <Card className="bg-card/50 border-border">
              <CardContent className="p-4">
                <TimelineEditor
                  segments={[
                    {
                      id: state.clip.id,
                      start: state.clip.start_time,
                      end: state.clip.end_time,
                      title: state.clip.title,
                      score: state.viralScore?.score ?? null,
                    },
                  ]}
                  duration={state.video.duration_seconds || 300}
                  seedId={state.clip.id}
                  currentTime={undefined}
                  onSegmentsChange={(segs) => {
                    if (segs[0]) {
                      setState((s) => ({
                        ...s,
                        clip: s.clip
                          ? { ...s.clip, start_time: segs[0].start, end_time: segs[0].end }
                          : null,
                      }))
                    }
                  }}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* ────── RIGHT PANEL: Tabs ────── */}
        <div>
          <Tabs defaultValue="captions" className="w-full">
            <TabsList className="w-full grid grid-cols-4 gap-1 h-auto p-1 bg-muted/50">
              <TabsTrigger
                value="captions"
                className="gap-1.5 text-xs data-[state=active]:bg-background"
              >
                <Type className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sous-titres</span>
              </TabsTrigger>
              <TabsTrigger
                value="split"
                className="gap-1.5 text-xs data-[state=active]:bg-background"
              >
                <Copy className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Split</span>
              </TabsTrigger>
              <TabsTrigger
                value="format"
                className="gap-1.5 text-xs data-[state=active]:bg-background"
              >
                <Zap className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Format</span>
              </TabsTrigger>
              <TabsTrigger
                value="branding"
                className="gap-1.5 text-xs data-[state=active]:bg-background"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Marque</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Sous-titres */}
            <TabsContent value="captions" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="captions-toggle" className="text-sm font-medium">
                    Activer les sous-titres
                  </Label>
                  <Switch
                    id="captions-toggle"
                    checked={editorSettings.captionsEnabled}
                    onCheckedChange={(checked: boolean) => {
                      setEditorSettings((s) => ({ ...s, captionsEnabled: checked }))
                    }}
                  />
                </div>

                {editorSettings.captionsEnabled && (
                  <>
                    {/* Template selector */}
                    <div className="space-y-2">
                      <Label className="text-sm">Style de sous-titre</Label>
                      <Select
                        value={editorSettings.captionConfig.templateId}
                        onValueChange={(val: string) => {
                          setEditorSettings((s) => ({
                            ...s,
                            captionConfig: { ...s.captionConfig, templateId: val },
                          }))
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Select style" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hormozi">Hormozi (recommandé)</SelectItem>
                          <SelectItem value="aliabdaal">Ali Abdaal — Clean</SelectItem>
                          <SelectItem value="imangadzhi">Iman Gadzhi — Bold Gold</SelectItem>
                          <SelectItem value="mrbeast">MrBeast — Contrasté</SelectItem>
                          <SelectItem value="neon">Neon — Lumineux</SelectItem>
                          <SelectItem value="bold">Bold — Épais</SelectItem>
                          <SelectItem value="impact">Impact — Classique</SelectItem>
                          <SelectItem value="minimal">Minimal — Subtil</SelectItem>
                          <SelectItem value="default">Default — Standard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Animation */}
                    <div className="space-y-2">
                      <Label className="text-sm">Animation</Label>
                      <Select
                        value={editorSettings.captionAnimation}
                        onValueChange={(val: string) => {
                          setEditorSettings((s) => ({
                            ...s,
                            captionAnimation: val as EditorSettings['captionAnimation'],
                          }))
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Animation" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="highlight">Highlight (karaoké)</SelectItem>
                          <SelectItem value="pop">Pop (scale)</SelectItem>
                          <SelectItem value="bounce">Bounce (rebond)</SelectItem>
                          <SelectItem value="shake">Shake (tremblement)</SelectItem>
                          <SelectItem value="typewriter">Typewriter (machine à écrire)</SelectItem>
                          <SelectItem value="glow">Glow (halo lumineux)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Color picker */}
                    <div className="space-y-2">
                      <Label className="text-sm">Couleur du texte</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={editorSettings.captionConfig.textColor}
                          onChange={(e) => {
                            setEditorSettings((s) => ({
                              ...s,
                              captionConfig: {
                                ...s.captionConfig,
                                textColor: e.target.value,
                              },
                            }))
                          }}
                          className="h-8 w-12 rounded-lg border border-border cursor-pointer"
                        />
                        <span className="text-xs text-muted-foreground font-mono flex-1">
                          {editorSettings.captionConfig.textColor}
                        </span>
                      </div>
                    </div>

                    {/* Position */}
                    <div className="space-y-2">
                      <Label className="text-sm">Position</Label>
                      <Select
                        value={editorSettings.captionConfig.position}
                        onValueChange={(val: string) => {
                          setEditorSettings((s) => ({
                            ...s,
                            captionConfig: {
                              ...s.captionConfig,
                              position: val as 'top' | 'middle' | 'bottom',
                            },
                          }))
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Haut</SelectItem>
                          <SelectItem value="middle">Milieu</SelectItem>
                          <SelectItem value="bottom">Bas</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Words per line */}
                    <div className="space-y-2">
                      <Label className="text-sm">
                        Mots par ligne: {editorSettings.captionConfig.wordsPerLine}
                      </Label>
                      <Slider
                        value={[editorSettings.captionConfig.wordsPerLine]}
                        onValueChange={(v: number[]) => {
                          setEditorSettings((s) => ({
                            ...s,
                            captionConfig: { ...s.captionConfig, wordsPerLine: v[0] },
                          }))
                        }}
                        min={3}
                        max={8}
                        step={1}
                      />
                    </div>

                    {/* Auto emojis */}
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <Label htmlFor="auto-emojis" className="text-sm">
                          Auto emojis
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Insère des emojis contextuels dans les sous-titres
                        </p>
                      </div>
                      <Switch
                        id="auto-emojis"
                        checked={editorSettings.autoEmojis}
                        onCheckedChange={(checked: boolean) => {
                          setEditorSettings((s) => ({ ...s, autoEmojis: checked }))
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* TAB 2: Split Screen */}
            <TabsContent value="split" className="space-y-4 mt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="split-toggle" className="text-sm font-medium">
                    Activer split screen
                  </Label>
                  <Switch
                    id="split-toggle"
                    checked={editorSettings.splitScreenEnabled}
                    onCheckedChange={(checked: boolean) => {
                      setEditorSettings((s) => ({ ...s, splitScreenEnabled: checked }))
                    }}
                  />
                </div>

                {editorSettings.splitScreenEnabled && (
                  <>
                    {/* Layout */}
                    <div className="space-y-2">
                      <Label className="text-sm">Disposition</Label>
                      <Select
                        value={editorSettings.splitScreenLayout}
                        onValueChange={(val: string) => {
                          setEditorSettings((s) => ({
                            ...s,
                            splitScreenLayout: val as 'top-bottom' | 'side-by-side' | 'pip',
                          }))
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Layout" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top-bottom">Haut/Bas</SelectItem>
                          <SelectItem value="side-by-side">Côte à côte</SelectItem>
                          <SelectItem value="pip">Picture in Picture</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* B-Roll category */}
                    <div className="space-y-2">
                      <Label className="text-sm">Catégorie B-Roll</Label>
                      <Select
                        value={editorSettings.brollCategory}
                        onValueChange={(val: string) => {
                          setEditorSettings((s) => ({ ...s, brollCategory: val }))
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                          {BROLL_CATEGORIES.map((cat) => (
                            <SelectItem key={cat} value={cat.toLowerCase()}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Ratio */}
                    <div className="space-y-2">
                      <Label className="text-sm">
                        Ratio: {editorSettings.splitScreenRatio}% / {100 - editorSettings.splitScreenRatio}%
                      </Label>
                      <Slider
                        value={[editorSettings.splitScreenRatio]}
                        onValueChange={(v: number[]) => {
                          setEditorSettings((s) => ({ ...s, splitScreenRatio: v[0] }))
                        }}
                        min={30}
                        max={70}
                        step={5}
                      />
                    </div>
                  </>
                )}
              </div>
            </TabsContent>

            {/* TAB 3: Format */}
            <TabsContent value="format" className="space-y-4 mt-4">
              <div className="space-y-3">
                {/* Aspect ratio */}
                <div className="space-y-2">
                  <Label className="text-sm">Format d&apos;écran</Label>
                  <Select
                    value={editorSettings.aspectRatio}
                    onValueChange={(val: string) => {
                      setEditorSettings((s) => ({
                        ...s,
                        aspectRatio: val as '9:16' | '1:1' | '16:9',
                      }))
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Aspect ratio" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="9:16">Vertical (9:16)</SelectItem>
                      <SelectItem value="1:1">Carré (1:1)</SelectItem>
                      <SelectItem value="16:9">Horizontal (16:9)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{aspectRatioLabel}</p>
                </div>

                {/* Smart zoom */}
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="smart-zoom" className="text-sm">
                    Smart Zoom
                  </Label>
                  <Switch
                    id="smart-zoom"
                    checked={editorSettings.smartZoom}
                    onCheckedChange={(checked: boolean) => {
                      setEditorSettings((s) => ({ ...s, smartZoom: checked }))
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Zoom automatiquement sur le visage du locuteur
                </p>

                {/* Smart Reframe */}
                <div className="flex items-center justify-between py-2">
                  <div>
                    <Label htmlFor="smart-reframe" className="text-sm">
                      Smart Reframe
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Alterne le crop entre facecam et gameplay (streams)
                    </p>
                  </div>
                  <Switch
                    id="smart-reframe"
                    checked={editorSettings.smartReframe}
                    onCheckedChange={(checked: boolean) => {
                      setEditorSettings((s) => ({ ...s, smartReframe: checked }))
                    }}
                  />
                </div>

                {editorSettings.smartReframe && (
                  <div className="space-y-2">
                    <Label className="text-sm">Position de la facecam</Label>
                    <Select
                      value={editorSettings.facecamPosition}
                      onValueChange={(val: string) => {
                        setEditorSettings((s) => ({
                          ...s,
                          facecamPosition: val as EditorSettings['facecamPosition'],
                        }))
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Position facecam" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bottom-left">Bas-gauche (défaut OBS)</SelectItem>
                        <SelectItem value="bottom-right">Bas-droit</SelectItem>
                        <SelectItem value="top-left">Haut-gauche</SelectItem>
                        <SelectItem value="top-right">Haut-droit</SelectItem>
                        <SelectItem value="none">Pas de facecam</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Background blur */}
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="bg-blur" className="text-sm">
                    Flou du fond
                  </Label>
                  <Switch
                    id="bg-blur"
                    checked={editorSettings.backgroundBlur}
                    onCheckedChange={(checked: boolean) => {
                      setEditorSettings((s) => ({ ...s, backgroundBlur: checked }))
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Floute les zones letterbox
                </p>
              </div>
            </TabsContent>

            {/* TAB 4: Branding */}
            <TabsContent value="branding" className="space-y-4 mt-4">
              <div className="space-y-3">
                {/* Brand Kit */}
                {brandTemplates.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Brand Kit</Label>
                    <div className="space-y-1.5">
                      {brandTemplates.map((tmpl) => (
                        <button
                          key={tmpl.id}
                          type="button"
                          onClick={() => {
                            setEditorSettings((s) => ({
                              ...s,
                              brandTemplateId: tmpl.id,
                              brandLogoPath: tmpl.logo_path ?? tmpl.watermark_path ?? null,
                              watermarkEnabled: !!(tmpl.logo_path || tmpl.watermark_path),
                              introOutroEnabled: !!(tmpl.intro_video_path || tmpl.outro_video_path),
                            }))
                          }}
                          className={cn(
                            'w-full flex items-center gap-2.5 p-2.5 rounded-lg border transition-all text-left',
                            editorSettings.brandTemplateId === tmpl.id
                              ? 'border-primary/50 bg-primary/5'
                              : 'border-border hover:border-primary/30 bg-card/30'
                          )}
                        >
                          <div className="flex gap-1 shrink-0">
                            {tmpl.primary_color && (
                              <div className="w-4 h-4 rounded-full border border-border/50" style={{ backgroundColor: tmpl.primary_color }} />
                            )}
                            {tmpl.secondary_color && (
                              <div className="w-4 h-4 rounded-full border border-border/50" style={{ backgroundColor: tmpl.secondary_color }} />
                            )}
                          </div>
                          <span className="text-xs font-medium text-foreground flex-1 truncate">{tmpl.name}</span>
                          {tmpl.is_default && (
                            <span className="text-[10px] text-yellow-400 font-medium">Défaut</span>
                          )}
                          {tmpl.logo_path && (
                            <span className="text-[10px] text-muted-foreground">Logo</span>
                          )}
                        </button>
                      ))}
                    </div>
                    {editorSettings.brandTemplateId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => setEditorSettings((s) => ({
                          ...s,
                          brandTemplateId: null,
                          brandLogoPath: null,
                        }))}
                      >
                        Retirer le brand kit
                      </Button>
                    )}
                  </div>
                )}

                {/* Watermark */}
                <div className="flex items-center justify-between">
                  <Label htmlFor="watermark-toggle" className="text-sm font-medium">
                    Logo (watermark)
                  </Label>
                  <Switch
                    id="watermark-toggle"
                    checked={editorSettings.watermarkEnabled}
                    onCheckedChange={(checked: boolean) => {
                      setEditorSettings((s) => ({ ...s, watermarkEnabled: checked }))
                    }}
                  />
                </div>

                {editorSettings.watermarkEnabled && (
                  <div className="space-y-2">
                    <Label className="text-sm">Position du logo</Label>
                    <Select
                      value={editorSettings.watermarkPosition}
                      onValueChange={(val: string) => {
                        setEditorSettings((s) => ({
                          ...s,
                          watermarkPosition: val as 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right',
                        }))
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="top-left">Haut-gauche</SelectItem>
                        <SelectItem value="top-right">Haut-droit</SelectItem>
                        <SelectItem value="bottom-left">Bas-gauche</SelectItem>
                        <SelectItem value="bottom-right">Bas-droit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Intro/Outro */}
                <div className="flex items-center justify-between py-2">
                  <Label htmlFor="intro-outro" className="text-sm">
                    Intro / Outro
                  </Label>
                  <Switch
                    id="intro-outro"
                    checked={editorSettings.introOutroEnabled}
                    onCheckedChange={(checked: boolean) => {
                      setEditorSettings((s) => ({ ...s, introOutroEnabled: checked }))
                    }}
                  />
                </div>

                {/* Credit text */}
                <div className="space-y-2">
                  <Label htmlFor="credit" className="text-sm">
                    Crédit (créateur original)
                  </Label>
                  <input
                    id="credit"
                    type="text"
                    placeholder="ex: @username sur TikTok"
                    value={editorSettings.creditText}
                    onChange={(e) => {
                      setEditorSettings((s) => ({ ...s, creditText: e.target.value }))
                    }}
                    className="w-full px-2 py-1.5 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Error message */}
      {renderError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Erreur de rendu</p>
              <p className="text-sm text-muted-foreground mt-0.5">{renderError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom action bar */}
      <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 -mx-4 px-4 flex items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {state.viralScore?.score && (
            <span>Score viral: {state.viralScore.score}/100</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={() => setRemakeOpen(true)}
          >
            <Wand2 className="h-4 w-4" />
            Remake This
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={rendering}
            onClick={() => handleRender(false)}
          >
            {rendering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {rendering ? 'En cours…' : 'Télécharger'}
          </Button>

          <Button
            size="sm"
            className="gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            disabled={rendering}
            onClick={() => handleRender(true)}
          >
            {rendering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Share2 className="h-4 w-4" />
            )}
            {rendering ? 'En cours…' : 'Publier'}
          </Button>
        </div>
      </div>

      {/* Remake Modal */}
      {state.clip && (
        <RemakeModal
          clip={{
            id: state.clip.id,
            video_id: state.clip.video_id,
            user_id: state.clip.user_id ?? null,
            title: state.clip.title,
            start_time: state.clip.start_time,
            end_time: state.clip.end_time,
            duration_seconds: state.clip.duration_seconds,
            storage_path: state.clip.storage_path,
            thumbnail_path: state.clip.thumbnail_path,
            thumbnail_url: null,
            transcript_segment: state.clip.transcript_segment,
            caption_template: state.clip.caption_template ?? null,
            aspect_ratio: state.clip.aspect_ratio,
            status: state.clip.status as 'pending' | 'rendering' | 'done' | 'error',
            error_message: state.clip.error_message ?? null,
            is_remake: state.clip.is_remake,
            parent_clip_id: state.clip.parent_clip_id ?? null,
            created_at: state.clip.created_at ?? null,
            updated_at: state.clip.updated_at ?? null,
            viral_scores: state.viralScore
              ? [{
                  score: state.viralScore.score,
                  hook_strength: state.viralScore.hook_strength,
                  emotional_flow: state.viralScore.emotional_flow,
                  perceived_value: state.viralScore.perceived_value,
                  trend_alignment: state.viralScore.trend_alignment,
                  hook_type: state.viralScore.hook_type as 'curiosity' | 'shock' | 'storytelling' | 'transformation' | null,
                  explanation: state.viralScore.explanation,
                  suggested_hooks: state.viralScore.suggested_hooks,
                }]
              : [],
          }}
          open={remakeOpen}
          onClose={() => setRemakeOpen(false)}
        />
      )}
    </div>
  )
}
