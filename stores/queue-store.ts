import { create } from 'zustand'
import {
  generateQueue,
  recordPostResult,
  recordOverride,
  consumeMomentumSlot,
  createDefaultLearning,
  DEFAULT_SETTINGS,
  type QueueClip,
  type QueuePreview,
  type QueueSettings,
  type LearningData,
  type PostResult,
  type ScheduledPost,
} from '@/lib/distribution/smart-queue-engine'
import { loadPersistentStats } from '@/lib/distribution/session-persistence'

// ── LocalStorage keys ──
const LEARNING_KEY = 'viral-animal-queue-learning'
const SETTINGS_KEY = 'viral-animal-queue-settings'

// ── Persistence helpers ──

function loadLearning(): LearningData {
  try {
    const raw = window.localStorage.getItem(LEARNING_KEY)
    if (!raw) return createDefaultLearning()
    return JSON.parse(raw) as LearningData
  } catch {
    return createDefaultLearning()
  }
}

function saveLearning(data: LearningData): void {
  try {
    window.localStorage.setItem(LEARNING_KEY, JSON.stringify(data))
  } catch {
    // Storage full — silently skip
  }
}

function loadSettings(): QueueSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings: QueueSettings): void {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // silently skip
  }
}

// ── Store interface ──

export interface QueueState {
  // State
  queue: QueuePreview | null
  learning: LearningData
  settings: QueueSettings
  clipBank: QueueClip[]
  isGenerating: boolean
  showOverrideToast: boolean
  overrideClipId: string | null

  // Actions
  init: () => void
  setClipBank: (clips: QueueClip[]) => void
  regenerateQueue: () => void
  updateSettings: (partial: Partial<QueueSettings>) => void

  // Learning
  recordResult: (result: PostResult) => void
  handleOverride: (clipId: string, fromPlatform: string, toPlatform: string, hour: number) => void
  confirmOverrideLearning: () => void
  dismissOverrideToast: () => void

  // Helpers
  getPostByIndex: (index: number) => ScheduledPost | null
  getDoNothingPreview: () => { postCount: number; estReach: string; confidence: number } | null
}

export const useQueueStore = create<QueueState>((set, get) => ({
  queue: null,
  learning: createDefaultLearning(),
  settings: { ...DEFAULT_SETTINGS },
  clipBank: [],
  isGenerating: false,
  showOverrideToast: false,
  overrideClipId: null,

  init: () => {
    const learning = loadLearning()
    const settings = loadSettings()
    set({ learning, settings })
  },

  setClipBank: (clips) => {
    set({ clipBank: clips })
    // Auto-regenerate queue when bank changes
    get().regenerateQueue()
  },

  regenerateQueue: () => {
    const { clipBank, learning, settings } = get()
    if (clipBank.length === 0) {
      set({ queue: null })
      return
    }

    set({ isGenerating: true })

    // Use requestAnimationFrame to not block UI
    requestAnimationFrame(() => {
      const stats = loadPersistentStats()
      const queue = generateQueue(clipBank, stats, learning, settings)
      set({ queue, isGenerating: false })
    })
  },

  updateSettings: (partial) => {
    const next = { ...get().settings, ...partial }
    set({ settings: next })
    saveSettings(next)
    get().regenerateQueue()
  },

  recordResult: (result) => {
    const updated = recordPostResult(get().learning, result)
    set({ learning: updated })
    saveLearning(updated)
    // Regenerate queue with new learnings
    get().regenerateQueue()
  },

  handleOverride: (clipId, fromPlatform, toPlatform, hour) => {
    set({ showOverrideToast: true, overrideClipId: clipId })
    // Store pending override data
    const updated = recordOverride(get().learning, clipId, fromPlatform, toPlatform, hour)
    set({ learning: updated })
    saveLearning(updated)
  },

  confirmOverrideLearning: () => {
    set({ showOverrideToast: false, overrideClipId: null })
    get().regenerateQueue()
  },

  dismissOverrideToast: () => {
    set({ showOverrideToast: false, overrideClipId: null })
  },

  getPostByIndex: (index) => {
    return get().queue?.posts[index] ?? null
  },

  getDoNothingPreview: () => {
    const { queue } = get()
    if (!queue || queue.posts.length === 0) return null

    const low = queue.totalEstReach.low
    const high = queue.totalEstReach.high
    const formatK = (n: number) => {
      if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`
      if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
      return `${Math.round(n)}`
    }

    return {
      postCount: queue.posts.length,
      estReach: `${formatK(low)}–${formatK(high)}`,
      confidence: queue.confidence,
    }
  },
}))
