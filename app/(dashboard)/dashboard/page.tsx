"use client"

import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, RefreshCw, AlertCircle, Loader2, Sparkles, Compass,
  Download, Flame, X, Bookmark, Lock, Film,
  UploadCloud, CheckCircle2, Trophy, Clock, Radar,
} from 'lucide-react'
import { WolfLoader } from '@/components/ui/wolf-loader'
import { PageHeader } from '@/components/dashboard/page-header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { type RemixJob } from '@/components/trending/remix-card'
import { ExportTicker } from '@/components/trending/export-ticker'
import { TrendingCard, type QuickExportState } from '@/components/trending/trending-card'
import { TrendingFilters } from '@/components/trending/trending-filters'
import { TrendingDetailModal } from '@/components/trending/trending-detail-modal'
import { FirstClipOverlay } from '@/components/onboarding/first-clip-overlay'
import { ReferralBonusBanner } from '@/components/onboarding/referral-bonus-banner'
import { useRenderSubscription } from '@/hooks/use-render-subscription'
import { useTrendingStore, type TrendingClip } from '@/stores/trending-store'
import type { FeedFilter } from '@/types/trending'
import { cn } from '@/lib/utils'
import { InstallBanner } from '@/components/pwa/install-banner'
import { TopPickCard } from '@/components/trending/top-pick-card'
import { track } from '@/lib/analytics'

export default function DashboardPage() {
  const router = useRouter()
  const [twitchRefreshing, setTwitchRefreshing] = useState(false)
  const [twitchMessage, setTwitchMessage] = useState<string | null>(null)

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [remixes, setRemixes] = useState<RemixJob[]>([])
  const [remixCount, setRemixCount] = useState(0)
  const [loadingRemixes, setLoadingRemixes] = useState(false)
  const [detailClip, setDetailClip] = useState<TrendingClip | null>(null)

  // Quick Export state
  const [quickExport, setQuickExport] = useState<QuickExportState | null>(null)
  const [renderNotification, setRenderNotification] = useState<{
    clipId: string
    clipTitle: string | null
    downloadUrl: string | null
    status: 'done' | 'error'
    errorMessage?: string | null
  } | null>(null)
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const {
    filteredClips,
    filters,
    loading,
    refreshing,
    error,
    clips,
    stats,
    hasMore,
    loadingMore,
    totalCount,
    savedClipIds,
    setFilters,
    setFeed,
    fetchClips,
    loadMore,
    fetchSavedClips,
    toggleSaveClip,
    toggleGroup,
    expandedGroups,
  } = useTrendingStore()

  const fetchBootstrap = useTrendingStore(s => s.fetchBootstrap)
  const fetchTabCounts = useTrendingStore(s => s.fetchTabCounts)
  const tabCounts = useTrendingStore(s => s.tabCounts)

  // ── Daily Radar: track last visit (E1) ──
  const [lastVisit, setLastVisit] = useState<string | null>(null)
  const [isFirstVisit, setIsFirstVisit] = useState(true)
  useEffect(() => {
    const stored = localStorage.getItem('va-last-visit')
    if (stored) {
      setLastVisit(stored)
      setIsFirstVisit(false)
    }
    return () => {
      // Update last-visit on unmount
      localStorage.setItem('va-last-visit', new Date().toISOString())
    }
  }, [])

  // Initial fetch: bootstrap (saved + profile + remixes) in parallel with clips + counts
  useEffect(() => {
    fetchClips()
    fetchBootstrap()
    fetchTabCounts()
  }, [fetchClips, fetchBootstrap, fetchTabCounts])

  // Fetch remixes when tab is active
  useEffect(() => {
    if (filters.feed !== 'remixes') return
    setLoadingRemixes(true)
    fetch('/api/clips/my-remixes?limit=20')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data: { data: RemixJob[]; count?: number }) => {
        setRemixes(data.data ?? [])
        setRemixCount(data.count ?? data.data?.length ?? 0)
      })
      .catch(() => setRemixes([]))
      .finally(() => setLoadingRemixes(false))
  }, [filters.feed])

  // Twitch refresh
  const handleTwitchRefresh = useCallback(async () => {
    setTwitchRefreshing(true)
    setTwitchMessage(null)
    try {
      const res = await fetch('/api/streams/refresh', { method: 'POST' })
      const data = await res.json() as { data: { upserted: number } | null; error: string | null; message: string }
      if (!res.ok || data.error) {
        setTwitchMessage(data.message ?? 'Error')
      } else {
        setTwitchMessage(`${data.data?.upserted ?? 0} clips imported`)
        fetchClips(true)
      }
    } catch {
      setTwitchMessage('Network error')
    } finally {
      setTwitchRefreshing(false)
      setTimeout(() => setTwitchMessage(null), 5000)
    }
  }, [fetchClips])

  const handleEnhance = useCallback((clip: TrendingClip) => {
    track('clip_enhance_started', { source: 'browse', clip_id: clip.id })
    router.push(`/dashboard/enhance/${clip.id}`)
  }, [router])

  // ── Quick Export ──
  const handleQuickExport = useCallback(async (clip: TrendingClip) => {
    if (quickExport?.status === 'rendering') return

    setQuickExport({ clipId: clip.id, jobId: '', status: 'rendering' })
    setRenderNotification(null)

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
        setQuickExport({ clipId: clip.id, jobId: '', status: 'error', errorMessage: json.message ?? 'Export failed' })
        setRenderNotification({
          clipId: clip.id,
          clipTitle: clip.title,
          downloadUrl: null,
          status: 'error',
          errorMessage: json.message ?? 'Export failed',
        })
        return
      }

      const jobId = json.data?.jobId
      if (!jobId) {
        setQuickExport(null)
        return
      }

      setQuickExport({ clipId: clip.id, jobId, status: 'rendering' })
    } catch {
      setQuickExport({ clipId: clip.id, jobId: '', status: 'error', errorMessage: 'Network error' })
    }
  }, [quickExport?.status])

  // Subscribe to render job updates for quick export
  const handleRenderDone = useCallback((data: { storagePath: string }) => {
    if (!quickExport) return
    // Fetch signed download URL
    fetch(`/api/render/status?jobId=${encodeURIComponent(quickExport.jobId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(json => {
        const downloadUrl = json?.data?.downloadUrl ?? null
        setQuickExport(prev => prev ? { ...prev, status: 'done', downloadUrl } : null)
        // Find clip title from store
        const clip = clips.find(c => c.id === quickExport.clipId)
        setRenderNotification({
          clipId: quickExport.clipId,
          clipTitle: clip?.title ?? null,
          downloadUrl,
          status: 'done',
        })
      })
      .catch(() => {
        setQuickExport(prev => prev ? { ...prev, status: 'done' } : null)
      })
  }, [quickExport, clips])

  const handleRenderError = useCallback((message: string) => {
    if (!quickExport) return
    setQuickExport(prev => prev ? { ...prev, status: 'error', errorMessage: message } : null)
    const clip = clips.find(c => c.id === quickExport.clipId)
    setRenderNotification({
      clipId: quickExport.clipId,
      clipTitle: clip?.title ?? null,
      downloadUrl: null,
      status: 'error',
      errorMessage: message,
    })
  }, [quickExport, clips])

  const handleRenderProgress = useCallback(() => {
    // Status updates handled by the subscription — no extra action needed
  }, [])

  useRenderSubscription({
    jobId: quickExport?.jobId || null,
    clipId: quickExport?.clipId ?? '',
    onDone: handleRenderDone,
    onError: handleRenderError,
    onProgress: handleRenderProgress,
  })

  // Auto-dismiss notification after 15s
  useEffect(() => {
    if (!renderNotification) return
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
    notifTimerRef.current = setTimeout(() => setRenderNotification(null), 15000)
    return () => { if (notifTimerRef.current) clearTimeout(notifTimerRef.current) }
  }, [renderNotification])

  // Track pre-created videoId so we can reuse on retry or clean up on abandon
  const lastUploadVideoIdRef = useRef<string | null>(null)

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side validation (2 GB max — same as UploadZone)
    const maxSize = 2 * 1024 * 1024 * 1024
    if (file.size > maxSize) {
      setUploadError('File too large — maximum size is 2 GB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadFile(file)
    setUploadError(null)
    setUploadSuccess(false)
    setUploadProgress(0)
    setUploading(true)

    try {
      // Step 1: Get signed upload URL (bypasses Netlify 6 MB payload limit)
      const signBody: Record<string, unknown> = {
        filename: file.name,
        contentType: file.type || 'video/mp4',
        fileSize: file.size,
      }
      if (lastUploadVideoIdRef.current) {
        signBody.existingVideoId = lastUploadVideoIdRef.current
      }

      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signBody),
      })

      const signJson = await signRes.json()
      if (!signRes.ok || signJson.error) {
        setUploadError(signJson.message ?? signJson.error ?? 'Failed to prepare upload')
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
        return
      }

      const { signedUrl, videoId } = signJson.data
      lastUploadVideoIdRef.current = videoId

      // Step 2: Upload file directly to Supabase Storage via signed URL
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', signedUrl)
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4')

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100))
        }
      })

      xhr.addEventListener('load', async () => {
        if (fileInputRef.current) fileInputRef.current.value = ''
        if (xhr.status >= 200 && xhr.status < 300) {
          // Step 3: Confirm upload completed
          try {
            const completeRes = await fetch('/api/upload/complete', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ videoId }),
            })
            if (!completeRes.ok) {
              const cj = await completeRes.json().catch(() => null)
              setUploadError(cj?.message ?? 'Failed to confirm upload — please retry')
              setUploading(false)
              return
            }
          } catch {
            setUploadError('Failed to confirm upload — please retry')
            setUploading(false)
            return
          }

          setUploadSuccess(true)
          lastUploadVideoIdRef.current = null
          setTimeout(() => {
            router.push(`/dashboard/enhance/${videoId}?source=upload`)
          }, 600)
        } else {
          setUploadError('Upload to storage failed — please try again')
          setUploading(false)
        }
      })

      xhr.addEventListener('error', () => {
        setUploadError('Network error — please try again')
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      })

      xhr.send(file)
    } catch {
      setUploadError('Unexpected error — please try again')
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [router])

  // Tab counts come from server (single source of truth)
  const tabCountsDisplay = useMemo(() => ({
    hot_now: tabCounts.exploding,
    proven: tabCounts.proven,
    recent: tabCounts.fresh,
    all: tabCounts.all,
    saved: savedClipIds.size,
  }), [tabCounts, savedClipIds.size])

  // Daily Radar stats (E1) — uses server counts for consistency
  const radarStats = useMemo(() => {
    if (!lastVisit || isFirstVisit) return null
    const lvTime = new Date(lastVisit).getTime()
    const newClips = clips.filter(c => {
      const t = c.clip_created_at ?? c.scraped_at
      return t ? new Date(t).getTime() > lvTime : false
    })
    const lastScan = clips.reduce((max, c) => {
      const t = c.scraped_at ? new Date(c.scraped_at).getTime() : 0
      return t > max ? t : max
    }, 0)
    const lastScanMinAgo = lastScan > 0 ? Math.floor((Date.now() - lastScan) / 60000) : null
    return {
      newCount: newClips.length,
      freshDrops: tabCounts.fresh,
      legendary: tabCounts.legendary,
      lastScanMinAgo,
    }
  }, [lastVisit, isFirstVisit, clips, tabCounts.fresh, tabCounts.legendary])

  // D1: Auto-hide "Exploding Now" tab when it has 0 clips
  const feedTabs: { key: FeedFilter; label: string; icon: typeof Flame; count?: number; subtle?: boolean; empty?: boolean }[] = [
    { key: 'all', label: 'All Clips', icon: Compass, count: tabCountsDisplay.all },
    ...(tabCountsDisplay.hot_now > 0 ? [{ key: 'hot_now' as FeedFilter, label: 'Exploding Now', icon: Flame, count: tabCountsDisplay.hot_now }] : []),
    { key: 'proven', label: 'Proven Winners', icon: Trophy, count: tabCountsDisplay.proven, empty: tabCountsDisplay.proven === 0 && tabCountsDisplay.all > 0 },
    { key: 'recent', label: 'Fresh Drops', icon: Clock, count: tabCountsDisplay.recent, empty: tabCountsDisplay.recent === 0 && tabCountsDisplay.all > 0 },
    { key: 'saved', label: 'Saved', icon: Bookmark, count: tabCountsDisplay.saved },
  ]

  // "remaining" = server total for this tab minus what's already loaded
  const remaining = totalCount - filteredClips.length

  // Top Pick: best clip meeting quality criteria (early_gem/hot_now, score>=75, <12h old)
  const usedClipIds = useTrendingStore(s => s.usedClipIds)
  const topPickClip = useMemo(() => {
    if (filters.feed === 'saved') return null
    const TWELVE_HOURS = 12 * 60 * 60 * 1000
    const now = Date.now()

    // Filter eligible clips, then pick the highest velocity_score
    const eligible = filteredClips.filter((c) => {
      const score = c.velocity_score ?? 0
      if (score < 75) return false
      // Exclude ultra-short clips (< 8s)
      if ((c.duration_seconds ?? 0) < 8) return false
      // Exclude clips the user already rendered/published
      if (usedClipIds.has(c.id)) return false
      // Must be < 12h old
      const created = c.clip_created_at ?? c.scraped_at
      if (!created) return false
      if (now - new Date(created).getTime() > TWELVE_HOURS) return false
      // Must be "exploding": DB feed_category OR real-time sub-score match
      const cat = c.feed_category
      if (cat === 'early_gem' || cat === 'hot_now') return true
      // Fallback: check sub-scores (same logic as verdict engine "Exploding")
      const early = c.early_signal_score ?? 0
      const sat = c.saturation_score ?? 0
      const mom = c.momentum_score ?? 0
      if (early >= 60 && sat <= 30) return true
      if (mom >= 70) return true
      return false
    })

    if (eligible.length === 0) return null
    // Already sorted by velocity_score DESC from filterAndSortClips, but be explicit
    return eligible.reduce((best, c) =>
      (c.velocity_score ?? 0) > (best.velocity_score ?? 0) ? c : best
    )
  }, [filteredClips, filters.feed, usedClipIds])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <FirstClipOverlay />
      <ReferralBonusBanner />

      {/* Header — unified PageHeader pattern (Compass icon + cyan accent) */}
      <PageHeader
        icon={Compass}
        title="Browse Clips"
        subtitle="Pick a trending clip. We'll make it TikTok-ready."
        accent="cyan"
        rightSlot={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-matroska,video/avi,video/webm,.mp4,.mov,.mkv,.avi,.webm"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'gap-2 h-8 border-dashed',
                uploadSuccess
                  ? 'border-emerald-500/30 text-emerald-400'
                  : 'border-primary/30 text-primary hover:bg-primary/5'
              )}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || uploadSuccess}
            >
              {uploadSuccess ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : uploading ? (
                <WolfLoader variant="spinner" size="sm" mode="amber" />
              ) : (
                <UploadCloud className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {uploadSuccess ? 'Redirecting...' : uploading ? `${uploadProgress}%` : 'Upload clip'}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8"
              onClick={() => fetchClips(true)}
              disabled={refreshing}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      {/* Live export ticker */}
      <ExportTicker />

      {/* Upload error */}
      {uploadError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{uploadError}</p>
            </div>
            <button onClick={() => setUploadError(null)} className="text-destructive/60 hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </CardContent>
        </Card>
      )}

      {/* Twitch refresh toast */}
      {twitchMessage && (
        <Card className="border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <TrendingUp className="h-4 w-4 text-amber-400 shrink-0" />
            <p className="text-muted-foreground">{twitchMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Daily Radar (E1) — shown after first visit */}
      {radarStats && radarStats.newCount > 0 && (
        <div className="flex items-center gap-3 h-14 px-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/6">
          <Radar className="h-[18px] w-[18px] text-cyan-400 shrink-0" />
          <span className="text-[13px] font-bold tracking-[0.14em] uppercase text-cyan-400">Daily Radar</span>
          <span className="text-[13px] text-zinc-300">
            {radarStats.newCount} new clip{radarStats.newCount !== 1 ? 's' : ''} since your last visit
            {radarStats.freshDrops > 0 && <> · {radarStats.freshDrops} fresh drop{radarStats.freshDrops !== 1 ? 's' : ''}</>}
            {radarStats.legendary > 0 && <> · <span className="text-amber-400 font-bold">{radarStats.legendary} legendary</span></>}
            {radarStats.lastScanMinAgo !== null && <> · <span className="text-zinc-500">Last scan: {radarStats.lastScanMinAgo}m ago</span></>}
          </span>
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="space-y-2">
        {/* Feed tabs — segmented control style, compact */}
        <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg border border-border bg-card/50 w-fit">
          {feedTabs.map(({ key, label, icon: Icon, count, subtle, empty }) => {
            const active = filters.feed === key
            return (
              <button
                key={key}
                onClick={() => setFeed(key)}
                aria-pressed={active}
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium transition-all',
                  active
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : subtle
                      ? 'text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20'
                      : empty
                        ? 'text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
                {count !== undefined && !loading && (
                  <span className={cn(
                    'tabular-nums text-[10px]',
                    active ? 'opacity-80' : 'opacity-60'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>


        {/* Filters */}
        <TrendingFilters
          filters={filters}
          onChange={setFilters}
          totalCount={clips.length}
          filteredCount={filteredClips.length}
          availableNiches={stats.games}
          availableStreamers={(() => {
            const counts = new Map<string, number>()
            for (const c of clips) {
              const name = c.author_name || c.author_handle
              if (!name) continue
              counts.set(name, (counts.get(name) ?? 0) + 1)
            }
            return Array.from(counts.entries()).map(([name, count]) => ({ name, count }))
          })()}
        />
      </div>

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Clip Grid (Remixes tab removed from Browse — clips live in Distribution / Clip Bank) */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card/60 overflow-hidden animate-pulse">
              <div className="aspect-[9/16] max-h-52 bg-gradient-to-br from-muted/40 to-muted/20" />
              <div className="p-3 space-y-2">
                <div className="h-3.5 w-3/4 rounded bg-muted/50" />
                <div className="h-3 w-1/2 rounded bg-muted/30" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-5 w-14 rounded-full bg-muted/30" />
                  <div className="h-5 w-10 rounded-full bg-muted/20" />
                </div>
                <div className="h-9 w-full rounded-lg bg-primary/10 mt-2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredClips.length === 0 ? (
        (() => {
          const hasFilters =
            filters.search !== '' ||
            filters.games.length > 0 ||
            filters.platforms.length > 0 ||
            filters.duration !== 'all'
          const noClipsAtAll = clips.length === 0

          // Tab-specific empty state messages
          const emptyMessage = noClipsAtAll
            ? 'Clips from Twitch & Kick will appear here once imported.'
            : filters.feed === 'hot_now'
              ? 'No clips exploding right now. Check Proven Winners or All Clips.'
              : filters.feed === 'recent'
                ? 'No fresh drops in the last 6 hours. Check Proven Winners.'
                : filters.feed === 'proven'
                  ? 'No proven winners yet. Try All Clips.'
                  : filters.feed === 'saved'
                    ? 'You haven\'t saved any clips yet. Browse clips and tap the bookmark icon.'
                    : hasFilters
                      ? 'Loosen your filters or try another category.'
                      : 'Try refreshing \u2014 new clips drop every few minutes.'

          return (
            <Card className="border-border bg-card/50">
              <CardContent className="p-10 md:p-14 text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-500/15 border border-orange-500/20 mb-4">
                  {noClipsAtAll ? (
                    <Download className="h-8 w-8 text-orange-400" />
                  ) : (
                    <TrendingUp className="h-8 w-8 text-orange-400" />
                  )}
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">
                  {noClipsAtAll
                    ? 'Nothing here yet'
                    : 'No clips match'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                  {emptyMessage}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {/* Tab-specific switch buttons */}
                  {!noClipsAtAll && (filters.feed === 'hot_now' || filters.feed === 'recent') && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setFeed('proven')}>
                        <Trophy className="h-3.5 w-3.5 mr-1.5" />
                        Proven Winners
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setFeed('all')}>
                        <Compass className="h-3.5 w-3.5 mr-1.5" />
                        All Clips
                      </Button>
                    </>
                  )}
                  {hasFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilters({ search: '', games: [], platforms: [], sort: 'velocity', duration: 'all', feed: filters.feed })
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Clear filters
                    </Button>
                  )}
                  {noClipsAtAll && (
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={handleTwitchRefresh}
                      disabled={twitchRefreshing}
                    >
                      {twitchRefreshing ? (
                        <WolfLoader variant="spinner" size="sm" mode="amber" className="mr-1.5" />
                      ) : (
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Import Clips
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })()
      ) : (
        <>
          {/* Top Pick — compact diamond card (only shown when a clip meets criteria) */}
          {topPickClip && (
            <div className="py-4 px-2">
              <TopPickCard clip={topPickClip} onEnhance={handleEnhance} />
            </div>
          )}

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 py-4">
            {filteredClips.map((clip) => (
              <div key={clip.id} onClick={() => handleEnhance(clip)} className="cursor-pointer relative">
                <TrendingCard
                  clip={clip}
                  onRemix={handleEnhance}
                  onQuickExport={handleQuickExport}
                  onShowDetail={setDetailClip}
                  quickExportState={quickExport}
                  remixing={false}
                  isSaved={savedClipIds.has(clip.id)}
                  onToggleSave={toggleSaveClip}
                  onToggleGroup={toggleGroup}
                  isGroupExpanded={clip.stream_group_id ? expandedGroups.has(clip.stream_group_id) : false}
                  isNew={!!(lastVisit && (clip.clip_created_at ?? clip.scraped_at) && new Date(clip.clip_created_at ?? clip.scraped_at!).getTime() > new Date(lastVisit).getTime())}
                />
              </div>
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <WolfLoader variant="spinner" size="sm" mode="amber" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                Load more{remaining > 0 && ` (${remaining} remaining)`}
              </Button>
            </div>
          )}
        </>
      )}

      {/* Quick Export rendering indicator */}
      {quickExport?.status === 'rendering' && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border shadow-xl animate-in slide-in-from-bottom-2 fade-in">
          <WolfLoader variant="spinner" size="md" mode="amber" />
          <div>
            <p className="text-sm font-medium text-foreground">Rendering your clip...</p>
            <p className="text-xs text-muted-foreground">You can keep browsing</p>
          </div>
        </div>
      )}

      {/* Render completion notification */}
      {renderNotification && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border shadow-2xl animate-in slide-in-from-bottom-2 fade-in max-w-sm backdrop-blur-sm',
          renderNotification.status === 'done'
            ? 'bg-zinc-900/95 border-amber-500/40'
            : 'bg-zinc-900/95 border-red-500/40'
        )}
        style={renderNotification.status === 'done' ? { boxShadow: '0 0 25px rgba(245,158,11,.15), 0 8px 32px rgba(0,0,0,.5)' } : undefined}
        >
          {renderNotification.status === 'done' ? (
            <div className="h-9 w-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-amber-400" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-red-500/15 flex items-center justify-center shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {renderNotification.status === 'done'
                ? 'Your clip is ready!'
                : renderNotification.errorMessage ?? 'Export failed'}
            </p>
            {renderNotification.clipTitle && (
              <p className="text-xs text-zinc-400 truncate mt-0.5">{renderNotification.clipTitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {renderNotification.status === 'done' && (
              <button
                onClick={() => router.push(`/dashboard/enhance/${renderNotification.clipId}`)}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-colors"
              >
                Enhance
              </button>
            )}
            {renderNotification.status === 'done' && renderNotification.downloadUrl && (
              <a
                href={renderNotification.downloadUrl}
                download
                onClick={(e) => e.stopPropagation()}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs font-medium transition-all"
              >
                Download
              </a>
            )}
            <button
              onClick={() => setRenderNotification(null)}
              className="p-1 text-zinc-500 hover:text-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Refresh indicator */}
      {refreshing && !quickExport && !renderNotification && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-lg animate-in slide-in-from-bottom-2 fade-in">
          <WolfLoader variant="spinner" size="sm" mode="amber" />
          <span className="text-xs text-muted-foreground">Refreshing...</span>
        </div>
      )}

      <InstallBanner />

      {/* Detail modal — "Why this clip?" */}
      <TrendingDetailModal
        clip={detailClip}
        open={detailClip !== null}
        onClose={() => setDetailClip(null)}
        onRemix={handleEnhance}
        remixing={false}
      />
    </div>
  )
}
