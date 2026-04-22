import { create } from 'zustand'

export interface SocialAccount {
  id: string
  platform: 'tiktok' | 'youtube' | 'instagram'
  platform_user_id: string
  username: string | null
  connected_at: string
}

export interface PublishTarget {
  platform: 'tiktok' | 'youtube' | 'instagram'
  enabled: boolean
}

export interface PublishProgress {
  platform: string
  status: 'idle' | 'publishing' | 'published' | 'error'
  error?: string
  postId?: string
  trackingUrl?: string
}

export interface DistributionState {
  // Social accounts
  accounts: SocialAccount[]
  accountsLoading: boolean
  accountsError: string | null

  // Publish state
  publishTargets: PublishTarget[]
  publishProgress: Record<string, PublishProgress>
  isPublishing: boolean

  // Actions
  fetchAccounts: () => Promise<void>
  disconnectAccount: (platform: string) => Promise<void>
  setPublishTargets: (targets: PublishTarget[]) => void
  togglePublishTarget: (platform: string) => void
  publishClip: (
    clipId: string,
    caption: string,
    hashtags: string[]
  ) => Promise<void>
  resetPublishProgress: () => void
}

export const useDistributionStore = create<DistributionState>((set, get) => ({
  accounts: [],
  accountsLoading: false,
  accountsError: null,

  publishTargets: [
    { platform: 'tiktok', enabled: false },
    { platform: 'youtube', enabled: false },
    { platform: 'instagram', enabled: false },
  ],
  publishProgress: {},
  isPublishing: false,

  fetchAccounts: async () => {
    set({ accountsLoading: true, accountsError: null })
    try {
      const res = await fetch('/api/social-accounts')
      const json = await res.json() as {
        data: SocialAccount[] | null
        error: string | null
      }

      if (json.error) {
        set({ accountsError: json.error, accountsLoading: false })
        return
      }

      const accounts = json.data ?? []
      set({
        accounts,
        accountsLoading: false,
        // Auto-enable publish targets for connected accounts
        publishTargets: get().publishTargets.map((t) => ({
          ...t,
          enabled: accounts.some((a) => a.platform === t.platform),
        })),
      })
    } catch (err) {
      set({
        accountsError: err instanceof Error ? err.message : 'Failed to fetch accounts',
        accountsLoading: false,
      })
    }
  },

  disconnectAccount: async (platform: string) => {
    try {
      const res = await fetch(`/api/oauth/${platform}/disconnect`, {
        method: 'DELETE',
      })
      const json = await res.json() as { error: string | null }

      if (json.error) {
        throw new Error(json.error)
      }

      // Remove from local state
      set((state) => ({
        accounts: state.accounts.filter((a) => a.platform !== platform),
        publishTargets: state.publishTargets.map((t) =>
          t.platform === platform ? { ...t, enabled: false } : t
        ),
      }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to disconnect'
      set({ accountsError: msg })
      throw err
    }
  },

  setPublishTargets: (targets) => set({ publishTargets: targets }),

  togglePublishTarget: (platform) => {
    set((state) => ({
      publishTargets: state.publishTargets.map((t) =>
        t.platform === platform ? { ...t, enabled: !t.enabled } : t
      ),
    }))
  },

  publishClip: async (clipId, caption, hashtags) => {
    const { publishTargets } = get()
    const enabledTargets = publishTargets.filter((t) => t.enabled)

    if (enabledTargets.length === 0) return

    set({ isPublishing: true })

    // Initialize progress for each target
    const progress: Record<string, PublishProgress> = {}
    for (const target of enabledTargets) {
      progress[target.platform] = {
        platform: target.platform,
        status: 'publishing',
      }
    }
    set({ publishProgress: progress })

    // Publish to each platform in parallel
    const promises = enabledTargets.map(async (target) => {
      try {
        const res = await fetch(`/api/publish/${target.platform}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clip_id: clipId, caption, hashtags }),
        })

        const json = await res.json() as {
          data: { postId?: string; trackingUrl?: string } | null
          error: string | null
        }

        if (json.error) {
          set((state) => ({
            publishProgress: {
              ...state.publishProgress,
              [target.platform]: {
                platform: target.platform,
                status: 'error',
                error: json.error ?? 'Unknown error',
              },
            },
          }))
          return
        }

        set((state) => ({
          publishProgress: {
            ...state.publishProgress,
            [target.platform]: {
              platform: target.platform,
              status: 'published',
              postId: json.data?.postId ?? undefined,
              trackingUrl: json.data?.trackingUrl ?? undefined,
            },
          },
        }))
      } catch (err) {
        set((state) => ({
          publishProgress: {
            ...state.publishProgress,
            [target.platform]: {
              platform: target.platform,
              status: 'error',
              error: err instanceof Error ? err.message : 'Network error',
            },
          },
        }))
      }
    })

    await Promise.allSettled(promises)
    set({ isPublishing: false })
  },

  resetPublishProgress: () => set({ publishProgress: {}, isPublishing: false }),
}))
