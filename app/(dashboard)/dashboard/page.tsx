"use client"

import { useEffect, useCallback, useRef, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, RefreshCw, AlertCircle, Loader2, Sparkles,
  Wifi, WifiOff, Download, Flame, Zap, Clock, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingCard } from '@/components/trending/trending-card'
import { TrendingFilters } from '@/components/trending/trending-filters'
import { WelcomeModal } from '@/components/onboarding/welcome-modal'
import { ReferralBonusBanner } from '@/components/onboarding/referral-bonus-banner'
import { useTrendingStore, type TrendingClip } from '@/stores/trending-store'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [twitchRefreshing, setTwitchRefreshing] = useState(false)
  const [twitchMessage, setTwitchMessage] = useState<string | null>(null)
  const [quickFilter, setQuickFilter] = useState<'all' | 'viral' | 'potential' | 'recent'>('all')

  const {
    filteredClips,
    filters,
    loading,
    refreshing,
    error,
    autoRefreshEnabled,
    autoRefreshInterval,
    clips,
    stats,
    setFilters,
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

  // Twitch refresh
  const handleTwitchRefresh = useCallback(async () => {
    setTwitchRefreshing(true)
    setTwitchMessage(null)
    try {
      const res = await fetch('/api/streams/refresh', { method: 'POST' })
      const data = await res.json() as { data: { upserted: number } | null; error: string | null; message: string }
      if (!res.ok || data.error) {
        setTwitchMessage(data.message ?? 'Erreur')
      } else {
        setTwitchMessage(`${data.data?.upserted ?? 0} clips importés depuis Twitch`)
        fetchClips(true)
      }
    } catch {
      setTwitchMessage('Erreur réseau')
    } finally {
      setTwitchRefreshing(false)
      setTimeout(() => setTwitchMessage(null), 5000)
    }
  }, [fetchClips])

  // Quick filter logic
  const displayClips = useMemo(() => {
    if (quickFilter === 'viral') {
      return filteredClips
        .filter(c => (c.velocity_score ?? 0) >= 70)
        .sort((a, b) => (b.velocity_score ?? 0) - (a.velocity_score ?? 0))
    }
    if (quickFilter === 'potential') {
      return filteredClips.filter(c => {
        const v = c.velocity_score ?? 0
        return v >= 40 && v < 70
      })
    }
    if (quickFilter === 'recent') {
      return [...filteredClips].sort(
        (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
      )
    }
    return filteredClips
  }, [filteredClips, quickFilter])

  // Navigate to enhance page when clicking a clip
  const handleEnhance = useCallback((clip: TrendingClip) => {
    router.push(`/dashboard/enhance/${clip.id}`)
  }, [router])

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
            Pick a trending clip, enhance it, and post — in 3 clicks.
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
            title={autoRefreshEnabled ? 'Auto-refresh on (60s)' : 'Auto-refresh off'}
            aria-label={autoRefreshEnabled ? 'Disable auto-refresh' : 'Enable auto-refresh'}
            aria-pressed={autoRefreshEnabled}
          >
            {autoRefreshEnabled ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            Live
          </Button>

          {/* Fetch from Twitch */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={handleTwitchRefresh}
            disabled={twitchRefreshing}
          >
            {twitchRefreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {twitchRefreshing ? 'Importing\u2026' : 'Twitch'}
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
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Twitch refresh toast */}
      {twitchMessage && (
        <Card className="border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-3 flex items-center gap-3 text-sm">
            <TrendingUp className="h-4 w-4 text-purple-400 shrink-0" />
            <p className="text-muted-foreground">{twitchMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* New clips counter */}
      {!loading && filteredClips.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm">
                <span className="font-bold text-foreground">{filteredClips.length} trending clips</span>
                <span className="text-muted-foreground"> available right now</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {([
          { key: 'all', label: 'All', icon: Sparkles },
          { key: 'viral', label: 'Trending now', icon: Flame },
          { key: 'potential', label: 'High potential', icon: Zap },
          { key: 'recent', label: 'Recent', icon: Clock },
        ] as const).map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={quickFilter === key ? 'default' : 'outline'}
            size="sm"
            className={cn(
              'gap-1.5 h-8 text-xs shrink-0 transition-all',
              quickFilter === key
                ? 'shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setQuickFilter(key)}
            aria-pressed={quickFilter === key}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
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

      {/* Clip Grid */}
      {loading ? (
        // Skeleton grid matching the real card layout
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card/40 overflow-hidden animate-pulse"
            >
              <div className="aspect-[9/16] bg-muted/40" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-3/4 rounded bg-muted/50" />
                <div className="h-3 w-1/2 rounded bg-muted/40" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-5 w-12 rounded-full bg-muted/40" />
                  <div className="h-5 w-16 rounded-full bg-muted/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : displayClips.length === 0 ? (
        // Context-aware empty state
        (() => {
          const hasFilters =
            filters.search !== '' ||
            filters.games.length > 0 ||
            filters.platforms.length > 0 ||
            quickFilter !== 'all'
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
                    ? "Import clips from Twitch to get started."
                    : hasFilters
                      ? 'Try removing a filter or niche, or search for a different streamer.'
                      : 'Refresh the library — new clips are coming in.'}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {hasFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilters({ search: '', games: [], platforms: [], sort: 'velocity' })
                        setQuickFilter('all')
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
                      Import from Twitch
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })()
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {displayClips.map((clip) => (
            <div key={clip.id} onClick={() => handleEnhance(clip)} className="cursor-pointer">
              <TrendingCard
                clip={clip}
                onRemix={handleEnhance}
                remixing={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* Refresh indicator */}
      {refreshing && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-lg animate-in slide-in-from-bottom-2 fade-in">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">Refreshing\u2026</span>
        </div>
      )}
    </div>
  )
}
