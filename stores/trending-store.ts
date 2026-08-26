import { create } from 'zustand'
import { toast } from 'sonner'
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
  common: 0, rare: 0, super_rare: 0, epic: 0, legendary: 0,
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

  // Feed filter — only applied client-side for "saved" tab (others are server-side)
  if (filters.feed === 'saved') {
    result = result.filter((c) => savedClipIds.has(c.id))
  }

  // Platform filter — defense-in-depth: server already filters, but client
  // re-enforces to prevent stale data from a race condition showing wrong clips
  if (filters.platforms.length > 0) {
    const platformSet = new Set(filters.platforms)
    result = result.filter((c) => platformSet.has(c.platform?.toLowerCase()))
  }

  // Streamer filter (single value — client-side only, not sent to server)
  if (filters.streamer && filters.streamer !== '') {
    const s = filters.streamer.toLowerCase()
    result = result.filter(
      (c) =>
        c.author_name?.toLowerCase() === s ||
        c.author_handle?.toLowerCase() === s
    )
  }

  // Sort (server sorts too, but we re-sort for client-side combined data / saved tab)
  if (filters.feed === 'recent' || filters.sort === 'date') {
    result.sort((a, b) => new Date(b.clip_created_at ?? b.scraped_at ?? 0).getTime() - new Date(a.clip_created_at ?? a.scraped_at ?? 0).getTime())
  } else {
    // 67 easter egg — the meme score floats up near the top (brand joke).
    // Disabled in capture mode (?capture=1) so promo recordings show a clean
    // descending order with the 67 at its real position.
    const captureMode =
      typeof window !== 'undefined' &&
      sessionStorage.getItem('va:capture-mode') === '1'
    const sortScore = (v: number) =>
      !captureMode && Math.round(v) === 67 ? 79 : v
    result.sort((a, b) => sortScore(b.velocity_score ?? 0) - sortScore(a.velocity_score ?? 0))
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
  used_clip_ids: string[]
  recent_remixes: BootstrapRemix[]
  profile: { plan: string; monthly_videos_used: number; bonus_videos: number } | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build URLSearchParams from filters for the /api/trending call.
 *  Feed tabs ARE sent to the server so pagination works correctly per-tab. */
function buildFilterParams(f: TrendingFiltersState): URLSearchParams {
  const params = new URLSearchParams({ sort: f.sort })

  // Server-side filters
  if (f.search) params.set('search', f.search)
  if (f.games.length > 0) params.set('niche', f.games.join(','))
  if (f.platforms.length > 0) params.set('platform', f.platforms.join(','))
  if (f.duration !== 'all') params.set('duration', f.duration)

  // Feed tab — sent to server for pre-pagination filtering
  if (f.feed && f.feed !== 'all' && f.feed !== 'saved' && f.feed !== 'remixes') {
    params.set('feed', f.feed)
  }

  return params
}

// ─── Store ──────────────────────────────────────────────────────────────────

interface TabCounts {
  exploding: number
  proven: number
  fresh: number
  all: number
  legendary: number
}

interface TrendingState {
  // Data
  clips: TrendingClip[]
  filteredClips: TrendingClip[]
  megaViralClips: TrendingClip[]
  trendingClips: TrendingClip[]
  stats: TrendingStats

  // Server-side tab counts (single source of truth)
  tabCounts: TabCounts
  tabCountsLoaded: boolean

  // Pagination (cursor-based)
  cursor: string | null
  hasMore: boolean
  loadingMore: boolean
  totalCount: number

  // Saved/Favorites
  savedClipIds: Set<string>
  savedClips: SavedClip[]
  savedTrendingClips: TrendingClip[]

  // Used clips (rendered/published — for Top Pick exclusion)
  usedClipIds: Set<string>

  // Processing status (persistent across sessions)
  bankedClipIds: Set<string>
  publishedClipIds: Set<string>
  renderedClipIds: Set<string>

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

  // Internal
  _searchDebounce: ReturnType<typeof setTimeout> | null

  // Actions
  setFilters: (filters: TrendingFiltersState) => void
  setFeed: (feed: FeedFilter) => void
  setAutoRefresh: (enabled: boolean) => void
  markNotificationsRead: () => void
  fetchClips: (silent?: boolean) => Promise<void>
  fetchTabCounts: () => Promise<void>
  loadMore: () => Promise<void>
  computeStats: () => void
  applyFilters: () => void
  fetchBootstrap: () => Promise<void>
  fetchSavedClips: () => Promise<void>
  fetchClipStatus: () => Promise<void>
  addBankedClip: (clipId: string) => void
  addRenderedClip: (clipId: string) => void
  markClipPublished: (clipId: string) => void
  toggleSaveClip: (clipId: string) => Promise<void>
  toggleGroup: (groupId: string) => void
}

export const useTrendingStore = create<TrendingState>((set, get) => ({
  clips: [],
  filteredClips: [],
  megaViralClips: [],
  trendingClips: [],
  stats: EMPTY_STATS,
  tabCounts: { exploding: 0, proven: 0, fresh: 0, all: 0, legendary: 0 },
  tabCountsLoaded: false,
  cursor: null,
  hasMore: false,
  loadingMore: false,
  totalCount: 0,
  savedClipIds: new Set(),
  savedClips: [],
  savedTrendingClips: [],
  usedClipIds: new Set(),
  bankedClipIds: new Set(),
  publishedClipIds: new Set(),
  renderedClipIds: new Set(),
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
    set({ filters: { ...filters, feed }, cursor: null, hasMore: false })

    // Saved tab: fetch full saved clips with their trending_clips data
    if (feed === 'saved') {
      get().fetchSavedClips()
      get().applyFilters()
      return
    }

    if (feed === 'remixes') {
      get().applyFilters()
      return
    }

    // All feed tabs: re-fetch from server with filter applied server-side
    get().fetchClips()
  },

  setAutoRefresh: (enabled) => set({ autoRefreshEnabled: enabled }),
  markNotificationsRead: () => set({ notificationsRead: true }),

  fetchClips: async (silent = false) => {
    const state = get()
    if (!silent) set({ loading: true })
    else set({ refreshing: true })
    set({ error: null })

    const MAX_RETRIES = 2
    const RETRY_DELAY_MS = 800

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const params = buildFilterParams(get().filters)
        params.set('limit', '50')
        const res = await fetch(`/api/trending?${params}`)

        // Handle non-JSON responses (e.g. Netlify 500 returning plain text)
        const contentType = res.headers.get('content-type') ?? ''
        if (!contentType.includes('application/json')) {
          throw new Error(`Server error (HTTP ${res.status}) — retrying`)
        }

        const json = await res.json() as {
          data: TrendingClip[] | null
          error: string | null
          meta?: { total: number; next_cursor: string | null }
        }

        if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`)

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

        // Also refresh tab counts (non-blocking)
        get().fetchTabCounts()

        // Success — exit retry loop
        set({ loading: false, refreshing: false })
        return
      } catch (err) {
        // If we have retries left, wait and try again (keep loading=true for skeleton)
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
          continue
        }

        // All retries exhausted — show error, but keep existing clips if we had some
        const hadClips = get().clips.length > 0
        set({
          error: err instanceof Error ? err.message : 'Failed to load clips',
          ...(!hadClips ? { clips: [] } : {}),
        })
        if (!hadClips) {
          get().computeStats()
          get().applyFilters()
        }
      }
    }

    set({ loading: false, refreshing: false })
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
      set({ error: 'Failed to load more clips — try again.' })
    } finally {
      set({ loadingMore: false })
    }
  },

  fetchTabCounts: async () => {
    try {
      const res = await fetch('/api/trending/counts')
      if (!res.ok) {
        // Retry once after 5s on failure (non-blocking)
        if (!get().tabCountsLoaded) {
          setTimeout(() => get().fetchTabCounts(), 5000)
        }
        return
      }
      const json = await res.json() as { data: TabCounts | null; error: string | null }
      if (json.error || !json.data) return
      set({ tabCounts: json.data, tabCountsLoaded: true })
    } catch {
      // Retry once after 5s if never loaded
      if (!get().tabCountsLoaded) {
        setTimeout(() => get().fetchTabCounts(), 5000)
      }
    }
  },

  computeStats: () => {
    const { clips } = get()
    set({ stats: computeStatsFromClips(clips) })
  },

  applyFilters: () => {
    const { clips, filters, savedClipIds, expandedGroups, savedTrendingClips } = get()
    // For saved tab, use the full saved trending clips (not just IDs matched against loaded clips)
    const sourceClips = filters.feed === 'saved' && savedTrendingClips.length > 0
      ? savedTrendingClips
      : clips
    let filtered = filterAndSortClips(sourceClips, filters, savedClipIds)

    // Hide collapsed stream group clips unless their group is expanded
    filtered = filtered.filter(c => {
      if (!c.stream_group_collapsed) return true
      return c.stream_group_id ? expandedGroups.has(c.stream_group_id) : true
    })

    const megaViralClips = filtered.filter((c) => clipRank(c) === 'legendary')
    const trendingClips = filtered.filter((c) => clipRank(c) !== 'legendary')
    set({ filteredClips: filtered, megaViralClips, trendingClips })
  },

  fetchBootstrap: async () => {
    try {
      const res = await fetch('/api/bootstrap')
      if (!res.ok) return
      const json = await res.json() as { data: BootstrapResponse | null; error: string | null }
      if (json.error || !json.data) return

      const { saved_clip_ids, used_clip_ids, recent_remixes, profile } = json.data
      set({
        savedClipIds: new Set(saved_clip_ids),
        usedClipIds: new Set(used_clip_ids),
        recentRemixes: recent_remixes,
        userPlan: profile?.plan ?? null,
        monthlyVideosUsed: profile?.monthly_videos_used ?? 0,
        bonusVideos: profile?.bonus_videos ?? 0,
      })
      get().applyFilters()
      // Fetch processing status (non-blocking)
      get().fetchClipStatus()
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
      const ids = new Set(saved.map((s: SavedClip) => s.clip_id))

      // Extract full trending_clips objects from the join
      const savedTrendingClips: TrendingClip[] = []
      for (const s of saved) {
        const tc = (s as unknown as Record<string, unknown>).trending_clips as TrendingClip | null
        if (tc && tc.id) savedTrendingClips.push(tc)
      }

      set({ savedClips: saved, savedClipIds: ids, savedTrendingClips })
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

  fetchClipStatus: async () => {
    try {
      const res = await fetch('/api/clips/my-status')
      if (!res.ok) return
      const json = await res.json() as { data: { banked: string[]; published: string[]; rendered?: string[] } | null; error: string | null }
      if (json.error || !json.data) return
      set({
        bankedClipIds: new Set(json.data.banked),
        publishedClipIds: new Set(json.data.published),
        renderedClipIds: new Set(json.data.rendered ?? []),
      })
    } catch {
      // silent
    }
  },

  addBankedClip: (clipId) => {
    set({ bankedClipIds: new Set(get().bankedClipIds).add(clipId) })
  },

  addRenderedClip: (clipId) => {
    set({ renderedClipIds: new Set(get().renderedClipIds).add(clipId) })
  },

  markClipPublished: (clipId) => {
    const published = new Set(get().publishedClipIds).add(clipId)
    const banked = new Set(get().bankedClipIds)
    banked.delete(clipId)
    set({ publishedClipIds: published, bankedClipIds: banked })
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
      const res = isSaved
        ? await fetch(`/api/clips/saved/${clipId}`, { method: 'DELETE' })
        : await fetch('/api/clips/saved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clip_id: clipId }),
          })
      if (!res.ok) {
        set({ savedClipIds, error: 'Failed to save clip — try again.' })
        toast.error('Failed to save clip — try again.')
        return
      }
      if (isSaved) {
        toast('Removed from favorites')
      } else {
        toast.success('Clip saved to favorites')
      }
      // Re-fetch to sync
      get().fetchSavedClips()
    } catch {
      // Rollback
      set({ savedClipIds, error: 'Failed to save clip — try again.' })
      toast.error('Failed to save clip — try again.')
    }
  },
}))
