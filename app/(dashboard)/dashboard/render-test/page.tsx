'use client'

import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Play, RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Test Presets ────────────────────────────────────────────────────────────
// Each preset defines a unique combination of settings to test

interface TestPreset {
  id: string
  label: string
  description: string
  color: string
  settings: Record<string, unknown>
}

const TEST_PRESETS: TestPreset[] = [
  {
    id: 'baseline',
    label: 'Baseline',
    description: 'No effects — just vertical crop',
    color: 'border-zinc-500',
    settings: {
      captions: { enabled: false },
      splitScreen: { enabled: false },
      tag: { style: 'none' },
      hook: { enabled: false },
      format: { aspectRatio: '9:16', videoZoom: 'fill' },
    },
  },
  {
    id: 'captions-hormozi',
    label: 'Captions Hormozi',
    description: 'Hormozi highlight style captions',
    color: 'border-blue-500',
    settings: {
      captions: { enabled: true, style: 'hormozi', animation: 'highlight', position: 'bottom', wordsPerLine: 4 },
      splitScreen: { enabled: false },
      tag: { style: 'none' },
      hook: { enabled: false },
      format: { aspectRatio: '9:16', videoZoom: 'fill' },
    },
  },
  {
    id: 'captions-wordpop',
    label: 'Captions Word-Pop',
    description: 'Word-pop animation captions',
    color: 'border-purple-500',
    settings: {
      captions: { enabled: true, style: 'hormozi', animation: 'word-pop', position: 'bottom', wordsPerLine: 3 },
      splitScreen: { enabled: false },
      tag: { style: 'none' },
      hook: { enabled: false },
      format: { aspectRatio: '9:16', videoZoom: 'fill' },
    },
  },
  {
    id: 'split-minecraft',
    label: 'Split Screen',
    description: 'Captions + Minecraft split-screen',
    color: 'border-green-500',
    settings: {
      captions: { enabled: true, style: 'hormozi', animation: 'highlight', position: 'bottom', wordsPerLine: 4 },
      splitScreen: { enabled: true, brollCategory: 'minecraft-parkour', ratio: 50, layout: 'top-bottom' },
      tag: { style: 'none' },
      hook: { enabled: false },
      format: { aspectRatio: '9:16', videoZoom: 'fill' },
    },
  },
  {
    id: 'tag-modern',
    label: 'Tag Overlay',
    description: 'Captions + streamer tag',
    color: 'border-yellow-500',
    settings: {
      captions: { enabled: true, style: 'hormozi', animation: 'highlight', position: 'bottom', wordsPerLine: 4 },
      splitScreen: { enabled: false },
      tag: { style: 'modern', size: 100 },
      hook: { enabled: false },
      format: { aspectRatio: '9:16', videoZoom: 'fill' },
    },
  },
  {
    id: 'full-combo',
    label: 'Full Combo',
    description: 'Captions + split-screen + tag + hook',
    color: 'border-red-500',
    settings: {
      captions: { enabled: true, style: 'hormozi', animation: 'highlight', position: 'bottom', wordsPerLine: 4 },
      splitScreen: { enabled: true, brollCategory: 'minecraft-parkour', ratio: 50, layout: 'top-bottom' },
      tag: { style: 'modern', size: 100 },
      hook: { enabled: true, textEnabled: true, text: 'WAIT FOR IT...', style: 'choc', length: 1.5 },
      format: { aspectRatio: '9:16', videoZoom: 'fill' },
    },
  },
  {
    id: 'blur-bg',
    label: 'Blur Background',
    description: 'Blurred background fill (contain)',
    color: 'border-indigo-500',
    settings: {
      captions: { enabled: true, style: 'hormozi', animation: 'highlight', position: 'bottom', wordsPerLine: 4 },
      splitScreen: { enabled: false },
      tag: { style: 'none' },
      hook: { enabled: false },
      format: { aspectRatio: '9:16', videoZoom: 'contain', backgroundBlur: true },
    },
  },
  {
    id: 'square-format',
    label: '1:1 Square',
    description: 'Square format with captions',
    color: 'border-pink-500',
    settings: {
      captions: { enabled: true, style: 'hormozi', animation: 'highlight', position: 'bottom', wordsPerLine: 4 },
      splitScreen: { enabled: false },
      tag: { style: 'none' },
      hook: { enabled: false },
      format: { aspectRatio: '1:1', videoZoom: 'fill' },
    },
  },
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestClip {
  id: string
  title: string | null
  author_name: string | null
  external_url: string
  platform: string
  velocity_score: number | null
  thumbnail_url: string | null
}

interface PreviewResult {
  presetId: string
  status: 'pending' | 'rendering' | 'done' | 'error'
  videoUrl: string | null
  renderTime: number | null
  error: string | null
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RenderTestPage() {
  const [clips, setClips] = useState<TestClip[]>([])
  const [selectedClip, setSelectedClip] = useState<TestClip | null>(null)
  const [loadingClips, setLoadingClips] = useState(true)
  const [results, setResults] = useState<Record<string, PreviewResult>>({})
  const [renderingAll, setRenderingAll] = useState(false)

  // Fetch a few real clips from DB
  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('trending_clips')
        .select('id, title, author_name, external_url, platform, velocity_score, thumbnail_url')
        .order('velocity_score', { ascending: false })
        .limit(12)

      if (data && data.length > 0) {
        setClips(data)
        setSelectedClip(data[0])
      }
      setLoadingClips(false)
    }
    load()
  }, [])

  // Render a single preset
  const renderPreset = useCallback(async (preset: TestPreset) => {
    if (!selectedClip) return

    setResults(prev => ({
      ...prev,
      [preset.id]: { presetId: preset.id, status: 'rendering', videoUrl: null, renderTime: null, error: null },
    }))

    try {
      const res = await fetch('/api/render/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrl: selectedClip.external_url,
          source: 'trending',
          clipTitle: selectedClip.title || 'Test Clip',
          settings: {
            ...preset.settings,
            tag: {
              ...(preset.settings.tag as Record<string, unknown>),
              authorName: selectedClip.author_name || 'Streamer',
              authorHandle: selectedClip.author_name || 'streamer',
            },
          },
        }),
      })

      const json = await res.json()

      if (!res.ok || !json.data?.video) {
        throw new Error(json.error || 'Render failed')
      }

      // Convert base64 to blob URL
      const byteChars = atob(json.data.video)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'video/mp4' })
      const url = URL.createObjectURL(blob)

      setResults(prev => ({
        ...prev,
        [preset.id]: {
          presetId: preset.id,
          status: 'done',
          videoUrl: url,
          renderTime: json.data.renderTime,
          error: null,
        },
      }))
    } catch (err) {
      setResults(prev => ({
        ...prev,
        [preset.id]: {
          presetId: preset.id,
          status: 'error',
          videoUrl: null,
          renderTime: null,
          error: err instanceof Error ? err.message : 'Unknown error',
        },
      }))
    }
  }, [selectedClip])

  // Render all presets sequentially
  const renderAll = useCallback(async () => {
    setRenderingAll(true)
    setResults({})
    for (const preset of TEST_PRESETS) {
      await renderPreset(preset)
    }
    setRenderingAll(false)
  }, [renderPreset])

  if (loadingClips) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Render Test Lab</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick a clip, hit &quot;Render All&quot;, and compare 8 different FFmpeg configurations side by side.
        </p>
      </div>

      {/* Clip Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Select test clip</label>
        <div className="flex gap-2 flex-wrap">
          {clips.map(clip => (
            <button
              key={clip.id}
              onClick={() => { setSelectedClip(clip); setResults({}) }}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium border transition-all text-left max-w-[220px] truncate',
                selectedClip?.id === clip.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-card hover:border-primary/30 text-muted-foreground'
              )}
            >
              <span className="block truncate">{clip.title || 'Untitled'}</span>
              <span className="text-[10px] opacity-60">{clip.author_name} · {clip.velocity_score?.toFixed(0) ?? '--'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          onClick={renderAll}
          disabled={!selectedClip || renderingAll}
          className="bg-gradient-to-r from-blue-600 to-indigo-600"
        >
          {renderingAll ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" />Rendering...</>
          ) : (
            <><Play className="h-4 w-4 mr-2" />Render All ({TEST_PRESETS.length} presets)</>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => setResults({})}
          disabled={renderingAll || Object.keys(results).length === 0}
        >
          <RefreshCw className="h-4 w-4 mr-2" />Clear
        </Button>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {TEST_PRESETS.map(preset => {
          const result = results[preset.id]

          return (
            <Card key={preset.id} className={cn('overflow-hidden border-2 transition-colors', preset.color, result?.status === 'error' && 'border-red-500/50')}>
              <CardContent className="p-0">
                {/* Video area */}
                <div className="relative aspect-[9/16] bg-black/80 flex items-center justify-center max-h-[320px]">
                  {result?.status === 'done' && result.videoUrl ? (
                    <video
                      src={result.videoUrl}
                      controls
                      autoPlay
                      loop
                      muted
                      playsInline
                      className="w-full h-full object-contain"
                    />
                  ) : result?.status === 'rendering' ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                      <span className="text-xs text-muted-foreground">Rendering...</span>
                    </div>
                  ) : result?.status === 'error' ? (
                    <div className="flex flex-col items-center gap-2 px-4 text-center">
                      <XCircle className="h-8 w-8 text-red-400" />
                      <span className="text-xs text-red-400 line-clamp-3">{result.error}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Play className="h-8 w-8 text-muted-foreground/30" />
                      <span className="text-xs text-muted-foreground/50">Waiting</span>
                    </div>
                  )}
                </div>

                {/* Info footer */}
                <div className="p-3 space-y-1 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{preset.label}</span>
                    {result?.status === 'done' && (
                      <span className="flex items-center gap-1 text-[10px] text-green-400">
                        <CheckCircle className="h-3 w-3" />
                        {result.renderTime?.toFixed(1)}s
                      </span>
                    )}
                    {result?.status === 'rendering' && (
                      <span className="flex items-center gap-1 text-[10px] text-blue-400">
                        <Clock className="h-3 w-3 animate-pulse" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{preset.description}</p>

                  {/* Render single button */}
                  {!renderingAll && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full mt-1 h-7 text-xs"
                      onClick={() => renderPreset(preset)}
                      disabled={!selectedClip || result?.status === 'rendering'}
                    >
                      {result?.status === 'rendering' ? 'Rendering...' : result?.status === 'done' ? 'Re-render' : 'Render this'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Summary */}
      {Object.keys(results).length > 0 && (
        <div className="rounded-lg border border-border bg-card/50 p-4">
          <h3 className="text-sm font-semibold mb-2">Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {TEST_PRESETS.map(preset => {
              const r = results[preset.id]
              return (
                <div key={preset.id} className="flex items-center gap-2">
                  {r?.status === 'done' ? (
                    <CheckCircle className="h-3.5 w-3.5 text-green-400 shrink-0" />
                  ) : r?.status === 'error' ? (
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  ) : r?.status === 'rendering' ? (
                    <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin shrink-0" />
                  ) : (
                    <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                  )}
                  <span className="truncate">{preset.label}</span>
                  {r?.renderTime && <span className="text-muted-foreground ml-auto">{r.renderTime.toFixed(1)}s</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
