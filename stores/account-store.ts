import { create } from 'zustand'
import type { CreatorRank, AccountScoreOutput } from '@/lib/scoring/account-scorer'

interface AccountState {
  // Score data
  score: AccountScoreOutput | null
  followers: number
  totalViews: number
  videoCount: number
  medianViews: number
  engagementRate: number
  platform: string | null
  username: string | null
  lastSyncedAt: string | null
  canSyncToday: boolean

  // UI
  loading: boolean
  syncing: boolean
  error: string | null

  // Actions
  fetchAccountScore: () => Promise<void>
  syncAccount: () => Promise<void>
}

export const useAccountStore = create<AccountState>((set) => ({
  score: null,
  followers: 0,
  totalViews: 0,
  videoCount: 0,
  medianViews: 0,
  engagementRate: 0,
  platform: null,
  username: null,
  lastSyncedAt: null,
  canSyncToday: true,
  loading: false,
  syncing: false,
  error: null,

  fetchAccountScore: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/social-accounts')
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const accounts = json.data ?? []
      const yt = accounts.find((a: { platform: string }) => a.platform === 'youtube')

      if (yt && yt.creator_score != null) {
        const today = new Date().toISOString().slice(0, 10)
        set({
          score: {
            creator_score: yt.creator_score,
            creator_rank: (yt.creator_rank ?? 'newcomer') as CreatorRank,
            performance_score: 0,
            engagement_score: 0,
            growth_score: 0,
            audience_score: 0,
            consistency_score: 0,
          },
          followers: yt.followers ?? 0,
          totalViews: yt.total_views ?? 0,
          videoCount: yt.video_count ?? 0,
          medianViews: yt.median_views_per_video ?? 0,
          engagementRate: yt.engagement_rate ?? 0,
          platform: 'youtube',
          username: yt.username,
          lastSyncedAt: yt.last_synced_at,
          canSyncToday: yt.last_sync_date !== today,
          loading: false,
        })
      } else {
        set({ loading: false })
      }
    } catch {
      set({ loading: false })
    }
  },

  syncAccount: async () => {
    set({ syncing: true, error: null })
    try {
      const res = await fetch('/api/account/sync', { method: 'POST' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      const d = json.data
      set({
        score: {
          creator_score: d.creator_score,
          creator_rank: d.creator_rank,
          performance_score: d.performance_score,
          engagement_score: d.engagement_score,
          growth_score: d.growth_score,
          audience_score: d.audience_score,
          consistency_score: d.consistency_score,
        },
        followers: d.followers,
        totalViews: d.total_views,
        videoCount: d.video_count,
        medianViews: d.median_views_per_video,
        engagementRate: d.engagement_rate,
        lastSyncedAt: d.synced_at,
        canSyncToday: false,
        syncing: false,
      })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Sync failed',
        syncing: false,
      })
    }
  },
}))
