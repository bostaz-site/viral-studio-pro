import { create } from 'zustand'

export interface ViralScore {
  score: number | null
  hook_strength: number | null
  emotional_flow: number | null
  perceived_value: number | null
  trend_alignment: number | null
  hook_type: string | null
  explanation: string | null
  suggested_hooks: unknown
}

export interface GeneratedClip {
  id: string
  video_id: string | null
  title: string | null
  start_time: number
  end_time: number
  duration_seconds: number | null
  storage_path: string | null
  thumbnail_path: string | null
  thumbnail_url: string | null
  transcript_segment: string | null
  aspect_ratio: string | null
  status: string | null
  is_remake: boolean | null
  viral_scores: ViralScore[]
}

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
