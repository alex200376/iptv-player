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

export interface EpgProgram {
  channelTvgId: string
  start: Date
  stop: Date
  title: string
  description?: string
  category?: string
  icon?: string
}

export interface PlaylistMeta {
  id: string
  name: string
  source: 'file' | 'url'
  path?: string
  url?: string
  importedAt: number
  channelCount: number
}

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
}
