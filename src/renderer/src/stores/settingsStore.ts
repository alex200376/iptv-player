import { create } from 'zustand'
import type { ThemeId } from '../themes'

export interface Settings {
  theme: ThemeId
  hardwareAcceleration: string
  networkCache: number
  fontSize: 'small' | 'normal' | 'large' | 'xlarge'
  compatibilityMode: boolean
  autoReconnect: boolean
  reconnectInterval: number
  playlistRefreshInterval: number
  h264Threads: number
  avcodecHwDisabled: boolean
  streamProxy: boolean
  proxyResolution: string
  autoDownloadUpdates: boolean
  snoozeUpdateUntil: number
  language: 'zh-CN' | 'en-US'
}

interface SettingsStore {
  settings: Settings
  loaded: boolean
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<Settings>) => Promise<void>
}

const DEFAULTS: Settings = {
  theme: 'dark',
  hardwareAcceleration: 'd3d11va',
  networkCache: 2000,
  fontSize: 'normal',
  compatibilityMode: false,
  autoReconnect: true,
  reconnectInterval: 2000,
  playlistRefreshInterval: 0,
  h264Threads: 0,
  avcodecHwDisabled: false,
  streamProxy: false,
  proxyResolution: 'original',
  autoDownloadUpdates: false,
  snoozeUpdateUntil: 0,
  language: 'zh-CN',
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULTS,
  loaded: false,

  loadSettings: async () => {
    try {
      const result = await window.electronAPI.getSettings()
      set({ settings: { ...DEFAULTS, ...result }, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },

  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial }
    set({ settings: next })
    try {
      await window.electronAPI.saveSettings(next)
    } catch {
      // ignore
    }
  },
}))
