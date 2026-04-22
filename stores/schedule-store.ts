import { create } from 'zustand'

export interface ScheduledPublication {
  id: string
  user_id: string
  clip_id: string
  platform: string
  caption: string | null
  hashtags: string[]
  scheduled_at: string
  status: 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'
  publish_result: Record<string, unknown> | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export interface DistributionSettings {
  user_id: string
  max_posts_per_day: number
  min_hours_between_posts: number
  default_hashtags: string[]
  caption_template: string | null
  niche: string | null
  optimal_hours: Record<string, number[]>
  ai_optimized: boolean
}

export interface AnalyticsData {
  totalPublished: number
  totalScheduled: number
  totalFailed: number
  thisWeekPubs: number
  viralScore: number
  dailyStats: { date: string; count: number }[]
  platformStats: Record<string, { published: number; scheduled: number; failed: number }>
  topClips: { clip_id: string; platforms: string[]; count: number }[]
}

export interface ScheduleState {
  // Queue
  queue: ScheduledPublication[]
  queueLoading: boolean
  queueError: string | null

  // Settings
  settings: DistributionSettings | null
  settingsLoading: boolean

  // Analytics
  analytics: AnalyticsData | null
  analyticsLoading: boolean

  // Actions — Queue
  fetchQueue: (filters?: { status?: string; platform?: string }) => Promise<void>
  scheduleClip: (data: {
    clip_id: string
    platform: string
    caption?: string
    hashtags?: string[]
    scheduled_at: string
  }) => Promise<ScheduledPublication | null>
  cancelScheduled: (id: string) => Promise<void>
  deleteScheduled: (id: string) => Promise<void>

  // Actions — Settings
  fetchSettings: () => Promise<void>
  updateSettings: (settings: Partial<DistributionSettings>) => Promise<void>
  optimizeWithAI: (niche?: string) => Promise<void>

  // Actions — Analytics
  fetchAnalytics: (days?: number) => Promise<void>
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  queue: [],
  queueLoading: false,
  queueError: null,

  settings: null,
  settingsLoading: false,

  analytics: null,
  analyticsLoading: false,

  fetchQueue: async (filters) => {
    set({ queueLoading: true, queueError: null })
    try {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.platform) params.set('platform', filters.platform)

      const res = await fetch(`/api/distribution/schedule?${params}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({ queue: json.data ?? [], queueLoading: false })
    } catch (err) {
      set({
        queueError: err instanceof Error ? err.message : 'Failed to fetch queue',
        queueLoading: false,
      })
    }
  },

  scheduleClip: async (data) => {
    try {
      const res = await fetch('/api/distribution/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const item = json.data as ScheduledPublication
      set((state) => ({ queue: [...state.queue, item].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      )}))
      return item
    } catch (err) {
      set({ queueError: err instanceof Error ? err.message : 'Failed to schedule' })
      return null
    }
  },

  cancelScheduled: async (id) => {
    try {
      const res = await fetch('/api/distribution/schedule', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'cancelled' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      set((state) => ({
        queue: state.queue.map(item =>
          item.id === id ? { ...item, status: 'cancelled' as const } : item
        ),
      }))
    } catch (err) {
      set({ queueError: err instanceof Error ? err.message : 'Failed to cancel' })
    }
  },

  deleteScheduled: async (id) => {
    try {
      const res = await fetch(`/api/distribution/schedule?id=${id}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      set((state) => ({
        queue: state.queue.filter(item => item.id !== id),
      }))
    } catch (err) {
      set({ queueError: err instanceof Error ? err.message : 'Failed to delete' })
    }
  },

  fetchSettings: async () => {
    set({ settingsLoading: true })
    try {
      const res = await fetch('/api/distribution/settings')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({ settings: json.data, settingsLoading: false })
    } catch {
      set({ settingsLoading: false })
    }
  },

  updateSettings: async (updates) => {
    try {
      const res = await fetch('/api/distribution/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({ settings: json.data })
    } catch {
      // silent
    }
  },

  optimizeWithAI: async (niche) => {
    set({ settingsLoading: true })
    try {
      const res = await fetch('/api/distribution/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche: niche ?? get().settings?.niche }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({ settings: json.data, settingsLoading: false })
    } catch {
      set({ settingsLoading: false })
    }
  },

  fetchAnalytics: async (days = 30) => {
    set({ analyticsLoading: true })
    try {
      const res = await fetch(`/api/distribution/analytics?days=${days}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({ analytics: json.data, analyticsLoading: false })
    } catch {
      set({ analyticsLoading: false })
    }
  },
}))
