import { create } from 'zustand'

export interface TrendingClip {
  id: string
  external_url: string
  platform: string
  author_name: string | null
  author_handle: string | null
  title: string | null
  description: string | null
  niche: string | null          // Now used as game category
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
  topGame: string | null
  topPlatform: string | null
  avgVelocity: number
  platforms: Record<string, number>
  games: Record<string, number>
  lastScrapedAt: string | null
}

export type SortOption = 'velocity' | 'views' | 'date'

export interface TrendingFiltersState {
  search: string
  games: string[]
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
  games: [],
  platforms: [],
  sort: 'velocity',
}

const EMPTY_STATS: TrendingStats = {
  total: 0,
  viral: 0,
  hot: 0,
  topGame: null,
  topPlatform: null,
  avgVelocity: 0,
  platforms: {},
  games: {},
  lastScrapedAt: null,
}

// Seed data for development — stream clips
const SEED_CLIPS: TrendingClip[] = [
  {
    id: 'seed-1',
    external_url: 'https://clips.twitch.tv/example1',
    platform: 'twitch',
    author_name: 'Squeezie',
    author_handle: 'squeezie',
    title: 'IL CLUTCH LE 1V5 EN RANKED VALORANT',
    description: null,
    niche: 'valorant',
    view_count: 4_200_000,
    like_count: 312_000,
    velocity_score: 94.2,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-2',
    external_url: 'https://www.youtube.com/watch?v=example2',
    platform: 'youtube_gaming',
    author_name: 'Gotaga',
    author_handle: 'gotaga',
    title: 'CE SNIPE À 300M SUR FORTNITE EST INCROYABLE',
    description: null,
    niche: 'fortnite',
    view_count: 2_800_000,
    like_count: 198_000,
    velocity_score: 81.7,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-3',
    external_url: 'https://clips.twitch.tv/example3',
    platform: 'twitch',
    author_name: 'Kamet0',
    author_handle: 'kamet0',
    title: 'PENTAKILL AVEC YASUO EN RANKED CHALLENGER',
    description: null,
    niche: 'league_of_legends',
    view_count: 1_900_000,
    like_count: 145_000,
    velocity_score: 76.3,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-4',
    external_url: 'https://clips.twitch.tv/example4',
    platform: 'twitch',
    author_name: 'Sardoche',
    author_handle: 'sardoche',
    title: 'LE RAGE QUIT LE PLUS ÉPIQUE DE L\'ANNÉE',
    description: null,
    niche: 'irl',
    view_count: 3_500_000,
    like_count: 421_000,
    velocity_score: 88.5,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-5',
    external_url: 'https://clips.twitch.tv/example5',
    platform: 'twitch',
    author_name: 'ZEvent',
    author_handle: 'zevent',
    title: 'MOMENT LÉGENDAIRE DU ZEVENT — TOUT LE MONDE PLEURE',
    description: null,
    niche: 'apex_legends',
    view_count: 8_100_000,
    like_count: 924_000,
    velocity_score: 97.1,
    thumbnail_url: null,
    scraped_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
    created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(),
  },
  {
    id: 'seed-6',
    external_url: 'https://www.youtube.com/watch?v=example6',
    platform: 'youtube_gaming',
    author_name: 'Michou',
    author_handle: 'michou',
    title: 'JE SURVIS 100 JOURS SUR MINECRAFT HARDCORE',
    description: null,
    niche: 'minecraft',
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
  const games: Record<string, number> = {}
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
      const g = clip.niche.toLowerCase()
      games[g] = (games[g] ?? 0) + 1
    }

    if (clip.scraped_at && (!lastScrapedAt || clip.scraped_at > lastScrapedAt)) {
      lastScrapedAt = clip.scraped_at
    }
  }

  const topGame = Object.entries(games).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  const topPlatform = Object.entries(platforms).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    total: clips.length,
    viral,
    hot,
    topGame,
    topPlatform,
    avgVelocity: Math.round(totalVelocity / clips.length),
    platforms,
    games,
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

  if (filters.games.length > 0) {
    result = result.filter((c) => c.niche && filters.games.includes(c.niche.toLowerCase()))
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
