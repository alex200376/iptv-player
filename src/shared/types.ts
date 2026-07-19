// ── Channel ─────────────────────────────────────────────
export interface Channel {
  id: string
  name: string
  url: string
  logo?: string
  group?: string
  tvgId?: string
  tvgUrl?: string
  tvgChno?: string
  playlistId?: string
  status?: 'unknown' | 'online' | 'offline'
  lastCheckedAt?: number
}

export interface ChannelGroup {
  name: string
  channels: Channel[]
}

// ── EPG ─────────────────────────────────────────────────
export interface EpgProgram {
  channelTvgId: string
  start: string
  stop: string
  title: string
  description?: string
  category?: string
  icon?: string
}

// ── Playlist ────────────────────────────────────────────
export interface PlaylistMeta {
  id: string
  name: string
  source: 'file' | 'url'
  path?: string
  url?: string
  importedAt: number
  channelCount: number
}

// ── User Data ────────────────────────────────────────────
export interface HistoryEntry {
  channel: Channel
  watchedAt: number
}

export interface EpgSource {
  url: string
  importedAt: number
  programCount: number
  tvgIds: string[]
}

export interface UserData {
  favoriteIds: string[]
  historyEntries: HistoryEntry[]
  playlists: PlaylistMeta[]
  epgSources?: EpgSource[]
  activePlaylistId?: string | null
}

// ── Settings ────────────────────────────────────────────
export interface AppSettings {
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

// ── IPC ─────────────────────────────────────────────────
export interface UpdateDownloadProgress {
  percent: number
  bytesPerSecond: number
  total: number
  transferred: number
}

export interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

export interface ChannelCheckProgress {
  checked: number
  total: number
}

export interface ChannelCheckLog {
  name: string
  url: string
  protocol: string
  result: string
  checked: number
  total: number
}
