import { create } from 'zustand'

export interface UiState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  /** True when a render toast/notification is visible (blocks PWA banner) */
  hasActiveRenderToast: boolean
  setHasActiveRenderToast: (active: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  hasActiveRenderToast: false,
  setHasActiveRenderToast: (active) => set({ hasActiveRenderToast: active }),
}))
