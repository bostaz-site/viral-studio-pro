"use client"

import { useEffect, useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  TrendingUp, RefreshCw, AlertCircle, Loader2, Sparkles,
  Wifi, WifiOff, Download, Upload,
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingCard } from '@/components/trending/trending-card'
import { TrendingFilters } from '@/components/trending/trending-filters'
import { useTrendingStore, type TrendingClip } from '@/stores/trending-store'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [twitchRefreshing, setTwitchRefreshing] = useState(false)
  const [twitchMessage, setTwitchMessage] = useState<string | null>(null)

  const {
    filteredClips,
    filters,
    loading,
    refreshing,
    error,
    autoRefreshEnabled,
    autoRefreshInterval,
    clips,
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
        setTwitchMessage(`${data.data?.upserted ?? 0} clips import&eacute;s depuis Twitch`)
        fetchClips(true)
      }
    } catch {
      setTwitchMessage('Erreur r&eacute;seau')
    } finally {
      setTwitchRefreshing(false)
      setTimeout(() => setTwitchMessage(null), 5000)
    }
  }, [fetchClips])

  // Navigate to enhance page when clicking a clip
  const handleEnhance = useCallback((clip: TrendingClip) => {
    router.push(`/dashboard/enhance/${clip.id}`)
  }, [router])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-primary" />
            Browse Clips
          </h1>
          <p className="text-muted-foreground mt-1">
            Choisis un clip trending, enhance-le et poste &mdash; en 3 clics.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-1">
          {/* Import own video */}
          <Link href="/create">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            >
              <Upload className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Importer ma vid&eacute;o</span>
            </Button>
          </Link>

          {/* Auto-refresh toggle */}
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'gap-1.5 text-xs h-8',
              autoRefreshEnabled ? 'text-green-400 hover:text-green-300' : 'text-muted-foreground'
            )}
            onClick={() => setAutoRefresh(!autoRefreshEnabled)}
            title={autoRefreshEnabled ? 'Auto-refresh actif (60s)' : 'Auto-refresh d\u00e9sactiv\u00e9'}
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
            {twitchRefreshing ? 'Import\u2026' : 'Twitch'}
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
            <span className="hidden sm:inline">Actualiser</span>
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
                <span className="font-bold text-foreground">{filteredClips.length} clips trending</span>
                <span className="text-muted-foreground"> disponibles maintenant</span>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Clip Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-muted-foreground">Chargement des clips\u2026</p>
        </div>
      ) : filteredClips.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="p-12 text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun clip trouv&eacute; pour ces filtres.</p>
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
          <span className="text-xs text-muted-foreground">Actualisation\u2026</span>
        </div>
      )}
    </div>
  )
}
