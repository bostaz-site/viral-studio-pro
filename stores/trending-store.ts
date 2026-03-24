import { create } from 'zustand'

export interface TrendingClip {
  id: string
  external_url: string
  platform: string
  author_name: string | null
  author_handle: string | null
  title: string | null
  description: string | null
  niche: string | null
  view_count: number | null
  like_count: number | null
  velocity_score: number | null
  thumbnail_url: string | null
  scraped_at: string | null
  created_at: string | null
}

export interface TrendingStats {
  total: number
  viral: number        // velocity >= 80
  hot: number          // velocity >= 50
  topNiche: string | null
  topPlatform: string | null
  avgVelocity: number
  platforms: Record<string, number>
  niches: Record<string, number>
  lastScrapedAt: string | null
}

export type SortOption = 'velocity' | 'views' | 'date'

export interface TrendingFiltersState {
  search: string
  niches: string[]
  platforms: string[]
  sort: SortOption
}

interface TrendingState {
  clips: TrendingClip[]
  filteredClips: TrendingClip[]
  stats: TrendingStats
  filters: TrendingFiltersState
  loading: boolean
  refreshing: boolean
  error: string | null
  usingSeed: boolean
  remixingId: string | null
  autoRefreshEnabled: boolean
  autoRefreshInterval: number // ms
  lastRefreshed: string | null
  notifications: ViralNotification[]
  notificationsRead: boolean

  // Actions
  setFilters: (filters: TrendingFiltersState) => void
  setRemixingId: (id: string | null) => void
  setAutoRefresh: (enabled: boolean) => void
  markNotificationsRead: () => void
  fetchClips: (silent?: boolean) => Promise<void>
  computeStats: () => void
  applyFilters: () => void
}

export interface ViralNotification {
  id: string
  clipTitle: string
  platform: string
  velocityScore: number
  timestamp: string
}

const DEFAULT_FILTERS: TrendingFiltersState = {
  search: '',
  niches: [],
  platforms: [],
  sort: 'velocity',
}

const EMPTY_STATS: TrendingStats = {
  total: 0,
  viral: 0,
  hot: 0,
  topNiche: null,
  topPlatform: null,
  avgVelocity: 0,
  platforms: {},
  niches: {},
  lastScrapedAt: null,
}

// Seed data for development
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
    title: "Ce bug ChatGPT va changer tout ce que tu sais sur l'IA",
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
    title: "J'ai fait 10k€ en 30 jours avec cette méthode",
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

function computeStatsFromClips(clips: TrendingClip[]): TrendingStats {
  if (clips.length === 0) return EMPTY_STATS

  const platforms: Record<string, number> = {}
  const niches: Record<string, number> = {}
  let totalVelocity = 0
  let viral = 0
  let hot = 0
  let lastScrapedAt: string | null = null

  for (const clip of clips) {
    const v = clip.velocity_score ?? 0
    totalVelocity += v
    if (v >= 80) viral++
    if (v >= 50) hot++

    const p = clip.platform.toLowerCase()
    platforms[p] = (platforms[p] ?? 0) + 1

    if (clip.niche) {
      const n = clip.niche.toLowerCase()
      niches[n] = (niches[n] ?? 0) + 1
    }

    if (clip.scraped_at && (!lastScrapedAt || clip.scraped_at > lastScrapedAt)) {
      lastScrapedAt = clip.scraped_at
    }
  }

  const topNiche = Object.entries(niches).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topPlatform = Object.entries(platforms).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    total: clips.length,
    viral,
    hot,
    topNiche,
    topPlatform,
    avgVelocity: Math.round(totalVelocity / clips.length),
    platforms,
    niches,
    lastScrapedAt,
  }
}

function filterAndSortClips(clips: TrendingClip[], filters: TrendingFiltersState): TrendingClip[] {
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

  if (filters.sort === 'velocity') {
    result.sort((a, b) => (b.velocity_score ?? 0) - (a.velocity_score ?? 0))
  } else if (filters.sort === 'views') {
    result.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0))
  } else {
    result.sort((a, b) => new Date(b.scraped_at ?? 0).getTime() - new Date(a.scraped_at ?? 0).getTime())
  }

  return result
}

export const useTrendingStore = create<TrendingState>((set, get) => ({
  clips: [],
  filteredClips: [],
  stats: EMPTY_STATS,
  filters: DEFAULT_FILTERS,
  loading: true,
  refreshing: false,
  error: null,
  usingSeed: false,
  remixingId: null,
  autoRefreshEnabled: true,
  autoRefreshInterval: 60_000, // 60s
  lastRefreshed: null,
  notifications: [],
  notificationsRead: true,

  setFilters: (filters) => {
    set({ filters })
    get().applyFilters()
  },

  setRemixingId: (id) => set({ remixingId: id }),

  setAutoRefresh: (enabled) => set({ autoRefreshEnabled: enabled }),

  markNotificationsRead: () => set({ notificationsRead: true }),

  fetchClips: async (silent = false) => {
    const state = get()
    if (!silent) set({ loading: true })
    else set({ refreshing: true })
    set({ error: null })

    try {
      const params = new URLSearchParams({ sort: state.filters.sort, limit: '100' })
      const res = await fetch(`/api/trending?${params}`)
      const data = await res.json() as { data: TrendingClip[] | null; error: string | null }

      if (!res.ok || data.error) throw new Error(data.error ?? 'Erreur réseau')

      const prevClips = state.clips
      let clips: TrendingClip[]
      let usingSeed: boolean

      if (!data.data || data.data.length === 0) {
        clips = SEED_CLIPS
        usingSeed = true
      } else {
        clips = data.data
        usingSeed = false
      }

      // Detect new viral clips for notifications
      const newNotifications: ViralNotification[] = []
      if (prevClips.length > 0 && !usingSeed) {
        const prevIds = new Set(prevClips.map((c) => c.id))
        for (const clip of clips) {
          if (!prevIds.has(clip.id) && (clip.velocity_score ?? 0) >= 80) {
            newNotifications.push({
              id: clip.id,
              clipTitle: clip.title ?? 'Clip viral',
              platform: clip.platform,
              velocityScore: clip.velocity_score ?? 0,
              timestamp: new Date().toISOString(),
            })
          }
        }
      }

      set({
        clips,
        usingSeed,
        lastRefreshed: new Date().toISOString(),
        ...(newNotifications.length > 0 ? {
          notifications: [...newNotifications, ...state.notifications].slice(0, 20),
          notificationsRead: false,
        } : {}),
      })

      // Recompute derived state
      get().computeStats()
      get().applyFilters()
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Erreur inconnue',
        clips: SEED_CLIPS,
        usingSeed: true,
      })
      get().computeStats()
      get().applyFilters()
    } finally {
      set({ loading: false, refreshing: false })
    }
  },

  computeStats: () => {
    const { clips } = get()
    set({ stats: computeStatsFromClips(clips) })
  },

  applyFilters: () => {
    const { clips, filters } = get()
    set({ filteredClips: filterAndSortClips(clips, filters) })
  },
}))
