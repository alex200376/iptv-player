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
  // networkCache floor: 300 ms is the minimum that avoids constant rebuffering
  // on a typical broadband connection while still feeling responsive on switch.
  const cache = Math.max(settings.networkCache, 300)

  const options = [
    `:network-caching=${cache}`,
    `:live-caching=${cache}`,
    `:file-caching=${Math.min(cache, 1000)}`,
    `:h264-threads=${settings.h264Threads}`,
    // Generous TCP timeout so VLC does not immediately give up on slow streams.
    ':tcp-timeout=10000',
    ':rtsp-tcp',
    ':sout-mux-caching=100',
    ':drop-late-frames',
    ':clock-synchro=0',
    // Prevent some CDN/proxy servers from blocking headless HTTP clients.
    ':http-user-agent=VLC/3.0',
    // Pre-buffer 1 MiB ahead of the demuxer read position for smoother startup.
    ':prefetch-buffer-size=1048576',
  ]

  // avcodec-hw=disabled wins over hardwareAcceleration because it forces
  // full software decode, which is what compatibilityMode is meant to do.
  if (settings.compatibilityMode) {
    options.push(':avcodec-hw=disabled')
    options.push(':ffmpeg-hw=disabled')
  } else if (settings.avcodecHwDisabled) {
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
