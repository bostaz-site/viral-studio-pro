"use client"

import { useEffect, useCallback, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, RefreshCw, AlertCircle, Loader2, Sparkles,
  Download, Flame, Zap, Clock, X, Diamond, Trophy, Bookmark, Lock, Film,
  UploadCloud, Scissors, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RemixCard, type RemixJob } from '@/components/trending/remix-card'
import { ExportTicker } from '@/components/trending/export-ticker'
import { TrendingCard, type QuickExportState } from '@/components/trending/trending-card'
import { TrendingFilters } from '@/components/trending/trending-filters'
import { WelcomeModal } from '@/components/onboarding/welcome-modal'
import { ReferralBonusBanner } from '@/components/onboarding/referral-bonus-banner'
import { useRenderSubscription } from '@/hooks/use-render-subscription'
import { useTrendingStore, type TrendingClip } from '@/stores/trending-store'
import type { FeedFilter } from '@/types/trending'
import { cn } from '@/lib/utils'
import { InstallBanner } from '@/components/pwa/install-banner'

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

  // Initial fetch: bootstrap (saved + profile + remixes) in parallel with clips
  useEffect(() => {
    fetchClips()
    fetchBootstrap()
  }, [fetchClips, fetchBootstrap])

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

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Client-side validation
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      setUploadError('File too large — maximum size is 500 MB')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploadFile(file)
    setUploadError(null)
    setUploadSuccess(false)
    setUploadProgress(0)
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))

    // Use XMLHttpRequest for real upload progress tracking
    const xhr = new XMLHttpRequest()

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.round((event.loaded / event.total) * 100))
      }
    })

    xhr.addEventListener('load', () => {
      try {
        const data = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300 && !data.error) {
          setUploadSuccess(true)
          setTimeout(() => {
            router.push(`/dashboard/enhance/${data.data.id}?source=upload`)
          }, 600)
        } else {
          setUploadError(data.message || 'Upload failed')
          setUploading(false)
        }
      } catch {
        setUploadError('Invalid server response')
        setUploading(false)
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    })

    xhr.addEventListener('error', () => {
      setUploadError('Network error')
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    })

    xhr.open('POST', '/api/upload')
    xhr.send(formData)
  }, [router])

  const feedTabs: { key: FeedFilter; label: string; icon: typeof Flame; count?: number }[] = [
    { key: 'all', label: 'All Clips', icon: Film },
    { key: 'remixes', label: 'My Remixes', icon: Scissors, count: remixCount || undefined },
  ]

  const remaining = totalCount - clips.length

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <WelcomeModal />
      <ReferralBonusBanner />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Browse Clips
          </h1>
          <p className="text-muted-foreground mt-1">
            The clips blowing up right now — engineered for the algorithm.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
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
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
        </div>
      </div>

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
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <TrendingUp className="h-4 w-4 text-purple-400 shrink-0" />
            <p className="text-muted-foreground">{twitchMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Feed tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {feedTabs.map(({ key, label, icon: Icon, count }) => (
          <Button
            key={key}
            variant={filters.feed === key ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'gap-1.5 h-8 text-xs shrink-0 transition-all',
              filters.feed === key
                ? 'shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setFeed(key)}
            aria-pressed={filters.feed === key}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {count !== undefined && count > 0 && (
              <span className="ml-0.5 text-[10px] opacity-70">({count})</span>
            )}
          </Button>
        ))}
      </div>

      {/* Filters */}
      <TrendingFilters
        filters={filters}
        onChange={setFilters}
        totalCount={clips.length}
        filteredCount={filteredClips.length}
        availableNiches={stats.games}
      />

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Remixes tab */}
      {filters.feed === 'remixes' ? (
        loadingRemixes ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card/60 overflow-hidden animate-pulse">
                <div className="aspect-video bg-gradient-to-br from-muted/40 to-muted/20" />
                <div className="p-3 space-y-2">
                  <div className="h-3.5 w-3/4 rounded bg-muted/50" />
                  <div className="h-3 w-1/2 rounded bg-muted/30" />
                </div>
              </div>
            ))}
          </div>
        ) : remixes.length === 0 ? (
          <Card className="border-border bg-card/50">
            <CardContent className="p-10 md:p-14 text-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-500/15 border border-orange-500/20 mb-4">
                <Scissors className="h-8 w-8 text-orange-400" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">No remixes yet</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                Boost a clip to create your first remix — it will appear here.
              </p>
              <Button size="sm" onClick={() => setFeed('all')}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Browse clips
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {remixes.map((remix) => (
              <RemixCard key={remix.id} remix={remix} />
            ))}
          </div>
        )
      ) :

      /* Clip Grid */
      loading ? (
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
            filters.duration !== 'all' ||
            filters.feed !== 'all'
          const noClipsAtAll = clips.length === 0
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
                    ? 'No clips in the library yet'
                    : 'No clips match your filters'}
                </h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
                  {noClipsAtAll
                    ? "Import clips from Twitch & Kick to get started."
                    : hasFilters
                      ? 'Try removing a filter or switching feeds.'
                      : 'Refresh the library — new clips are coming in.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {hasFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilters({ search: '', games: [], platforms: [], sort: 'velocity', duration: 'all', feed: 'all' })
                      }}
                    >
                      <X className="h-3.5 w-3.5 mr-1.5" />
                      Clear filters
                    </Button>
                  )}
                  {noClipsAtAll && (
                    <Button
                      size="sm"
                      className="bg-purple-500 hover:bg-purple-600 text-white"
                      onClick={handleTwitchRefresh}
                      disabled={twitchRefreshing}
                    >
                      {twitchRefreshing ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 py-4">
            {filteredClips.map((clip) => (
              <div key={clip.id} onClick={() => handleEnhance(clip)} className="cursor-pointer relative">
                <TrendingCard
                  clip={clip}
                  onRemix={handleEnhance}
                  onQuickExport={handleQuickExport}
                  quickExportState={quickExport}
                  remixing={false}
                  isSaved={savedClipIds.has(clip.id)}
                  onToggleSave={toggleSaveClip}
                  onToggleGroup={toggleGroup}
                  isGroupExpanded={clip.stream_group_id ? expandedGroups.has(clip.stream_group_id) : false}
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
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
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
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
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
            ? 'bg-zinc-900/95 border-violet-500/40'
            : 'bg-zinc-900/95 border-red-500/40'
        )}
        style={renderNotification.status === 'done' ? { boxShadow: '0 0 25px rgba(139,92,246,.15), 0 8px 32px rgba(0,0,0,.5)' } : undefined}
        >
          {renderNotification.status === 'done' ? (
            <div className="h-9 w-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5 text-violet-400" />
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
                className="px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors"
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
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Refreshing...</span>
        </div>
      )}

      <InstallBanner />
    </div>
  )
}
