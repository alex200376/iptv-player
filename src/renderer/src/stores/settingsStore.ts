import { create } from 'zustand'
import type { Settings } from '../../../../shared/types'
import type { ThemeId } from '../themes'
import { logger } from '../utils/logger'

interface SettingsStore {
  settings: Settings
  loaded: boolean
  loadSettings: () => Promise<void>
  updateSettings: (partial: Partial<Settings>) => Promise<void>
}

const DEFAULTS: Settings = {
  theme: 'dark',
  customTheme: null,
  hardwareAcceleration: 'd3d11va',
  networkCache: 800,
  fontSize: 'normal',
  compatibilityMode: false,
  autoReconnect: true,
  reconnectInterval: 5000,
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
    } catch (e) {
      logger.error('[settings] loadSettings failed:', e)
    }
  },

  updateSettings: async (partial) => {
    const next = { ...get().settings, ...partial }
    set({ settings: next })
    try {
      await window.electronAPI.saveSettings(next)
    } catch (e) {
      logger.error('[settings] updateSettings failed:', e)
    }
  },
}))
