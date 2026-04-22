import { create } from 'zustand'
import type { TrendingClip, TrendingStats, TrendingFiltersState, ViralNotification, SavedClip, FeedFilter, ClipRank } from '@/types/trending'
import { clipRank } from '@/types/trending'
import { SEED_CLIPS } from '@/lib/trending/seed-data'

// Re-export types for backward compatibility
export type { TrendingClip, TrendingStats, TrendingFiltersState, ViralNotification, SortOption, SavedClip, ClipRank } from '@/types/trending'

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_FILTERS: TrendingFiltersState = {
  search: '',
  games: [],
  platforms: [],
  sort: 'velocity',
  duration: 'all',
  feed: 'all',
}

const EMPTY_RANK_COUNTS: Record<ClipRank, number> = {
  unranked: 0, bronze: 0, silver: 0, gold: 0, platinum: 0, diamond: 0, champion: 0,
}

const EMPTY_STATS: TrendingStats = {
  total: 0, viral: 0, hot: 0,
  topGame: null, topPlatform: null,
  avgVelocity: 0, platforms: {}, games: {},
  lastScrapedAt: null,
  hotNowCount: 0, earlyGemCount: 0, provenCount: 0,
  rankCounts: { ...EMPTY_RANK_COUNTS },
}

// ─── Pure utility functions ─────────────────────────────────────────────────

function computeStatsFromClips(clips: TrendingClip[]): TrendingStats {
  if (clips.length === 0) return EMPTY_STATS

  const platforms: Record<string, number> = {}
  const games: Record<string, number> = {}
  let totalVelocity = 0
  let viral = 0
  let hot = 0
  let hotNowCount = 0
  let earlyGemCount = 0
  let provenCount = 0
  let lastScrapedAt: string | null = null
  const rankCounts: Record<ClipRank, number> = { ...EMPTY_RANK_COUNTS }

  for (const clip of clips) {
    const v = clip.velocity_score ?? 0
    totalVelocity += v
    if (v >= 80) viral++
    if (v >= 50) hot++

    rankCounts[clipRank(clip)]++

    if (clip.feed_category === 'hot_now') hotNowCount++
    if (clip.feed_category === 'early_gem') earlyGemCount++
    if (clip.feed_category === 'proven') provenCount++

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
    hotNowCount, earlyGemCount, provenCount,
    rankCounts,
  }
}

function filterAndSortClips(
  clips: TrendingClip[],
  filters: TrendingFiltersState,
  savedClipIds: Set<string>
): TrendingClip[] {
  let result = [...clips]

  // Feed filter
  if (filters.feed === 'hot_now') {
    result = result.filter((c) => c.feed_category === 'hot_now')
  } else if (filters.feed === 'early_gem') {
    result = result.filter((c) => c.feed_category === 'early_gem')
  } else if (filters.feed === 'proven') {
    result = result.filter((c) => c.feed_category === 'proven')
  } else if (filters.feed === 'saved') {
    result = result.filter((c) => savedClipIds.has(c.id))
  }

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

  // Duration filter
  if (filters.duration === 'short') {
    result = result.filter((c) => (c.duration_seconds ?? 0) < 30)
  } else if (filters.duration === 'medium') {
    result = result.filter((c) => {
      const d = c.duration_seconds ?? 0
      return d >= 30 && d < 60
    })
  } else if (filters.duration === 'long') {
    result = result.filter((c) => (c.duration_seconds ?? 0) >= 60)
  }

  // Sort
  if (filters.feed === 'recent' || filters.sort === 'date') {
    result.sort((a, b) => new Date(b.clip_created_at ?? b.scraped_at ?? 0).getTime() - new Date(a.clip_created_at ?? a.scraped_at ?? 0).getTime())
  } else {
    result.sort((a, b) => (b.velocity_score ?? 0) - (a.velocity_score ?? 0))
  }

  return result
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface TrendingState {
  // Data
  clips: TrendingClip[]
  filteredClips: TrendingClip[]
  megaViralClips: TrendingClip[]
  trendingClips: TrendingClip[]
  stats: TrendingStats

  // Pagination
  hasMore: boolean
  loadingMore: boolean
  totalCount: number

  // Saved/Favorites
  savedClipIds: Set<string>
  savedClips: SavedClip[]

  // Filters
  filters: TrendingFiltersState

  // UI
  loading: boolean
  refreshing: boolean
  error: string | null
  usingSeed: boolean
  autoRefreshEnabled: boolean
  autoRefreshInterval: number
  lastRefreshed: string | null

  // Notifications
  notifications: ViralNotification[]
  notificationsRead: boolean

  // Actions
  setFilters: (filters: TrendingFiltersState) => void
  setFeed: (feed: FeedFilter) => void
  setAutoRefresh: (enabled: boolean) => void
  markNotificationsRead: () => void
  fetchClips: (silent?: boolean) => Promise<void>
  loadMore: () => Promise<void>
  computeStats: () => void
  applyFilters: () => void
  fetchSavedClips: () => Promise<void>
  toggleSaveClip: (clipId: string) => Promise<void>
}

export const useTrendingStore = create<TrendingState>((set, get) => ({
  clips: [],
  filteredClips: [],
  megaViralClips: [],
  trendingClips: [],
  stats: EMPTY_STATS,
  hasMore: false,
  loadingMore: false,
  totalCount: 0,
  savedClipIds: new Set(),
  savedClips: [],
  filters: DEFAULT_FILTERS,
  loading: true,
  refreshing: false,
  error: null,
  usingSeed: false,
  autoRefreshEnabled: true,
  autoRefreshInterval: 60_000,
  lastRefreshed: null,
  notifications: [],
  notificationsRead: true,

  setFilters: (filters) => {
    set({ filters })
    get().applyFilters()
  },

  setFeed: (feed) => {
    const { filters } = get()
    set({ filters: { ...filters, feed } })
    get().applyFilters()
  },

  setAutoRefresh: (enabled) => set({ autoRefreshEnabled: enabled }),
  markNotificationsRead: () => set({ notificationsRead: true }),

  fetchClips: async (silent = false) => {
    const state = get()
    if (!silent) set({ loading: true })
    else set({ refreshing: true })
    set({ error: null })

    try {
      const params = new URLSearchParams({ sort: state.filters.sort, limit: '200' })
      const res = await fetch(`/api/trending?${params}`)
      const json = await res.json() as { data: TrendingClip[] | null; error: string | null; meta?: { total: number } }

      if (!res.ok || json.error) throw new Error(json.error ?? 'Network error')

      const prevClips = state.clips
      let clips: TrendingClip[]
      let usingSeed: boolean

      if (!json.data || json.data.length === 0) {
        clips = SEED_CLIPS
        usingSeed = true
      } else {
        clips = json.data
        usingSeed = false
      }

      const totalCount = json.meta?.total ?? clips.length
      const hasMore = clips.length < totalCount

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
        totalCount,
        hasMore,
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
        error: err instanceof Error ? err.message : 'Unknown error',
        clips: SEED_CLIPS,
        usingSeed: true,
      })
      get().computeStats()
      get().applyFilters()
    } finally {
      set({ loading: false, refreshing: false })
    }
  },

  loadMore: async () => {
    const { clips, totalCount, loadingMore, filters } = get()
    if (loadingMore || clips.length >= totalCount) return

    set({ loadingMore: true })
    try {
      const params = new URLSearchParams({
        sort: filters.sort,
        limit: '50',
        offset: String(clips.length),
      })
      const res = await fetch(`/api/trending?${params}`)
      const json = await res.json() as { data: TrendingClip[] | null; error: string | null; meta?: { total: number } }

      if (!res.ok || json.error) throw new Error(json.error ?? 'Network error')

      const newClips = json.data ?? []
      const allClips = [...clips, ...newClips]
      const newTotal = json.meta?.total ?? totalCount

      set({
        clips: allClips,
        totalCount: newTotal,
        hasMore: allClips.length < newTotal,
      })

      get().computeStats()
      get().applyFilters()
    } catch {
      // silent
    } finally {
      set({ loadingMore: false })
    }
  },

  computeStats: () => {
    const { clips } = get()
    set({ stats: computeStatsFromClips(clips) })
  },

  applyFilters: () => {
    const { clips, filters, savedClipIds } = get()
    const filtered = filterAndSortClips(clips, filters, savedClipIds)
    const megaViralClips = filtered.filter((c) => clipRank(c) === 'champion' || clipRank(c) === 'diamond')
    const trendingClips = filtered.filter((c) => clipRank(c) !== 'champion' && clipRank(c) !== 'diamond')
    set({ filteredClips: filtered, megaViralClips, trendingClips })
  },

  fetchSavedClips: async () => {
    try {
      const res = await fetch('/api/clips/saved')
      const json = await res.json()
      if (json.error) return

      const saved = (json.data ?? []) as SavedClip[]
      const ids = new Set(saved.map((s) => s.clip_id))
      set({ savedClips: saved, savedClipIds: ids })
      get().applyFilters()
    } catch {
      // silent
    }
  },

  toggleSaveClip: async (clipId) => {
    const { savedClipIds } = get()
    const isSaved = savedClipIds.has(clipId)

    // Optimistic update
    const newIds = new Set(savedClipIds)
    if (isSaved) {
      newIds.delete(clipId)
    } else {
      newIds.add(clipId)
    }
    set({ savedClipIds: newIds })

    try {
      if (isSaved) {
        await fetch(`/api/clips/saved/${clipId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/clips/saved', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clip_id: clipId }),
        })
      }
      // Re-fetch to sync
      get().fetchSavedClips()
    } catch {
      // Rollback
      set({ savedClipIds })
    }
  },
}))
