import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface Settings {
  theme: string
  hardwareAcceleration: string
  networkCache: number
  fontSize: string
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
}

const DEFAULTS: Settings = {
  theme: 'dark',
  hardwareAcceleration: 'd3d11va',
  // Reduced from 2000 ms → 800 ms default.
  // 2000 ms meant VLC buffered 2 full seconds before first frame — causes noticeable freeze on channel switch.
  // 800 ms is a good balance between startup latency and rebuffering on slow connections.
  // Users on poor networks can raise this in Settings.
  networkCache: 800,
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
}

function getFilePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, 'iptv-player-settings.json')
}

export function readSettings(): Settings {
  try {
    const raw = readFileSync(getFilePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    // Clamp networkCache to sane range: 300 ms – 10 000 ms
    if (parsed.networkCache !== undefined) {
      parsed.networkCache = Math.min(10000, Math.max(300, Number(parsed.networkCache) || 800))
    }
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(settings: Settings): void {
  writeFileSync(getFilePath(), JSON.stringify(settings, null, 2), 'utf-8')
}
