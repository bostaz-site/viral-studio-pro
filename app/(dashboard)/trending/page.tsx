"use client"

import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Gamepad2, RefreshCw, AlertCircle, Loader2, Sparkles, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingCard } from '@/components/trending/trending-card'
import { TrendingFilters } from '@/components/trending/trending-filters'
import { TrendingStatsPanel } from '@/components/trending/trending-stats'
import { TrendingDetailModal } from '@/components/trending/trending-detail-modal'
import { RemixProgress } from '@/components/trending/remix-progress'
import { useTrendingStore, type TrendingClip } from '@/stores/trending-store'
import { cn } from '@/lib/utils'

export default function TrendingPage() {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [selectedClip, setSelectedClip] = useState<TrendingClip | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [remixError, setRemixError] = useState<string | null>(null)
  const [remixClipTitle, setRemixClipTitle] = useState('')

  const {
    filteredClips,
    stats,
    filters,
    loading,
    refreshing,
    error,
    usingSeed,
    remixingId,
    autoRefreshEnabled,
    autoRefreshInterval,
    lastRefreshed,
    clips,
    setFilters,
    setRemixingId,
    setAutoRefresh,
    fetchClips,
  } = useTrendingStore()

  // Initial fetch
  useEffect(() => {
    fetchClips()
  }, [fetchClips])

  // Auto-refresh polling
  useEffect(() => {
    if (autoRefreshEnabled) {
      intervalRef.current = setInterval(() => {
        fetchClips(true)
      }, autoRefreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefreshEnabled, autoRefreshInterval, fetchClips])

  const handleRemix = useCallback(async (clip: TrendingClip) => {
    if (clip.id.startsWith('seed-')) {
      router.push('/create')
      return
    }

    setRemixingId(clip.id)
    setRemixClipTitle(clip.title ?? 'Clip tendance')
    setRemixError(null)
    setDetailOpen(false)

    try {
      const res = await fetch('/api/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trending_clip_id: clip.id }),
      })
      const data = await res.json() as { data: { video_id: string } | null; error: string | null; message: string }

      if (!res.ok || !data.data) throw new Error(data.message ?? 'Remix failed')

      router.push(`/create?video_id=${data.data.video_id}&mode=remix`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du remix'
      setRemixError(msg)
      useTrendingStore.setState({ error: msg })
    } finally {
      setRemixingId(null)
    }
  }, [router, setRemixingId])

  const handleCardClick = (clip: TrendingClip) => {
    setSelectedClip(clip)
    setDetailOpen(true)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Gamepad2 className="h-7 w-7 text-primary" />
            Clips de Streams
          </h1>
          <p className="text-muted-foreground mt-1">
            Les meilleurs moments de streams — clippez-les en 1 clic avec l&apos;IA
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {/* Auto-refresh toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'gap-1.5 text-xs h-8',
              autoRefreshEnabled ? 'text-green-400 hover:text-green-300' : 'text-muted-foreground'
            )}
            onClick={() => setAutoRefresh(!autoRefreshEnabled)}
            title={autoRefreshEnabled ? 'Auto-refresh actif (60s)' : 'Auto-refresh désactivé'}
          >
            {autoRefreshEnabled ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            Live
          </Button>

          {/* Manual refresh */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8"
            onClick={() => fetchClips(true)}
            disabled={refreshing}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Actualiser
          </Button>
        </div>
      </div>

      {/* Seed data notice */}
      {usingSeed && !loading && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <p className="text-muted-foreground">
              <span className="text-foreground font-medium">Données de démo.</span>{' '}
              Connectez n8n + The Hunter pour alimenter le dashboard en temps réel.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Panel */}
      <TrendingStatsPanel stats={stats} lastRefreshed={lastRefreshed} loading={loading} />

      {/* Filters */}
      <TrendingFilters
        filters={filters}
        onChange={setFilters}
        totalCount={clips.length}
        filteredCount={filteredClips.length}
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

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement des tendances…</p>
        </div>
      ) : filteredClips.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="p-12 text-center">
            <Gamepad2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun clip trouvé pour ces filtres.</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => setFilters({ search: '', games: [], platforms: [], sort: 'velocity' })}
            >
              Effacer les filtres
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredClips.map((clip) => (
            <div key={clip.id} onClick={() => handleCardClick(clip)} className="cursor-pointer">
              <TrendingCard
                clip={clip}
                onRemix={handleRemix}
                remixing={remixingId === clip.id}
              />
            </div>
          ))}
        </div>
      )}

      {/* Refresh indicator */}
      {refreshing && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-lg animate-in slide-in-from-bottom-2 fade-in">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Actualisation…</span>
        </div>
      )}

      {/* Remix Progress */}
      <RemixProgress
        active={remixingId !== null}
        clipTitle={remixClipTitle}
        onClose={() => { setRemixingId(null); setRemixError(null) }}
        error={remixError}
      />

      {/* Detail Modal */}
      <TrendingDetailModal
        clip={selectedClip}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onRemix={handleRemix}
        remixing={remixingId === selectedClip?.id}
      />
    </div>
  )
}
