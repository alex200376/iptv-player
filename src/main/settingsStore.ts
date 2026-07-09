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
  // Reduced from 2000 ms → 400 ms default.
  // 2000 ms meant VLC buffered 2 full seconds before first frame — causes noticeable freeze on channel switch.
  // 400 ms balances startup latency with rebuffering protection.
  // Proxied localhost streams override to 150 ms automatically.
  networkCache: 400,
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
    // Clamp networkCache to sane range: 200 ms – 10 000 ms
    if (parsed.networkCache !== undefined) {
      parsed.networkCache = Math.min(10000, Math.max(200, Number(parsed.networkCache) || 400))
    }
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(settings: Settings): void {
  writeFileSync(getFilePath(), JSON.stringify(settings, null, 2), 'utf-8')
}
