"use client"

import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { Eye, ArrowRight, Zap } from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const LS_KEY = 'vsp.onboarding.first-clip.v1'

interface CuratedClip {
  id: string
  title: string | null
  author_name: string | null
  author_handle: string | null
  thumbnail_url: string | null
  view_count: number | null
  niche: string | null
  duration_seconds: number | null
  velocity_score: number | null
  platform: string
}

function formatViewCount(n: number | null): string {
  if (!n) return ''
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K views`
  return `${n} views`
}

export function FirstClipOverlay() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [clips, setClips] = useState<CuratedClip[]>([])
  const [loadingClipId, setLoadingClipId] = useState<string | null>(null)

  useEffect(() => {
    // Fast path: localStorage says already done
    // Also check old WelcomeModal key so existing users are not re-shown onboarding
    try {
      if (typeof window !== 'undefined') {
        if (
          window.localStorage.getItem(LS_KEY) ||
          window.localStorage.getItem('vsp.onboarding.welcome.v1')
        ) return
      }
    } catch {
      return // localStorage unavailable — skip onboarding
    }

    // Server check: has_completed_first_clip
    let cancelled = false
    ;(async () => {
      try {
        const statusRes = await fetch('/api/onboarding/status')
        if (!statusRes.ok || cancelled) return
        const statusJson = await statusRes.json() as { data: { hasCompleted: boolean } | null }
        if (statusJson.data?.hasCompleted) {
          try { window.localStorage.setItem(LS_KEY, '1') } catch { /* ignore */ }
          return
        }

        // Fetch curated clips
        const clipsRes = await fetch('/api/onboarding/curated-clips')
        if (!clipsRes.ok || cancelled) return
        const clipsJson = await clipsRes.json() as { data: { clips: CuratedClip[]; canShow: boolean } | null }
        if (!clipsJson.data?.canShow || !clipsJson.data.clips.length) return

        if (!cancelled) {
          setClips(clipsJson.data.clips)
          setOpen(true)
        }
      } catch {
        // Kill switch: any failure → silently skip overlay (no broken UI)
      }
    })()

    return () => { cancelled = true }
  }, [])

  const handleSkip = useCallback(() => {
    try { window.localStorage.setItem(LS_KEY, '1') } catch { /* ignore */ }
    setOpen(false)
  }, [])

  const handleMakeViral = useCallback(async (clip: CuratedClip) => {
    if (loadingClipId) return
    setLoadingClipId(clip.id)

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

      const json = await res.json() as { data: { jobId: string } | null; error: string | null; message: string }

      if (!res.ok || json.error || !json.data?.jobId) {
        // Kill switch: render failed to start — reset so user can try another
        setLoadingClipId(null)
        return
      }

      const params = new URLSearchParams({
        job: json.data.jobId,
        clip: clip.id,
      })
      if (clip.title) params.set('title', clip.title)
      if (clip.thumbnail_url) params.set('thumb', clip.thumbnail_url)
      if (clip.author_name || clip.author_handle) {
        params.set('streamer', clip.author_name ?? clip.author_handle ?? '')
      }

      router.push(`/dashboard/first-clip?${params.toString()}`)
    } catch {
      setLoadingClipId(null)
    }
  }, [loadingClipId, router])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm" aria-hidden />

      {/* Modal */}
      <div className="relative w-full max-w-4xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-xs font-semibold text-orange-400 mb-4">
            <Zap className="h-3 w-3" />
            Welcome to Viral Animal
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Make Your First Viral Clip
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Pick a clip below — we&apos;ll boost it and have it ready in under 90 seconds.
          </p>
        </div>

        {/* Clip grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {clips.map((clip) => {
            const isLoading = loadingClipId === clip.id
            const streamer = clip.author_name ?? clip.author_handle ?? 'Streamer'

            return (
              <button
                key={clip.id}
                onClick={() => handleMakeViral(clip)}
                disabled={!!loadingClipId}
                className={cn(
                  'group relative rounded-xl border bg-card overflow-hidden text-left transition-all duration-200',
                  'hover:border-orange-500/50 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-y-0.5',
                  loadingClipId && !isLoading && 'opacity-50 cursor-not-allowed',
                  isLoading && 'border-orange-500/50 shadow-lg shadow-orange-500/10'
                )}
              >
                {/* Thumbnail */}
                <div className="relative aspect-[9/16] max-h-52 bg-muted overflow-hidden">
                  {clip.thumbnail_url ? (
                    <Image
                      src={clip.thumbnail_url}
                      alt={clip.title ?? streamer}
                      fill
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      unoptimized={clip.thumbnail_url.includes('kick.com')}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/10" />
                  )}

                  {/* Loading overlay */}
                  {isLoading && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                      <WolfLoader variant="spinner" size={32} mode="amber" />
                    </div>
                  )}

                  {/* View count badge */}
                  {clip.view_count && (
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm text-[10px] text-white font-medium">
                      <Eye className="h-2.5 w-2.5" />
                      {formatViewCount(clip.view_count)}
                    </div>
                  )}
                </div>

                {/* Card body */}
                <div className="p-2.5 space-y-2">
                  <p className="text-xs font-semibold text-foreground truncate">
                    {streamer}
                  </p>

                  {/* CTA */}
                  <div className={cn(
                    'flex items-center justify-center gap-1.5 w-full h-8 rounded-lg text-xs font-bold transition-all',
                    isLoading
                      ? 'bg-orange-500/20 text-orange-400'
                      : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white group-hover:from-orange-600 group-hover:to-amber-600'
                  )}>
                    {isLoading ? (
                      <>
                        <WolfLoader variant="spinner" size={12} mode="amber" />
                        Starting...
                      </>
                    ) : (
                      <>
                        Make Viral
                        <ArrowRight className="h-3 w-3" />
                      </>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Skip link */}
        <div className="text-center mt-6">
          <button
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Skip — browse library
          </button>
        </div>
      </div>
    </div>
  )
}
