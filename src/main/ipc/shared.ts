import { BrowserWindow } from 'electron'
import { VlcPlayer } from 'electron-vlc-player'
import type { Settings } from '../settingsStore'

export interface SharedState {
  mainWindow: BrowserWindow | null
  player: VlcPlayer | null
  vlcDir: string | null
  refreshTimer: ReturnType<typeof setInterval> | null
  pipWindow: BrowserWindow | null
  currentUrl: string
  originalUrl: string
}

const state: SharedState = {
  mainWindow: null,
  player: null,
  vlcDir: null,
  refreshTimer: null,
  pipWindow: null,
  currentUrl: '',
  originalUrl: '',
}

export function getState(): SharedState {
  return state
}

export function buildMediaOptions(settings: Settings): string[] {
  const options = [
    `:network-caching=${settings.networkCache}`,
    `:live-caching=${settings.networkCache}`,
    `:h264-threads=${settings.h264Threads}`,
  ]
  if (settings.avcodecHwDisabled) {
    options.push(':avcodec-hw=disabled')
  }
  return options
}

export function ensurePlayerEmbedded() {
  if (!state.player) return
  if (state.player.isEmbedded()) return
  return state.player.embed()
}

export function ensureEmbedded(): boolean {
  return !!state.player && state.player.isEmbedded()
}
