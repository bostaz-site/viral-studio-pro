"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { TrendingUp, RefreshCw, AlertCircle, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { TrendingCard, type TrendingClip } from '@/components/trending/trending-card'
import { TrendingFilters, type TrendingFiltersState } from '@/components/trending/trending-filters'
import { cn } from '@/lib/utils'

const DEFAULT_FILTERS: TrendingFiltersState = {
  search: '',
  niches: [],
  platforms: [],
  sort: 'velocity',
}

// Seed data for development (shown when DB is empty)
const SEED_CLIPS: TrendingClip[] = [
  {
    id: 'seed-1',
    external_url: 'https://www.tiktok.com/',
    platform: 'tiktok',
    author_name: 'ScienceFact',
    author_handle: 'sciencefact',
    title: 'La vérité sur les trous noirs que personne ne vous dit',
    description: null,
    niche: 'science',
    view_count: 4_200_000,
    like_count: 312_000,
    velocity_score: 94.2,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-2',
    external_url: 'https://www.youtube.com/shorts/',
    platform: 'youtube',
    author_name: 'TechInsider',
    author_handle: 'techinsider',
    title: 'Ce bug ChatGPT va changer tout ce que tu sais sur l\'IA',
    description: null,
    niche: 'tech',
    view_count: 2_800_000,
    like_count: 198_000,
    velocity_score: 81.7,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-3',
    external_url: 'https://www.instagram.com/reels/',
    platform: 'instagram',
    author_name: 'BusinessMindset',
    author_handle: 'businessmindset',
    title: 'J\'ai fait 10k€ en 30 jours avec cette méthode',
    description: null,
    niche: 'business',
    view_count: 1_900_000,
    like_count: 145_000,
    velocity_score: 76.3,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-4',
    external_url: 'https://www.tiktok.com/',
    platform: 'tiktok',
    author_name: 'FitLife',
    author_handle: 'fitlife',
    title: '5 minutes par jour = transformation en 30 jours',
    description: null,
    niche: 'fitness',
    view_count: 3_500_000,
    like_count: 421_000,
    velocity_score: 88.5,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-5',
    external_url: 'https://www.tiktok.com/',
    platform: 'tiktok',
    author_name: 'ComedyClub',
    author_handle: 'comedyclub',
    title: 'Quand ton chef arrive le vendredi à 17h58',
    description: null,
    niche: 'comedy',
    view_count: 8_100_000,
    like_count: 924_000,
    velocity_score: 97.1,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-6',
    external_url: 'https://www.youtube.com/shorts/',
    platform: 'youtube',
    author_name: 'EduContent',
    author_handle: 'educontent',
    title: 'Apprendre Python en 60 secondes — vraiment',
    description: null,
    niche: 'education',
    view_count: 1_200_000,
    like_count: 89_000,
    velocity_score: 62.4,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
  },
]

export default function TrendingPage() {
  const router = useRouter()
  const [clips, setClips] = useState<TrendingClip[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<TrendingFiltersState>(DEFAULT_FILTERS)
  const [remixingId, setRemixingId] = useState<string | null>(null)
  const [usingSeed, setUsingSeed] = useState(false)

  const fetchClips = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const params = new URLSearchParams({ sort: filters.sort, limit: '100' })
      const res = await fetch(`/api/trending?${params}`)
      const data = await res.json() as { data: TrendingClip[] | null; error: string | null }

      if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur réseau')

      if (!data.data || data.data.length === 0) {
        setClips(SEED_CLIPS)
        setUsingSeed(true)
      } else {
        setClips(data.data)
        setUsingSeed(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
      setClips(SEED_CLIPS)
      setUsingSeed(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [filters.sort])

  useEffect(() => { fetchClips() }, [fetchClips])

  // Client-side filtering (search, niche, platform)
  const filteredClips = useMemo(() => {
    let result = [...clips]

    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.author_name?.toLowerCase().includes(q) ||
          c.author_handle?.toLowerCase().includes(q)
      )
    }

    if (filters.platforms.length > 0) {
      result = result.filter((c) => filters.platforms.includes(c.platform.toLowerCase()))
    }

    if (filters.niches.length > 0) {
      result = result.filter((c) => c.niche && filters.niches.includes(c.niche.toLowerCase()))
    }

    // Sort (already done server-side, but re-apply after client filter)
    if (filters.sort === 'velocity') {
      result.sort((a, b) => (b.velocity_score ?? 0) - (a.velocity_score ?? 0))
    } else if (filters.sort === 'views') {
      result.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
    } else {
      result.sort((a, b) => new Date(b.scraped_at ?? 0).getTime() - new Date(a.scraped_at ?? 0).getTime())
    }

    return result
  }, [clips, filters])

  const handleRemix = useCallback(async (clip: TrendingClip) => {
    // Seed clips are placeholders — redirect to create page for manual URL import
    if (clip.id.startsWith('seed-')) {
      router.push('/create')
      return
    }

    setRemixingId(clip.id)
    try {
      const res = await fetch('/api/remix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trending_clip_id: clip.id }),
      })
      const data = await res.json() as { data: { video_id: string } | null; error: string | null; message: string }

      if (!res.ok || !data.data) throw new Error(data.message ?? 'Remix failed')

      // Redirect to create page which will show the processing state
      router.push(`/create?video_id=${data.data.video_id}&mode=remix`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du remix')
    } finally {
      setRemixingId(null)
    }
  }, [router])

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-primary" />
            Tendances Virales
          </h1>
          <p className="text-muted-foreground mt-1">
            Clips en explosion de vues — remixez-les en 1 clic avec l&apos;IA
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0 mt-1"
          onClick={() => fetchClips(true)}
          disabled={refreshing}
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Actualiser
        </Button>
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
            <TrendingUp className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Aucun clip trouvé pour ces filtres.</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Effacer les filtres
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
          {filteredClips.map((clip) => (
            <TrendingCard
              key={clip.id}
              clip={clip}
              onRemix={handleRemix}
              remixing={remixingId === clip.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
