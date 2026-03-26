"use client"

import { useState, useCallback, useRef } from 'react'
import { Sparkles, CheckCircle2, Circle, Loader2, AlertCircle, RotateCcw, Scissors, Download, Trash2, CheckSquare, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { UploadZone } from '@/components/video/upload-zone'
import { ClipCard } from '@/components/clips/clip-card'
import { VideoPlayer, type VideoPlayerHandle } from '@/components/video/video-player'
import { useVideoStore } from '@/stores/video-store'
import { useClipsStore, type GeneratedClip } from '@/stores/clips-store'
import { cn } from '@/lib/utils'
import type { AspectRatio } from '@/lib/ffmpeg/reframe'
import { parseSrtToWordTimestamps, parseSrt, srtToFullText, srtToTranscriptionSegments } from '@/lib/captions/srt-parser'

// ─── Import by URL ───────────────────────────────────────────────────────────

async function importUrl(url: string): Promise<string> {
  const res = await fetch('/api/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json() as { data: { video_id: string } | null; error: string | null; message: string }
  if (!res.ok || !data.data) throw new Error(data.message ?? 'Import failed')
  return data.data.video_id
}

// ─── Poll video status until VPS finishes downloading ────────────────────────

async function waitForVideoReady(videoId: string, maxWaitMs = 180_000): Promise<void> {
  const start = Date.now()
  const interval = 3_000 // poll every 3 seconds

  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, interval))

    const res = await fetch(`/api/videos/status?video_id=${videoId}`)
    if (!res.ok) continue

    const { data } = await res.json() as { data: { status: string; error_message?: string } | null }
    if (!data) continue

    if (data.status === 'uploaded' || data.status === 'transcribing' || data.status === 'analyzing' || data.status === 'done') {
      return // video is ready
    }
    if (data.status === 'error') {
      throw new Error(data.error_message || 'Le téléchargement de la vidéo a échoué sur le serveur')
    }
    // still 'processing' — keep polling
  }

  throw new Error('Le téléchargement prend trop de temps (> 3 min). Réessayez plus tard.')
}

// ─── Upload with XHR progress ───────────────────────────────────────────────

function uploadFile(file: File, onProgress: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const res = JSON.parse(xhr.responseText) as { data: { video_id: string } | null; error: string | null }
        if (res.error || !res.data) {
          reject(new Error(res.error ?? 'Upload failed'))
        } else {
          resolve(res.data.video_id)
        }
      } else {
        let msg = `Upload failed (${xhr.status})`
        try {
          const res = JSON.parse(xhr.responseText) as { message?: string }
          if (res.message) msg = res.message
        } catch { /* ignore */ }
        reject(new Error(msg))
      }
    })

    xhr.addEventListener('error', () => reject(new Error('Erreur réseau lors de l\'upload')))
    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  })
}

// ─── Processing steps UI ────────────────────────────────────────────────────

type Step = { id: string; label: string; sublabel?: string }

const STEPS: Step[] = [
  { id: 'uploading',    label: 'Upload',        sublabel: 'Envoi du fichier…' },
  { id: 'transcribing', label: 'Transcription', sublabel: 'OpenAI Whisper…' },
  { id: 'analyzing',   label: 'Analyse IA',     sublabel: 'Hook Hunter · Retention · SEO…' },
  { id: 'rendering',   label: 'Rendu vidéo',    sublabel: 'FFmpeg — découpe + sous-titres…' },
  { id: 'done',        label: 'Clips prêts !',  sublabel: undefined },
]

type ProcessingStepId = typeof STEPS[number]['id']

function StepRow({
  step,
  status,
  progress,
}: {
  step: Step
  status: 'pending' | 'active' | 'done' | 'error'
  progress?: number
}) {
  return (
    <div className={cn('flex items-center gap-3 py-2', status === 'pending' && 'opacity-40')}>
      <div className="shrink-0 w-6 flex justify-center">
        {status === 'done' && <CheckCircle2 className="h-5 w-5 text-green-400" />}
        {status === 'active' && <Loader2 className="h-5 w-5 text-primary animate-spin" />}
        {status === 'error' && <AlertCircle className="h-5 w-5 text-destructive" />}
        {status === 'pending' && <Circle className="h-5 w-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{step.label}</p>
        {step.sublabel && status === 'active' && (
          <p className="text-xs text-muted-foreground">{step.sublabel}</p>
        )}
        {step.id === 'uploading' && status === 'active' && typeof progress === 'number' && (
          <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
      {step.id === 'uploading' && status === 'active' && typeof progress === 'number' && (
        <span className="text-xs font-medium text-muted-foreground shrink-0">{progress}%</span>
      )}
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function CreatePage() {
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [url, setUrl] = useState('')
  const [srtFile, setSrtFile] = useState<File | null>(null)
  const [removeFiller, setRemoveFiller] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedClips, setSelectedClips] = useState<Set<string>>(new Set())
  const [batchDeleting, setBatchDeleting] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const playerRef = useRef<VideoPlayerHandle>(null)

  const {
    setCurrentVideoId,
    processingStep,
    setProcessingStep,
    uploadProgress,
    setUploadProgress,
    errorMessage,
    setErrorMessage,
    reset: resetVideo,
  } = useVideoStore()

  const { generatedClips, setGeneratedClips, clearClips } = useClipsStore()

  const isProcessing = ['uploading', 'transcribing', 'analyzing', 'rendering'].includes(processingStep)
  const isDone = processingStep === 'done'
  const hasError = processingStep === 'error'

  // ── Pipeline ──────────────────────────────────────────────────────────────

  const runPipeline = useCallback(async (sourceUrl?: string) => {
    const effectiveUrl = sourceUrl ?? (url && !pendingFile ? url : undefined)
    if (!pendingFile && !effectiveUrl) return

    setErrorMessage(null)
    clearClips()

    try {
      // Step 1 — Upload or URL import
      setProcessingStep('uploading')
      setUploadProgress(0)

      let videoId: string
      if (effectiveUrl) {
        videoId = await importUrl(effectiveUrl)
        setUploadProgress(30)
        // Wait for VPS to finish downloading + uploading the video
        await waitForVideoReady(videoId)
        setUploadProgress(100)
      } else {
        videoId = await uploadFile(pendingFile!, (pct) => setUploadProgress(pct))
        setUploadProgress(100)
      }
      setCurrentVideoId(videoId)

      // Fetch signed URL for video player (non-blocking)
      fetch(`/api/videos/url?video_id=${videoId}`)
        .then((r) => r.json())
        .then((d: { data: { url: string } | null }) => { if (d.data?.url) setVideoUrl(d.data.url) })
        .catch(() => null)

      // Step 2 — Transcription (skip Whisper if SRT provided)
      setProcessingStep('transcribing')

      if (srtFile) {
        // Parse SRT client-side and send pre-parsed data to skip Whisper
        const srtContent = await srtFile.text()
        const srtSegments = parseSrt(srtContent)
        const wordTimestamps = parseSrtToWordTimestamps(srtContent)
        const fullText = srtToFullText(srtSegments)
        const segments = srtToTranscriptionSegments(srtSegments)

        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            video_id: videoId,
            srt_data: { full_text: fullText, segments, word_timestamps: wordTimestamps },
          }),
        })
        const transcribeData = await transcribeRes.json() as { error: string | null; message: string }
        if (!transcribeRes.ok) throw new Error(transcribeData.message ?? 'SRT import failed')
      } else {
        const transcribeRes = await fetch('/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId }),
        })
        const transcribeData = await transcribeRes.json() as { error: string | null; message: string }
        if (!transcribeRes.ok) throw new Error(transcribeData.message ?? 'Transcription failed')
      }

      // Step 3 — Analyse IA
      setProcessingStep('analyzing')

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ video_id: videoId }),
      })
      const analyzeData = await analyzeRes.json() as { error: string | null; message: string }
      if (!analyzeRes.ok) throw new Error(analyzeData.message ?? 'Analysis failed')

      // Step 4 — Fetch clips with viral scores
      const clipsRes = await fetch(`/api/clips?video_id=${videoId}`)
      const clipsData = await clipsRes.json() as { data: GeneratedClip[] | null; error: string | null }
      if (!clipsRes.ok || !clipsData.data) throw new Error(clipsData.error ?? 'Failed to load clips')

      setGeneratedClips(clipsData.data)

      // Step 5 — Fire render jobs (fire-and-forget, VPS updates DB when done)
      setProcessingStep('rendering')
      await Promise.allSettled(
        clipsData.data.map((clip) =>
          fetch('/api/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clip_id: clip.id }),
          })
        )
      )

      // Poll until all clips are done or errored (VPS renders in background)
      const clipIds = clipsData.data.map((c) => c.id)
      const maxPollMs = 300_000 // 5 minutes max
      const pollInterval = 3_000 // every 3 seconds
      const pollStart = Date.now()

      while (Date.now() - pollStart < maxPollMs) {
        await new Promise((r) => setTimeout(r, pollInterval))

        const pollRes = await fetch(`/api/clips?video_id=${videoId}`)
        const pollData = await pollRes.json() as { data: GeneratedClip[] | null }
        if (!pollData.data) continue

        setGeneratedClips(pollData.data)

        // Check if all clips are terminal (done or error)
        const allDone = pollData.data
          .filter((c) => clipIds.includes(c.id))
          .every((c) => c.status === 'done' || c.status === 'error')

        if (allDone) break
      }

      setProcessingStep('done')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      setErrorMessage(msg)
      setProcessingStep('error')
    }
  }, [
    pendingFile,
    url,
    srtFile,
    setCurrentVideoId,
    setProcessingStep,
    setUploadProgress,
    setErrorMessage,
    clearClips,
    setGeneratedClips,
  ])

  const handleUrlImport = useCallback((importedUrl: string) => {
    runPipeline(importedUrl)
  }, [runPipeline])

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    setPendingFile(null)
    setUrl('')
    setSrtFile(null)
    setVideoUrl(null)
    resetVideo()
    clearClips()
    setSelectedClips(new Set())
    setBatchMode(false)
  }, [resetVideo, clearClips])

  // ── Batch operations ──────────────────────────────────────────────────────

  const handleSelectClip = useCallback((id: string, selected: boolean) => {
    setSelectedClips((prev) => {
      const next = new Set(prev)
      if (selected) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    if (selectedClips.size === generatedClips.length) {
      setSelectedClips(new Set())
    } else {
      setSelectedClips(new Set(generatedClips.map((c) => c.id)))
    }
  }, [selectedClips.size, generatedClips])

  const handleBatchDownload = useCallback(() => {
    generatedClips
      .filter((c) => selectedClips.has(c.id) && c.storage_path)
      .forEach((c) => window.open(`/api/clips/download?clip_id=${c.id}`, '_blank'))
  }, [generatedClips, selectedClips])

  const handleBatchDelete = useCallback(async () => {
    if (selectedClips.size === 0) return
    setBatchDeleting(true)
    try {
      await Promise.all(
        Array.from(selectedClips).map((id) =>
          fetch(`/api/clips?id=${id}`, { method: 'DELETE' })
        )
      )
      setGeneratedClips(generatedClips.filter((c) => !selectedClips.has(c.id)))
      setSelectedClips(new Set())
    } finally {
      setBatchDeleting(false)
    }
  }, [selectedClips, generatedClips, setGeneratedClips])

  // ── Download handler ──────────────────────────────────────────────────────

  const handleDownload = useCallback(async (clip: GeneratedClip, format: AspectRatio = '9:16') => {
    if (!clip.storage_path) return
    window.open(`/api/clips/download?clip_id=${clip.id}&format=${format}`, '_blank')
  }, [])

  // ── Preview handler — jump player to clip segment ─────────────────────────

  const handlePreview = useCallback((clip: GeneratedClip) => {
    if (playerRef.current && videoUrl) {
      playerRef.current.playClip(clip.start_time, clip.end_time)
      // Scroll to player
      document.getElementById('video-player-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [videoUrl])

  // ── Step status helper ────────────────────────────────────────────────────

  const getStepStatus = (stepId: ProcessingStepId): 'pending' | 'active' | 'done' | 'error' => {
    const order: ProcessingStepId[] = ['uploading', 'transcribing', 'analyzing', 'rendering', 'done']
    const currentIdx = order.indexOf(processingStep as ProcessingStepId)
    const stepIdx = order.indexOf(stepId)

    if (hasError && processingStep === 'error') {
      // Mark the last active step as error, prior steps as done
      if (stepIdx < currentIdx - 1) return 'done'
      if (stepIdx === currentIdx - 1) return 'error'
      return 'pending'
    }

    if (stepIdx < currentIdx) return 'done'
    if (stepIdx === currentIdx) return 'active'
    return 'pending'
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transformer une vidéo</h1>
          <p className="text-muted-foreground mt-1">
            Uploadez une vidéo pour générer des clips viraux avec l&apos;IA.
          </p>
        </div>
        {(isDone || hasError) && (
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2 shrink-0 mt-1">
            <RotateCcw className="h-4 w-4" />
            Nouvelle vidéo
          </Button>
        )}
      </div>

      {/* ── Upload / URL section (shown when idle or error) ── */}
      {!isProcessing && !isDone && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="bg-card/50 backdrop-blur-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Upload local</CardTitle>
              <CardDescription>Glissez-déposez ou sélectionnez votre vidéo.</CardDescription>
            </CardHeader>
            <CardContent>
              <UploadZone
                selectedFile={pendingFile}
                onFileSelect={setPendingFile}
                onFileClear={() => setPendingFile(null)}
                uploadProgress={uploadProgress}
                isUploading={isProcessing}
                url={url}
                onUrlChange={setUrl}
                onUrlImport={handleUrlImport}
                disabled={isProcessing}
              />
            </CardContent>
          </Card>

          <Card className="bg-card/50 backdrop-blur-sm border-border flex flex-col justify-between">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Comment ça marche</CardTitle>
              <CardDescription>Pipeline IA en 3 étapes automatiques</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs flex items-center justify-center font-bold mt-0.5">1</span>
                <span><strong className="text-foreground">Transcription</strong> — Whisper analyse l&apos;audio et génère des timestamps mot-par-mot</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center font-bold mt-0.5">2</span>
                <span><strong className="text-foreground">4 Skills Claude</strong> — Hook Hunter, Retention Editor, Copywriter SEO et Credit Manager en parallèle</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs flex items-center justify-center font-bold mt-0.5">3</span>
                <span><strong className="text-foreground">Virality Score</strong> — Chaque clip reçoit un score 0-100 basé sur le hook, la rétention et la valeur perçue</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Error message ── */}
      {hasError && errorMessage && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Erreur</p>
              <p className="text-sm text-muted-foreground mt-0.5">{errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Options + Generate button ── */}
      {!isProcessing && !isDone && (
        <div className="space-y-3">
          {/* SRT import (optional) */}
          <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/40">
            <FileText className={cn('h-4 w-4 shrink-0', srtFile ? 'text-primary' : 'text-muted-foreground')} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Importer vos sous-titres (.srt)</p>
              <p className="text-xs text-muted-foreground">
                {srtFile
                  ? srtFile.name
                  : 'Optionnel — skip la transcription Whisper'}
              </p>
            </div>
            {srtFile ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setSrtFile(null)}
              >
                Retirer
              </Button>
            ) : (
              <label className="cursor-pointer">
                <Button variant="outline" size="sm" className="h-7 text-xs pointer-events-none">
                  Choisir .srt
                </Button>
                <input
                  type="file"
                  accept=".srt,text/srt,application/x-subrip"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) setSrtFile(f)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>

          {/* Filler removal toggle */}
          <label className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card/40 cursor-pointer hover:border-primary/30 transition-colors">
            <div
              onClick={() => setRemoveFiller(!removeFiller)}
              className={cn(
                'w-10 h-5 rounded-full transition-colors relative shrink-0',
                removeFiller ? 'bg-primary' : 'bg-muted'
              )}
            >
              <div className={cn(
                'absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                removeFiller ? 'translate-x-5' : 'translate-x-0.5'
              )} />
            </div>
            <Scissors className={cn('h-4 w-4 shrink-0', removeFiller ? 'text-primary' : 'text-muted-foreground')} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Supprimer les mots de remplissage</p>
              <p className="text-xs text-muted-foreground">Coupe automatiquement les &quot;euh&quot;, &quot;hum&quot;, &quot;genre&quot;, &quot;like&quot;…</p>
            </div>
          </label>

          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md font-semibold h-12 text-base"
            disabled={(!pendingFile && !url) || isProcessing}
            onClick={() => runPipeline()}
          >
            <Sparkles className="mr-2 h-5 w-5" />
            {pendingFile
              ? `Générer les clips — ${pendingFile.name.slice(0, 30)}`
              : url
              ? 'Générer les clips depuis l\'URL'
              : 'Sélectionner une vidéo d\'abord'}
          </Button>
        </div>
      )}

      {/* ── Processing steps ── */}
      {(isProcessing || isDone || hasError) && (
        <Card className="bg-card/50 backdrop-blur-sm border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              {isDone && <CheckCircle2 className="h-4 w-4 text-green-400" />}
              {hasError && <AlertCircle className="h-4 w-4 text-destructive" />}
              {isProcessing ? 'Traitement en cours…' : isDone ? 'Traitement terminé' : 'Traitement interrompu'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 divide-y divide-border">
            {STEPS.map((step) => (
              <StepRow
                key={step.id}
                step={step}
                status={getStepStatus(step.id as ProcessingStepId)}
                progress={step.id === 'uploading' ? uploadProgress : undefined}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Video player (shown after upload when URL is available) ── */}
      {videoUrl && (isDone || isProcessing) && (
        <div id="video-player-anchor" className="space-y-2">
          <p className="text-sm font-medium text-foreground">Aperçu vidéo</p>
          <VideoPlayer
            ref={playerRef}
            src={videoUrl}
            className="w-full max-h-72 aspect-video"
          />
          {isDone && generatedClips.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Cliquez sur un clip pour prévisualiser ce segment dans le player.
            </p>
          )}
        </div>
      )}

      {/* ── Clips grid — show during rendering AND when done ── */}
      {(isDone || processingStep === 'rendering') && generatedClips.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {generatedClips.length} clip{generatedClips.length > 1 ? 's' : ''} {isDone ? 'générés' : 'en cours de rendu'}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isDone ? (
                  'Triés par Virality Score — du plus viral au moins viral'
                ) : (
                  <>
                    <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                    {generatedClips.filter((c) => c.status === 'done').length}/{generatedClips.length} clips rendus — sous-titres karaoke appliqués automatiquement
                  </>
                )}
              </p>
            </div>

            {/* Batch controls */}
            <div className="flex items-center gap-2">
              <Button
                variant={batchMode ? 'default' : 'outline'}
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => {
                  setBatchMode(!batchMode)
                  setSelectedClips(new Set())
                }}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {batchMode ? 'Annuler' : 'Sélectionner'}
              </Button>

              {batchMode && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1"
                    onClick={handleSelectAll}
                  >
                    {selectedClips.size === generatedClips.length ? 'Désélectionner tout' : 'Tout sélectionner'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={selectedClips.size === 0}
                    onClick={handleBatchDownload}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Télécharger ({selectedClips.size})
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="h-8 text-xs gap-1.5"
                    disabled={selectedClips.size === 0 || batchDeleting}
                    onClick={handleBatchDelete}
                  >
                    {batchDeleting
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                    Supprimer ({selectedClips.size})
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...generatedClips]
              .sort((a, b) => {
                const sa = a.viral_scores?.[0]?.score ?? 0
                const sb = b.viral_scores?.[0]?.score ?? 0
                return sb - sa
              })
              .map((clip) => (
                <ClipCard
                  key={clip.id}
                  clip={clip}
                  onDownload={handleDownload}
                  onPreview={videoUrl ? handlePreview : undefined}
                  batchMode={batchMode}
                  selected={selectedClips.has(clip.id)}
                  onSelect={handleSelectClip}
                />
              ))}
          </div>
        </div>
      )}

      {(isDone || processingStep === 'rendering') && generatedClips.length === 0 && (
        <Card className="border-border bg-card/50">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Aucun clip généré. Essayez avec une vidéo plus longue.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
