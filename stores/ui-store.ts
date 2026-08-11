import { create } from 'zustand'

export interface UiState {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
