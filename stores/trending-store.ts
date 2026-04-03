import { create } from 'zustand'
import type { TrendingClip, TrendingStats, TrendingFiltersState, ViralNotification } from '@/types/trending'
import { SEED_CLIPS } from '@/lib/trending/seed-data'

// Re-export types for backward compatibility
export type { TrendingClip, TrendingStats, TrendingFiltersState, ViralNotification, SortOption } from '@/types/trending'

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: TrendingFiltersState = {
  search: '',
  games: [],
  platforms: [],
  sort: 'velocity',
}

const EMPTY_STATS: TrendingStats = {
  total: 0, viral: 0, hot: 0,
  topGame: null, topPlatform: null,
  avgVelocity: 0, platforms: {}, games: {},
  lastScrapedAt: null,
}

// ─── Pure utility functions ─────────────────────────────────────────────────

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
    total: clips.length, viral, hot, topGame, topPlatform,
    avgVelocity: Math.round(totalVelocity / clips.length),
    platforms, games, lastScrapedAt,
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

// ─── Store ──────────────────────────────────────────────────────────────────

interface TrendingState {
  // Data
  clips: TrendingClip[]
  filteredClips: TrendingClip[]
  stats: TrendingStats

  // Filters
  filters: TrendingFiltersState

  // UI
  loading: boolean
  refreshing: boolean
  error: string | null
  usingSeed: boolean
  remixingId: string | null
  autoRefreshEnabled: boolean
  autoRefreshInterval: number
  lastRefreshed: string | null

  // Notifications
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
  autoRefreshInterval: 60_000,
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
