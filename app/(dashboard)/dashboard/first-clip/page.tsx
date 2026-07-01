/* eslint-disable @next/next/no-img-element */
"use client"

import { useEffect, useState, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, CheckCircle2, AlertCircle, Download, RefreshCw, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useRenderSubscription } from '@/hooks/use-render-subscription'

// ─── What's happening bullets (contextual education) ────────────────────────

const BULLETS = [
  { icon: '🎤', text: 'Adding karaoke captions to hook viewers in the first 3 seconds' },
  { icon: '📱', text: 'Cropping to 9:16 vertical format for TikTok, Reels & Shorts' },
  { icon: '🔊', text: 'Boosting audio levels for mobile speakers' },
]

// ─── Result Modal ────────────────────────────────────────────────────────────

interface ResultModalProps {
  downloadUrl: string
  publicUrl: string | null
  onTryAnother: () => void
}

function ResultModal({ downloadUrl, publicUrl, onTryAnother }: ResultModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    // Auto-play as soon as the modal mounts
    videoRef.current?.play().catch(() => {})
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" aria-hidden />

      <div className="relative flex flex-col items-center gap-5 w-full max-w-sm animate-in zoom-in-95 duration-300">
        {/* Success badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-sm font-semibold text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          Your clip is ready!
        </div>

        {/* Video player — 9:16 portrait */}
        <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black"
          style={{ aspectRatio: '9/16', maxHeight: '60vh' }}>
          {publicUrl ? (
            <video
              ref={videoRef}
              src={publicUrl}
              controls
              loop
              playsInline
              className="absolute inset-0 w-full h-full object-contain"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
              Video ready — click Download to watch
            </div>
          )}
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2 w-full">
          <a
            href={downloadUrl}
            download
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-sm transition-all"
          >
            <Download className="h-4 w-4" />
            Download
          </a>
          <button
            type="button"
            onClick={onTryAnother}
            className="h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
          >
            Try another clip
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

function FirstClipContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const jobId = searchParams.get('job')
  const clipId = searchParams.get('clip_id') ?? ''
  const thumbnail = searchParams.get('thumbnail')
  const title = searchParams.get('title')
  const author = searchParams.get('author')

  type Phase = 'rendering' | 'done' | 'error'
  const [phase, setPhase] = useState<Phase>('rendering')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [publicUrl, setPublicUrl] = useState<string | null>(null)
  const [completionCalled, setCompletionCalled] = useState(false)
  const [progressLabel, setProgressLabel] = useState<string>('Starting render...')
  const [urlFetchFailed, setUrlFetchFailed] = useState(false)

  // Elapsed seconds ticker
  const [elapsed, setElapsed] = useState(0)
  const startRef = useRef(Date.now())
  useEffect(() => {
    if (phase !== 'rendering') return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [phase])

  // Kill switch: 5-minute timeout — if VPS hangs and never resolves, surface an error
  // rather than leaving the user on an infinite spinner
  useEffect(() => {
    if (phase !== 'rendering' || !jobId) return
    const t = setTimeout(() => {
      setErrorMessage('This render is taking too long — the server may be under load. Please try a different clip.')
      setPhase('error')
    }, 5 * 60 * 1000)
    return () => clearTimeout(t)
  }, [phase, jobId])

  // Mark onboarding complete when user sees the result
  const markComplete = useCallback(() => {
    if (completionCalled) return
    setCompletionCalled(true)
    fetch('/api/onboarding/complete', { method: 'POST' }).catch(() => {})
  }, [completionCalled])

  // Fetch signed URLs when render completes — retries up to 5× with 2s delay
  // Kill switch: if all retries fail, signals the UI to show a fallback escape
  const fetchUrls = useCallback(async (jid: string) => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        if (attempt > 0) await new Promise<void>(r => setTimeout(r, 2000))
        const res = await fetch(`/api/render/status?jobId=${encodeURIComponent(jid)}`)
        if (!res.ok) continue
        const json = await res.json()
        if (json.data?.downloadUrl) {
          setDownloadUrl(json.data.downloadUrl)
          if (json.data?.publicUrl) setPublicUrl(json.data.publicUrl)
          return
        }
      } catch {
        // retry
      }
    }
    // All retries exhausted — clip is rendered but URL unavailable; show escape
    setUrlFetchFailed(true)
  }, [])

  const handleDone = useCallback((data: { storagePath: string }) => {
    // storagePath provided but we still need signed URLs — fetch them
    if (jobId) fetchUrls(jobId)
    setPhase('done')
    markComplete()
  }, [jobId, fetchUrls, markComplete])

  const handleError = useCallback((message: string) => {
    // Classify DMCA/404 errors with a friendlier message
    const isDmca = message.toLowerCase().includes('404') || message.toLowerCase().includes('not found') || message.toLowerCase().includes('unavailable')
    setErrorMessage(
      isDmca
        ? 'This clip is no longer available (possibly removed by the streamer). Try a different one.'
        : message || 'Something went wrong rendering this clip.',
    )
    setPhase('error')
  }, [])

  const handleProgress = useCallback((status: string, queuePosition?: number | null) => {
    if (queuePosition && queuePosition > 0) {
      setProgressLabel(`In queue — position ${queuePosition}`)
    } else if (status === 'rendering') {
      setProgressLabel('Rendering your clip...')
    } else {
      setProgressLabel('Starting render...')
    }
  }, [])

  useRenderSubscription({
    jobId: jobId ?? null,
    clipId,
    onDone: handleDone,
    onError: handleError,
    onProgress: handleProgress,
  })

  // No jobId → something went wrong navigating here
  if (!jobId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-sm">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">No render job found.</p>
          <Button onClick={() => router.push('/dashboard')}>Back to dashboard</Button>
        </div>
      </div>
    )
  }

  const handleTryAnother = () => {
    router.push('/dashboard')
  }

  return (
    <>
      {/* Result modal (phase: done) */}
      {phase === 'done' && downloadUrl && (
        <ResultModal
          downloadUrl={downloadUrl}
          publicUrl={publicUrl}
          onTryAnother={handleTryAnother}
        />
      )}

      {/* Waiting / error screen */}
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-sm flex flex-col items-center gap-6 animate-in fade-in duration-500">

          {/* Clip thumbnail + overlay */}
          <div className="relative w-44 rounded-2xl overflow-hidden border border-border shadow-xl bg-muted/30"
            style={{ aspectRatio: '9/16' }}>
            {thumbnail ? (
              <img
                src={thumbnail}
                alt={title ?? 'Your clip'}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10" />
            )}

            {/* Animated overlay while rendering */}
            {phase === 'rendering' && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-white animate-spin" />
              </div>
            )}

            {/* Done overlay */}
            {phase === 'done' && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              </div>
            )}

            {/* Error overlay */}
            {phase === 'error' && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-red-400" />
              </div>
            )}
          </div>

          {/* Text */}
          <div className="text-center space-y-1">
            {phase === 'rendering' && (
              <>
                <div className="flex items-center gap-2 justify-center">
                  <Sparkles className="h-4 w-4 text-orange-400" />
                  <h1 className="text-lg font-black text-foreground">Transforming your clip...</h1>
                </div>
                {author && (
                  <p className="text-xs text-muted-foreground">by {author}</p>
                )}
                <p className={cn('text-xs tabular-nums mt-1', elapsed > 90 ? 'text-amber-400' : 'text-muted-foreground/60')}>
                  {progressLabel}
                  {elapsed > 0 && ` · ${elapsed}s`}
                  {elapsed > 90 && ' — almost there!'}
                </p>
              </>
            )}

            {phase === 'done' && !downloadUrl && (
              <>
                <h1 className="text-lg font-black text-foreground">Clip ready!</h1>
                {urlFetchFailed ? (
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto leading-relaxed">
                    Your clip rendered but we couldn&apos;t generate a download link. It will appear in your library shortly.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Generating download link...</p>
                )}
              </>
            )}

            {phase === 'error' && (
              <>
                <h1 className="text-lg font-bold text-foreground">Couldn&apos;t process this clip</h1>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-xs mx-auto">
                  {errorMessage}
                </p>
              </>
            )}
          </div>

          {/* What's happening — shown while rendering */}
          {phase === 'rendering' && (
            <div className="w-full rounded-xl border border-border bg-card/50 p-4 space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">What&apos;s happening</p>
              {BULLETS.map((b, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-base leading-none mt-0.5">{b.icon}</span>
                  <p className="text-xs text-muted-foreground leading-snug">{b.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Error CTA */}
          {phase === 'error' && (
            <Button
              onClick={handleTryAnother}
              className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold"
            >
              <RefreshCw className="h-4 w-4" />
              Try a different clip
            </Button>
          )}

          {/* URL fetch failed — clip rendered but download link unavailable */}
          {phase === 'done' && !downloadUrl && urlFetchFailed && (
            <Button
              variant="outline"
              onClick={handleTryAnother}
            >
              Browse library
            </Button>
          )}

          {/* Rendering — skip link */}
          {phase === 'rendering' && (
            <button
              type="button"
              onClick={handleTryAnother}
              className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3 w-3 inline mr-1" />
              Cancel — browse library
            </button>
          )}
        </div>
      </div>
    </>
  )
}

export default function FirstClipPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    }>
      <FirstClipContent />
    </Suspense>
  )
}
