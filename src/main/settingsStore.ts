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
  language: string
}

const DEFAULTS: Settings = {
  theme: 'dark',
  hardwareAcceleration: 'd3d11va',
  // Raised from 400 ms → 800 ms default.
  // 400 ms caused frequent micro-stalls on jittery CDN/IPTV streams.
  // 800 ms absorbs most network jitter while still feeling fast on switch.
  // Proxied localhost streams override to 150 ms automatically.
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
  language: 'zh-CN',
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
    // Clamp networkCache to sane range: 500 ms – 10 000 ms.
    // Floor raised from 200 ms to 500 ms — values below 500 ms reliably
    // cause constant rebuffering on real IPTV streams.
    if (parsed.networkCache !== undefined) {
      parsed.networkCache = Math.min(10000, Math.max(500, Number(parsed.networkCache) || 800))
    }
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

export function writeSettings(settings: Settings): void {
  writeFileSync(getFilePath(), JSON.stringify(settings, null, 2), 'utf-8')
}
