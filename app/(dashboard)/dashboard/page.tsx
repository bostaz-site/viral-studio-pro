"use client"

import { useEffect, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, AlertCircle, Loader2, Sparkles,
  Download, Upload,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingCard, type TrendingClip } from '@/components/trending/trending-card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export default function DashboardPage() {
  const router = useRouter()
  const [clips, setClips] = useState<TrendingClip[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [twitchRefreshing, setTwitchRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedGame, setSelectedGame] = useState<string | null>(null)

  const fetchClips = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from('trending_clips')
        .select('*')
        .order('view_count', { ascending: false })
        .limit(100)

      if (fetchError) throw new Error(fetchError.message)
      setClips((data as TrendingClip[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchClips() }, [fetchClips])

  const handleTwitchRefresh = useCallback(async () => {
    setTwitchRefreshing(true)
    try {
      const res = await fetch('/api/streams/refresh', { method: 'POST' })
      if (res.ok) fetchClips(true)
    } catch { /* ignore */ }
    finally { setTwitchRefreshing(false) }
  }, [fetchClips])

  const handleEnhance = useCallback((clip: TrendingClip) => {
    router.push(`/dashboard/enhance/${clip.id}`)
  }, [router])

  // Filters
  const games = [...new Set(clips.map(c => c.niche).filter(Boolean))] as string[]
  const filtered = clips.filter(c => {
    if (search && !c.title?.toLowerCase().includes(search.toLowerCase()) && !c.author_name?.toLowerCase().includes(search.toLowerCase())) return false
    if (selectedGame && c.niche !== selectedGame) return false
    return true
  })

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
            Choisis un clip, boost sa viralité et exporte.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0 mt-1">
          <Button
            className="gap-2 h-10 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-blue-500/20 px-5"
            onClick={() => router.push('/dashboard/enhance')}
          >
            <Upload className="h-4 w-4" />
            Importer mon clip
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 h-8 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            onClick={handleTwitchRefresh}
            disabled={twitchRefreshing}
          >
            {twitchRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {twitchRefreshing ? 'Import...' : 'Twitch'}
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={() => fetchClips(true)} disabled={refreshing}>
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Search & Game filter */}
      <div className="flex gap-3 flex-wrap">
        <Input
          placeholder="Rechercher un clip ou streamer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant={selectedGame === null ? 'default' : 'outline'}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSelectedGame(null)}
          >
            Tous
          </Button>
          {games.map(game => (
            <Button
              key={game}
              variant={selectedGame === game ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setSelectedGame(game === selectedGame ? null : game)}
            >
              {game}
            </Button>
          ))}
        </div>
      </div>

      {/* Counter */}
      {!loading && filtered.length > 0 && (
        <p className="text-sm text-muted-foreground">
          <span className="font-bold text-foreground">{filtered.length}</span> clips disponibles
        </p>
      )}

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
          <p className="text-muted-foreground">Chargement des clips...</p>
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-border bg-card/50">
          <CardContent className="p-12 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun clip trouvé.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filtered.map((clip) => (
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
    </div>
  )
}
