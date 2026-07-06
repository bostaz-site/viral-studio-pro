"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Download, Volume2, VolumeX, Zap } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Button } from '@/components/ui/button'
import { useRenderSubscription } from '@/hooks/use-render-subscription'

const TIMEOUT_MS = 3 * 60 * 1000 // Kill switch: 3-minute max wait

const BULLETS = [
  'Adding karaoke captions synced word-by-word to speech',
  'Cropping to 9:16 — optimized for TikTok & Reels',
  'Boosting audio clarity for mobile playback',
]

type Phase = 'waiting' | 'done' | 'error' | 'timeout'

function FirstClipContent() {
  const router = useRouter()
  const params = useSearchParams()

  const jobId = params.get('job')
  const clipId = params.get('clip') ?? ''
  const title = params.get('title') ?? null
  const thumb = params.get('thumb') ?? null
  const streamer = params.get('streamer') ?? null

  const [phase, setPhase] = useState<Phase>('waiting')
  const [statusMsg, setStatusMsg] = useState('Starting render...')
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)

  const completedRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Guard: no job param → back to dashboard
  useEffect(() => {
    if (!jobId) router.replace('/dashboard')
  }, [jobId, router])

  // Kill switch: 3-minute timeout — prevents users staring at spinner indefinitely
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setPhase(p => (p === 'waiting' ? 'timeout' : p))
    }, TIMEOUT_MS)
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current) }
  }, [])

  const markComplete = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    // Mark server-side (has_completed_first_clip = true)
    fetch('/api/onboarding/complete', { method: 'POST' }).catch(() => {})
    // Mark client-side so the overlay never shows again in this browser
    try { window.localStorage.setItem('vsp.onboarding.first-clip.v1', '1') } catch { /* ignore */ }
  }, [])

  const handleDone = useCallback((data: { storagePath: string }) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    // Fetch signed download URL + public URL for preview
    fetch(`/api/render/status?jobId=${encodeURIComponent(jobId ?? '')}`)
      .then(r => r.ok ? r.json() : null)
      .then((json: { data: { publicUrl: string | null; downloadUrl: string | null } | null } | null) => {
        setPublicUrl(json?.data?.publicUrl ?? null)
        setDownloadUrl(json?.data?.downloadUrl ?? null)
        markComplete()
        setPhase('done')
      })
      .catch(() => {
        markComplete()
        setPhase('done')
      })
  }, [jobId, markComplete])

  const handleError = useCallback((_message: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setPhase('error')
  }, [])

  const handleProgress = useCallback((status: string, queuePosition?: number | null) => {
    if (status === 'rendering') {
      setStatusMsg('Rendering your clip...')
    } else if (queuePosition != null && queuePosition > 0) {
      setStatusMsg(`In queue — position ${queuePosition}`)
    } else {
      setStatusMsg('Processing...')
    }
  }, [])

  useRenderSubscription({
    jobId: phase === 'waiting' ? jobId : null,
    clipId,
    onDone: handleDone,
    onError: handleError,
    onProgress: handleProgress,
  })

  if (!jobId) return null

  // ── Result modal (done) ──────────────────────────────────────────────────────
  if (phase === 'done') {
    const videoSrc = publicUrl ?? downloadUrl
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm p-4 animate-in fade-in duration-500">
        {/* Video player */}
        <div className="relative w-full max-w-xs mx-auto">
          {videoSrc ? (
            <>
              <video
                src={videoSrc}
                autoPlay
                loop
                muted={muted}
                playsInline
                className="w-full rounded-2xl shadow-2xl"
                style={{ maxHeight: '70vh', objectFit: 'cover' }}
              />
              {/* Mute toggle */}
              <button
                onClick={() => setMuted(m => !m)}
                className="absolute bottom-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-sm text-white hover:bg-black/80 transition-colors"
                aria-label={muted ? 'Unmute' : 'Mute'}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </>
          ) : (
            <div
              className="aspect-[9/16] rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/10 flex items-center justify-center"
              style={{ maxHeight: '70vh' }}
            >
              <CheckCircle2 className="h-16 w-16 text-green-400" />
            </div>
          )}

          {/* Ready badge */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/90 backdrop-blur-sm text-white text-xs font-bold shadow-lg">
            <CheckCircle2 className="h-3 w-3" />
            Clip ready!
          </div>
        </div>

        {/* CTAs */}
        <div className="flex flex-col items-center gap-3 mt-6 w-full max-w-xs">
          {downloadUrl ? (
            <a
              href={downloadUrl}
              download
              className="w-full inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-base font-bold transition-all shadow-lg shadow-orange-500/25"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          ) : (
            <div className="w-full h-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-sm">
              Preparing download...
            </div>
          )}
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Try another clip →
          </button>
        </div>
      </div>
    )
  }

  // ── Error / timeout kill switch ──────────────────────────────────────────────
  if (phase === 'error' || phase === 'timeout') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center gap-5 px-4">
        <div className="h-16 w-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {phase === 'timeout' ? 'Taking longer than expected' : 'Render failed'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {phase === 'timeout'
              ? 'The render server is busy right now. Pick another clip and try again.'
              : 'Something went wrong with this clip. Try a different one.'}
          </p>
        </div>
        <Button
          onClick={() => router.push('/dashboard')}
          className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold"
        >
          Try another clip
        </Button>
      </div>
    )
  }

  // ── Waiting state ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 px-4 py-12 animate-in fade-in duration-300">
      {/* Thumbnail with render overlay */}
      <div className="relative w-44 rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        <div className="relative aspect-[9/16]">
          {thumb ? (
            <Image
              src={thumb}
              alt={title ?? streamer ?? 'clip'}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10" />
          )}
        </div>
        {/* Spinner overlay */}
        <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <WolfLoader variant="spinner" size={32} mode="amber" />
            {streamer && (
              <p className="text-[11px] font-bold text-white/80 px-2 text-center truncate max-w-[9rem]">
                {streamer}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="text-center">
        <p className="text-sm font-medium text-foreground">{statusMsg}</p>
        <p className="text-xs text-muted-foreground mt-1">Ready in ~60–90 seconds</p>
      </div>

      {/* 3-bullet contextual explainer */}
      <div className="w-full max-w-xs space-y-3">
        {BULLETS.map((bullet, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <div className="mt-0.5 h-5 w-5 rounded-full bg-orange-500/15 border border-orange-500/20 flex items-center justify-center shrink-0">
              <Zap className="h-3 w-3 text-orange-400" />
            </div>
            <p className="text-sm text-muted-foreground">{bullet}</p>
          </div>
        ))}
      </div>

      {/* Skip link — power users aren't trapped */}
      <Link
        href="/dashboard"
        className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors underline-offset-4 hover:underline"
      >
        Skip — browse library
      </Link>
    </div>
  )
}

export default function FirstClipPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[70vh]">
          <WolfLoader variant="spinner" size={32} mode="amber" />
        </div>
      }
    >
      <FirstClipContent />
    </Suspense>
  )
}
