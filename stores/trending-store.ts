import { create } from 'zustand'
import type { TrendingClip, TrendingStats, TrendingFiltersState, ViralNotification, SavedClip, FeedFilter, ClipRank } from '@/types/trending'
import { clipRank } from '@/types/trending'

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
  common: 0, rare: 0, super_rare: 0, epic: 0, legendary: 0, master: 0,
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

// ─── Bootstrap types ────────────────────────────────────────────────────────

export interface BootstrapRemix {
  id: string
  clip_id: string
  source: string
  status: string
  storage_path: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

interface BootstrapResponse {
  saved_clip_ids: string[]
  recent_remixes: BootstrapRemix[]
  profile: { plan: string; monthly_videos_used: number; bonus_videos: number } | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Check if any server-filterable filters are active */
function hasServerFilters(f: TrendingFiltersState): boolean {
  return (
    f.search !== '' ||
    f.games.length > 0 ||
    f.platforms.length > 0 ||
    f.duration !== 'all' ||
    (f.feed !== 'all' && f.feed !== 'saved' && f.feed !== 'remixes')
  )
}

/** Build URLSearchParams from filters for the /api/trending call */
function buildFilterParams(f: TrendingFiltersState): URLSearchParams {
  const params = new URLSearchParams({ sort: f.sort })

  // Server-side filters — only add when active
  if (f.search) params.set('search', f.search)
  if (f.games.length > 0) params.set('niche', f.games.join(','))
  if (f.platforms.length > 0) params.set('platform', f.platforms.join(','))
  if (f.duration !== 'all') params.set('duration', f.duration)
  if (f.feed === 'hot_now' || f.feed === 'early_gem' || f.feed === 'proven' || f.feed === 'recent') {
    params.set('feed', f.feed)
  }

  return params
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface TrendingState {
  // Data
  clips: TrendingClip[]
  filteredClips: TrendingClip[]
  megaViralClips: TrendingClip[]
  trendingClips: TrendingClip[]
  stats: TrendingStats

  // Pagination (cursor-based)
  cursor: string | null
  hasMore: boolean
  loadingMore: boolean
  totalCount: number

  // Saved/Favorites
  savedClipIds: Set<string>
  savedClips: SavedClip[]

  // Stream grouping
  expandedGroups: Set<string>

  // Bootstrap data
  userPlan: string | null
  monthlyVideosUsed: number
  bonusVideos: number
  recentRemixes: BootstrapRemix[]

  // Filters
  filters: TrendingFiltersState

  // UI
  loading: boolean
  refreshing: boolean
  error: string | null
  autoRefreshEnabled: boolean
  autoRefreshInterval: number
  lastRefreshed: string | null

  // Notifications
  notifications: ViralNotification[]
  notificationsRead: boolean

  // Internal — debounce timer for search
  _searchDebounce: ReturnType<typeof setTimeout> | null

  // Actions
  setFilters: (filters: TrendingFiltersState) => void
  setFeed: (feed: FeedFilter) => void
  setAutoRefresh: (enabled: boolean) => void
  markNotificationsRead: () => void
  fetchClips: (silent?: boolean) => Promise<void>
  loadMore: () => Promise<void>
  computeStats: () => void
  applyFilters: () => void
  fetchBootstrap: () => Promise<void>
  fetchSavedClips: () => Promise<void>
  toggleSaveClip: (clipId: string) => Promise<void>
  toggleGroup: (groupId: string) => void
}

export const useTrendingStore = create<TrendingState>((set, get) => ({
  clips: [],
  filteredClips: [],
  megaViralClips: [],
  trendingClips: [],
  stats: EMPTY_STATS,
  cursor: null,
  hasMore: false,
  loadingMore: false,
  totalCount: 0,
  savedClipIds: new Set(),
  savedClips: [],
  expandedGroups: new Set(),
  userPlan: null,
  monthlyVideosUsed: 0,
  bonusVideos: 0,
  recentRemixes: [],
  filters: DEFAULT_FILTERS,
  loading: true,
  refreshing: false,
  error: null,
  autoRefreshEnabled: true,
  autoRefreshInterval: 60_000,
  lastRefreshed: null,
  notifications: [],
  notificationsRead: true,
  _searchDebounce: null,

  setFilters: (newFilters) => {
    const prev = get().filters
    set({ filters: newFilters })

    // If search text changed, debounce the server fetch
    if (newFilters.search !== prev.search) {
      const timer = get()._searchDebounce
      if (timer) clearTimeout(timer)
      set({
        _searchDebounce: setTimeout(() => {
          get().fetchClips(true)
        }, 300),
      })
      // Apply client-side filter immediately for responsiveness
      get().applyFilters()
      return
    }

    // For any other filter change that affects server query, re-fetch
    const serverChanged =
      newFilters.games.join(',') !== prev.games.join(',') ||
      newFilters.platforms.join(',') !== prev.platforms.join(',') ||
      newFilters.duration !== prev.duration ||
      newFilters.sort !== prev.sort

    if (serverChanged) {
      get().fetchClips(true)
    } else {
      get().applyFilters()
    }
  },

  setFeed: (feed) => {
    const { filters } = get()
    const prev = filters.feed
    set({ filters: { ...filters, feed } })

    // saved/remixes have their own fetch logic — just filter client-side
    if (feed === 'saved' || feed === 'remixes') {
      get().applyFilters()
      return
    }

    // Switching from a client-only tab (saved/remixes) back to a server tab
    // always needs a re-fetch since clips array may be stale
    if (prev === 'saved' || prev === 'remixes') {
      get().fetchClips(true)
      return
    }

    // For feed tab changes (hot_now, early_gem, proven, recent, all):
    // Apply client filter immediately, then re-fetch from server in background
    // to ensure we have the full dataset for this category
    get().applyFilters()
    const { filteredClips } = get()
    if (filteredClips.length < 10) {
      // Not enough results client-side — fetch from server
      get().fetchClips(true)
    }
  },

  setAutoRefresh: (enabled) => set({ autoRefreshEnabled: enabled }),
  markNotificationsRead: () => set({ notificationsRead: true }),

  fetchClips: async (silent = false) => {
    const state = get()
    if (!silent) set({ loading: true })
    else set({ refreshing: true })
    set({ error: null })

    try {
      const params = buildFilterParams(state.filters)
      // Load 200 when unfiltered (bulk for client-side tab switching),
      // 50 when filtered (server does the work)
      params.set('limit', hasServerFilters(state.filters) ? '50' : '200')
      const res = await fetch(`/api/trending?${params}`)

      // Handle non-JSON responses (e.g. Netlify 500 returning plain text)
      const contentType = res.headers.get('content-type') ?? ''
      if (!contentType.includes('application/json')) {
        throw new Error('Server error — clips are loading from cache')
      }

      const json = await res.json() as {
        data: TrendingClip[] | null
        error: string | null
        meta?: { total: number; next_cursor: string | null }
      }

      if (!res.ok || json.error) throw new Error(json.error ?? 'Network error')

      const prevClips = state.clips
      const clips = json.data ?? []

      const totalCount = json.meta?.total ?? clips.length
      const nextCursor = json.meta?.next_cursor ?? null

      // Detect new viral clips for notifications
      const newNotifications: ViralNotification[] = []
      if (prevClips.length > 0) {
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
        totalCount,
        cursor: nextCursor,
        hasMore: nextCursor !== null,
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
        clips: [],
      })
      get().computeStats()
      get().applyFilters()
    } finally {
      set({ loading: false, refreshing: false })
    }
  },

  loadMore: async () => {
    const { clips, cursor, loadingMore, hasMore, filters } = get()
    if (loadingMore || !hasMore || !cursor) return

    set({ loadingMore: true })
    try {
      const params = buildFilterParams(filters)
      params.set('limit', '50')
      params.set('cursor', cursor)
      const res = await fetch(`/api/trending?${params}`)
      const json = await res.json() as {
        data: TrendingClip[] | null
        error: string | null
        meta?: { total: number; next_cursor: string | null }
      }

      if (!res.ok || json.error) throw new Error(json.error ?? 'Network error')

      const newClips = json.data ?? []
      const existingIds = new Set(clips.map(c => c.id))
      const deduped = newClips.filter(c => !existingIds.has(c.id))
      const allClips = [...clips, ...deduped]
      const nextCursor = json.meta?.next_cursor ?? null

      set({
        clips: allClips,
        totalCount: json.meta?.total ?? allClips.length,
        cursor: nextCursor,
        hasMore: nextCursor !== null,
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
    const { clips, filters, savedClipIds, expandedGroups } = get()
    let filtered = filterAndSortClips(clips, filters, savedClipIds)

    // Hide collapsed stream group clips unless their group is expanded
    filtered = filtered.filter(c => {
      if (!c.stream_group_collapsed) return true
      return c.stream_group_id ? expandedGroups.has(c.stream_group_id) : true
    })

    const megaViralClips = filtered.filter((c) => clipRank(c) === 'master' || clipRank(c) === 'legendary')
    const trendingClips = filtered.filter((c) => clipRank(c) !== 'master' && clipRank(c) !== 'legendary')
    set({ filteredClips: filtered, megaViralClips, trendingClips })
  },

  fetchBootstrap: async () => {
    try {
      const res = await fetch('/api/bootstrap')
      if (!res.ok) return
      const json = await res.json() as { data: BootstrapResponse | null; error: string | null }
      if (json.error || !json.data) return

      const { saved_clip_ids, recent_remixes, profile } = json.data
      set({
        savedClipIds: new Set(saved_clip_ids),
        recentRemixes: recent_remixes,
        userPlan: profile?.plan ?? null,
        monthlyVideosUsed: profile?.monthly_videos_used ?? 0,
        bonusVideos: profile?.bonus_videos ?? 0,
      })
      get().applyFilters()
    } catch {
      // Silent — individual fetches remain as fallback
    }
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

  toggleGroup: (groupId) => {
    const { expandedGroups } = get()
    const next = new Set(expandedGroups)
    if (next.has(groupId)) {
      next.delete(groupId)
    } else {
      next.add(groupId)
    }
    set({ expandedGroups: next })
    get().applyFilters()
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
