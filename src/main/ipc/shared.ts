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
  // networkCache floor raised to 800 ms:
  // 300 ms was too low for jittery CDN/IPTV streams and caused frequent
  // micro-stalls. 800 ms absorbs most network jitter while still switching
  // channels quickly. Proxied localhost streams stay at 150 ms (override
  // applied in playback.ts).
  const cache = Math.max(settings.networkCache, 800)

  const options = [
    `:network-caching=${cache}`,
    `:live-caching=${cache}`,
    `:file-caching=${Math.min(cache, 1000)}`,
    `:h264-threads=${settings.h264Threads}`,
    // Longer TCP timeout — some IPTV servers are slow to accept connections.
    ':tcp-timeout=15000',
    ':rtsp-tcp',
    ':sout-mux-caching=100',
    ':drop-late-frames',
    ':clock-synchro=0',
    // Eliminate clock jitter compensation which can cause video stutter on
    // live streams with imperfect PCR timestamps.
    ':clock-jitter=0',
    // Disable network sync so VLC does not try to compensate for jitter
    // by dropping frames when the stream recovers from a micro-stall.
    ':network-synchronisation=0',
    // Tell VLC to reconnect HTTP streams automatically on short drops
    // before bubbling the error up to the app reconnect logic.
    ':http-reconnect=true',
    // Prevent some CDN/proxy servers from blocking headless HTTP clients.
    ':http-user-agent=VLC/3.0',
    // 4 MiB prefetch buffer — previously 1 MiB.
    // Larger prefetch means VLC reads ahead further and is less likely to
    // stall when the CDN has a brief throughput dip.
    ':prefetch-buffer-size=4194304',
    // Give avformat/ffmpeg more data to probe the stream format so it does
    // not misdetect codec parameters and cause stuttering on startup.
    ':avformat-probesize=5000000',
    ':avformat-analyzeduration=3000000',
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
