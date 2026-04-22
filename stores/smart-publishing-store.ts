import { create } from 'zustand'
import type {
  AccountIntelligence,
  PublicationPerformance,
  PublishRecommendation,
} from '@/lib/distribution/smart-publisher'

interface SmartPublishingState {
  // Intelligence
  intelligence: AccountIntelligence | null
  performances: PublicationPerformance[]
  recommendation: PublishRecommendation | null

  // UI state
  loading: boolean
  insightsLoading: boolean

  // Actions
  fetchIntelligence: (platform: string) => Promise<void>
  fetchPerformances: (platform: string, days?: number) => Promise<void>
  getRecommendation: (platform: string) => Promise<void>
  recordPerformance: (data: Record<string, unknown>) => Promise<void>
  triggerAnalysis: (platform: string) => Promise<void>
}

export const useSmartPublishingStore = create<SmartPublishingState>((set) => ({
  intelligence: null,
  performances: [],
  recommendation: null,
  loading: false,
  insightsLoading: false,

  fetchIntelligence: async (platform) => {
    set({ loading: true })
    try {
      const res = await fetch(`/api/distribution/intelligence?platform=${platform}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({
        intelligence: json.data.intelligence,
        recommendation: json.data.recommendation,
        loading: false,
      })
    } catch {
      set({ loading: false })
    }
  },

  fetchPerformances: async (platform, days = 30) => {
    set({ insightsLoading: true })
    try {
      const res = await fetch(`/api/distribution/performance?platform=${platform}&days=${days}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({ performances: json.data ?? [], insightsLoading: false })
    } catch {
      set({ insightsLoading: false })
    }
  },

  getRecommendation: async (platform) => {
    try {
      const res = await fetch(`/api/distribution/intelligence?platform=${platform}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({
        recommendation: json.data.recommendation,
        intelligence: json.data.intelligence,
      })
    } catch {
      // silent
    }
  },

  recordPerformance: async (data) => {
    try {
      await fetch('/api/distribution/performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
    } catch {
      // silent
    }
  },

  triggerAnalysis: async (platform) => {
    set({ insightsLoading: true })
    try {
      const res = await fetch('/api/distribution/intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      set({
        intelligence: json.data.intelligence,
        recommendation: json.data.recommendation,
        insightsLoading: false,
      })
    } catch {
      set({ insightsLoading: false })
    }
  },
}))
