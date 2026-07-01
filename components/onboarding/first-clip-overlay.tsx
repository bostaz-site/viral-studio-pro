"use client"

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowRight, Loader2, Eye, Flame } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface CuratedClip {
  id: string
  title: string | null
  thumbnail_url: string | null
  author_name: string | null
  view_count: number | null
  duration_seconds: number | null
  niche: string | null
  velocity_score: number | null
}

function formatViews(n: number | null): string {
  if (!n) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K views`
  return `${n} views`
}

function formatDuration(s: number | null): string {
  if (!s) return ''
  return `${Math.round(s)}s`
}

interface ClipCardProps {
  clip: CuratedClip
  loading: boolean
  onMakeViral: (clip: CuratedClip) => void
}

function ClipCard({ clip, loading, onMakeViral }: ClipCardProps) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden transition-all hover:border-orange-500/40 hover:shadow-lg hover:shadow-orange-500/5">
      {/* Thumbnail */}
      <div className="relative aspect-[9/16] max-h-48 bg-muted/30 overflow-hidden">
        {clip.thumbnail_url ? (
          <Image
            src={clip.thumbnail_url}
            alt={clip.title ?? 'Clip thumbnail'}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, 200px"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-orange-500/10 to-amber-500/10">
            <Flame className="h-8 w-8 text-orange-400/40" />
          </div>
        )}
        {/* Duration badge */}
        {clip.duration_seconds && (
          <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-black/70 text-white">
            {formatDuration(clip.duration_seconds)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex flex-col gap-2 flex-1">
        {clip.author_name && (
          <p className="text-xs font-semibold text-foreground truncate">{clip.author_name}</p>
        )}
        {clip.title && (
          <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{clip.title}</p>
        )}
        {clip.view_count && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
            <Eye className="h-3 w-3" />
            {formatViews(clip.view_count)}
          </div>
        )}

        <Button
          size="sm"
          onClick={() => onMakeViral(clip)}
          disabled={loading}
          className="mt-auto gap-1.5 h-8 text-xs font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <>
              Make Viral
              <ArrowRight className="h-3 w-3" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

/**
 * FirstClipOverlay — onboarding replacement for WelcomeModal.
 *
 * Shown once to new users (has_completed_first_clip = false).
 * Displays 4-5 curated clips; clicking "Make Viral" immediately starts a render
 * and navigates to the dedicated /dashboard/first-clip waiting screen.
 *
 * Kill switches:
 * - If the API returns sufficient: false (< 3 clips available), renders nothing.
 * - If the render API fails, shows an inline error and lets the user try another clip.
 */
export function FirstClipOverlay() {
  const router = useRouter()
  const [clips, setClips] = useState<CuratedClip[]>([])
  const [visible, setVisible] = useState(false)
  const [fetchingClipId, setFetchingClipId] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)

  useEffect(() => {
    // Kill switch: user already dismissed overlay in this browser — don't re-show
    if (localStorage.getItem('va.onboarding.skipped') === '1') return

    let cancelled = false
    fetch('/api/onboarding/curated-clips')
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        if (cancelled) return
        const d = json?.data
        if (d?.sufficient && Array.isArray(d.clips) && d.clips.length >= 3) {
          setClips(d.clips)
          setVisible(true)
        }
        // Kill switch: sufficient=false → render nothing, let normal dashboard show
      })
      .catch(() => {
        // Network error → skip onboarding silently
      })
    return () => { cancelled = true }
  }, [])

  const handleSkip = useCallback(() => {
    localStorage.setItem('va.onboarding.skipped', '1')
    setVisible(false)
  }, [])

  const handleMakeViral = useCallback(async (clip: CuratedClip) => {
    if (fetchingClipId) return
    setFetchingClipId(clip.id)
    setRenderError(null)

    try {
      const idempotencyKey = crypto.randomUUID()
      const res = await fetch('/api/render/quick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ clip_id: clip.id, source: 'trending' }),
      })

      const json = await res.json()

      if (!res.ok || json.error) {
        setRenderError(json.message ?? 'Could not start render. Try another clip.')
        setFetchingClipId(null)
        return
      }

      const jobId: string = json.data?.jobId
      if (!jobId) {
        setRenderError('Unexpected error. Try another clip.')
        setFetchingClipId(null)
        return
      }

      // Navigate to dedicated waiting screen — do NOT route through enhance page
      const params = new URLSearchParams({
        job: jobId,
        clip_id: clip.id,
        ...(clip.thumbnail_url ? { thumbnail: clip.thumbnail_url } : {}),
        ...(clip.title ? { title: clip.title } : {}),
        ...(clip.author_name ? { author: clip.author_name } : {}),
      })
      router.push(`/dashboard/first-clip?${params.toString()}`)
    } catch {
      setRenderError('Network error. Try another clip.')
      setFetchingClipId(null)
    }
  }, [fetchingClipId, router])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/85 backdrop-blur-sm" aria-hidden />

      {/* Modal */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl p-6 animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-400 mb-3">
            <Flame className="h-3 w-3" />
            Make Your First Viral Clip
          </div>
          <h2 className="text-xl font-black tracking-tight text-foreground">
            Pick a clip — we do the rest
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Karaoke captions, 9:16 crop, audio boost — rendered in under 90 seconds.
          </p>
        </div>

        {/* Render error */}
        {renderError && (
          <div className="mb-4 px-4 py-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
            {renderError}
          </div>
        )}

        {/* Clip grid */}
        <div className={cn(
          'grid gap-3',
          clips.length >= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'
        )}>
          {clips.map(clip => (
            <ClipCard
              key={clip.id}
              clip={clip}
              loading={fetchingClipId === clip.id}
              onMakeViral={handleMakeViral}
            />
          ))}
        </div>

        {/* Skip link */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors underline-offset-2 hover:underline"
          >
            Skip — browse library
          </button>
        </div>
      </div>
    </div>
  )
}
