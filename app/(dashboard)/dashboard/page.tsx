"use client"

import { useEffect, useCallback, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  RefreshCw, AlertCircle, Loader2, Sparkles,
  Download, Upload, Flame, Rocket, Zap, Filter,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingCard, type TrendingClip, getViralBadge } from '@/components/trending/trending-card'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type CategoryFilter = 'all' | 'trending' | 'high-potential' | 'recent' | 'viral-only'

const CATEGORIES: { id: CategoryFilter; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'all', label: 'Tous', icon: <Sparkles className="h-3.5 w-3.5" />, color: 'text-foreground' },
  { id: 'trending', label: 'Trending now', icon: <Flame className="h-3.5 w-3.5" />, color: 'text-red-400' },
  { id: 'high-potential', label: 'High potential', icon: <Rocket className="h-3.5 w-3.5" />, color: 'text-orange-400' },
  { id: 'recent', label: 'Recently viral', icon: <Zap className="h-3.5 w-3.5" />, color: 'text-amber-400' },
  { id: 'viral-only', label: 'High viral potential', icon: <Filter className="h-3.5 w-3.5" />, color: 'text-emerald-400' },
]

export default function DashboardPage() {
  const router = useRouter()
  const [clips, setClips] = useState<TrendingClip[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [twitchRefreshing, setTwitchRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')

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
      setClips((data as unknown as TrendingClip[]) ?? [])
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

  // ── Smart filtering ──
  const filtered = useMemo(() => {
    let result = clips

    // Search filter
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(c =>
        c.title?.toLowerCase().includes(q) ||
        c.author_name?.toLowerCase().includes(q) ||
        c.author_handle?.toLowerCase().includes(q)
      )
    }

    // Category filter
    switch (category) {
      case 'trending': {
        // Highest velocity scores
        result = [...result].sort((a, b) => (b.velocity_score ?? 0) - (a.velocity_score ?? 0))
        break
      }
      case 'high-potential': {
        // Mid-range velocity with room to grow
        result = result.filter(c => {
          const v = c.velocity_score ?? 0
          return v >= 20 && v < 70
        })
        result = [...result].sort((a, b) => (b.velocity_score ?? 0) - (a.velocity_score ?? 0))
        break
      }
      case 'recent': {
        // Most recently scraped
        result = [...result].sort((a, b) => {
          const dateA = a.scraped_at ? new Date(a.scraped_at).getTime() : 0
          const dateB = b.scraped_at ? new Date(b.scraped_at).getTime() : 0
          return dateB - dateA
        })
        break
      }
      case 'viral-only': {
        // Only clips with viral badge + short duration
        result = result.filter(c => {
          const badge = getViralBadge(c)
          const duration = c.duration_seconds ?? 20
          return badge !== null && duration <= 15
        })
        break
      }
    }

    return result
  }, [clips, search, category])

  // Featured clips: top 2 by velocity for the hero section
  const featuredClips = useMemo(() => {
    if (category !== 'all' || search) return []
    return [...clips]
      .sort((a, b) => (b.velocity_score ?? 0) - (a.velocity_score ?? 0))
      .slice(0, 2)
  }, [clips, category, search])

  const regularClips = useMemo(() => {
    if (featuredClips.length === 0) return filtered
    const featuredIds = new Set(featuredClips.map(c => c.id))
    return filtered.filter(c => !featuredIds.has(c.id))
  }, [filtered, featuredClips])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Flame className="h-7 w-7 text-orange-500" />
            Browse Clips
          </h1>
          <p className="text-muted-foreground mt-1">
            Choisis un clip viral, boost-le en 1 clic et exporte.
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

      {/* Category tabs + Search */}
      <div className="space-y-3">
        {/* Category pills */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
                category === cat.id
                  ? 'bg-white/10 border-white/20 text-foreground shadow-sm'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <span className={cn(category === cat.id ? cat.color : 'text-muted-foreground')}>{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <Input
          placeholder="Rechercher un clip ou streamer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
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

      {/* Loading */}
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
        <div className="space-y-8">
          {/* Featured hero clips — bigger cards */}
          {featuredClips.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Flame className="h-4 w-4 text-red-400" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Top Viral</h2>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                {featuredClips.map((clip) => (
                  <div key={clip.id} onClick={() => handleEnhance(clip)} className="cursor-pointer">
                    <TrendingCard
                      clip={clip}
                      onRemix={handleEnhance}
                      remixing={false}
                      featured
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Regular grid */}
          <div>
            {featuredClips.length > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="h-4 w-4 text-blue-400" />
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Tous les clips</h2>
              </div>
            )}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {regularClips.map((clip) => (
                <div key={clip.id} onClick={() => handleEnhance(clip)} className="cursor-pointer">
                  <TrendingCard
                    clip={clip}
                    onRemix={handleEnhance}
                    remixing={false}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
