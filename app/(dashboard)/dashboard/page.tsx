"use client"

import { useEffect, useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, RefreshCw, AlertCircle, Loader2, Sparkles,
  Download, Flame, Zap, Clock, X, Diamond, Trophy, Bookmark, Lock, Film,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingCard } from '@/components/trending/trending-card'
import { TrendingFilters } from '@/components/trending/trending-filters'
import { WelcomeModal } from '@/components/onboarding/welcome-modal'
import { ReferralBonusBanner } from '@/components/onboarding/referral-bonus-banner'
import { useTrendingStore, type TrendingClip } from '@/stores/trending-store'
import type { FeedFilter } from '@/types/trending'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const [twitchRefreshing, setTwitchRefreshing] = useState(false)
  const [twitchMessage, setTwitchMessage] = useState<string | null>(null)

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
  } = useTrendingStore()

  // Initial fetch
  useEffect(() => {
    fetchClips()
    fetchSavedClips()
  }, [fetchClips, fetchSavedClips])

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

  const feedTabs: { key: FeedFilter; label: string; icon: typeof Flame; count?: number }[] = [
    { key: 'all', label: 'All Clips', icon: Film },
    { key: 'hot_now', label: 'On Fire', icon: Flame, count: stats.hotNowCount },
    { key: 'early_gem', label: 'Hidden Gems', icon: Diamond, count: stats.earlyGemCount },
    { key: 'proven', label: 'Hall of Fame', icon: Trophy, count: stats.provenCount },
    { key: 'recent', label: 'Fresh Drop', icon: Zap },
    { key: 'saved', label: 'My Vault', icon: Lock, count: savedClipIds.size },
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

      {/* Clip Grid */}
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
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {filteredClips.map((clip) => (
              <div key={clip.id} onClick={() => handleEnhance(clip)} className="cursor-pointer">
                <TrendingCard
                  clip={clip}
                  onRemix={handleEnhance}
                  remixing={false}
                  isSaved={savedClipIds.has(clip.id)}
                  onToggleSave={toggleSaveClip}
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

      {/* Refresh indicator */}
      {refreshing && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-2 rounded-full bg-card border border-border shadow-lg animate-in slide-in-from-bottom-2 fade-in">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />          <span className="text-xs text-muted-foreground">Refreshing...</span>
        </div>
      )}
    </div>
  )
}
