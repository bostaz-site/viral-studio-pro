import { create } from 'zustand'
import type { GeneratedClip } from '@/types/clips'

// Re-export types for backward compatibility
export type { ViralScore, GeneratedClip } from '@/types/clips'

export interface ClipsState {
  generatedClips: GeneratedClip[]
  setGeneratedClips: (clips: GeneratedClip[]) => void
  selectedClipId: string | null
  setSelectedClipId: (id: string | null) => void
  clearClips: () => void
}

export const useClipsStore = create<ClipsState>((set) => ({
  generatedClips: [],
  setGeneratedClips: (clips) => set({ generatedClips: clips }),
  selectedClipId: null,
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  clearClips: () => set({ generatedClips: [] }),
}))
