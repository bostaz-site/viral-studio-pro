import { create } from 'zustand'

export type ProcessingStep = 'idle' | 'uploading' | 'transcribing' | 'analyzing' | 'rendering' | 'done' | 'error'

export interface VideoState {
  currentVideoId: string | null
  setCurrentVideoId: (id: string | null) => void
  processingStep: ProcessingStep
  setProcessingStep: (step: ProcessingStep) => void
  uploadProgress: number
  setUploadProgress: (progress: number) => void
  errorMessage: string | null
  setErrorMessage: (msg: string | null) => void
  reset: () => void
}

export const useVideoStore = create<VideoState>((set) => ({
  currentVideoId: null,
  setCurrentVideoId: (id) => set({ currentVideoId: id }),
  processingStep: 'idle',
  setProcessingStep: (step) => set({ processingStep: step }),
  uploadProgress: 0,
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
  errorMessage: null,
  setErrorMessage: (msg) => set({ errorMessage: msg }),
  reset: () =>
    set({
      currentVideoId: null,
      processingStep: 'idle',
      uploadProgress: 0,
      errorMessage: null,
    }),
}))
