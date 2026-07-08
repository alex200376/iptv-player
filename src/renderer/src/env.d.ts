/// <reference types="vite/client" />

interface Channel {
  id: string
  name: string
  url: string
  logo?: string
  group?: string
  tvgId?: string
  tvgUrl?: string
  status?: 'unknown' | 'online' | 'offline'
  lastCheckedAt?: number
}

interface EpgProgram {
  channelTvgId: string
  start: string
  stop: string
  title: string
  description?: string
  category?: string
  icon?: string
}

interface HistoryEntry {
  channel: Channel
  watchedAt: number
}

interface PlaylistMeta {
  id: string
  name: string
  source: 'file' | 'url'
  path?: string
  url?: string
  importedAt: number
  channelCount: number
}

interface UserData {
  favoriteIds: string[]
  historyEntries: HistoryEntry[]
  playlists: PlaylistMeta[]
  epgSources?: EpgSource[]
}

interface EpgSource {
  url: string
  importedAt: number
  programCount: number
  tvgIds: string[]
}

interface ImportResult {
  channels: Channel[]
  playlistId?: string
  playlistName?: string
  url?: string
  error?: string
}

interface Settings {
  theme: string
  hardwareAcceleration: string
  networkCache: number
  fontSize: string
  compatibilityMode: boolean
  autoReconnect: boolean
  reconnectInterval: number
  playlistRefreshInterval: number
  streamProxy: boolean
  proxyResolution: string
}

interface PlayResult {
  success: boolean
  error?: string
}

interface ElectronAPI {
  switchChannel: (url: string) => Promise<PlayResult>
  importM3U: () => Promise<ImportResult>
  importM3UFromUrl: (url: string) => Promise<ImportResult>
  hidePlayer: () => Promise<void>
  hidePlayerWindow: () => Promise<void>
  showPlayerWindow: () => Promise<void>
  hideOverlay: () => void
  showOverlay: () => void
  getSettings: () => Promise<Settings>
  saveSettings: (s: Record<string, unknown>) => Promise<boolean>
  applyHwAccel: () => Promise<boolean>
  saveChannels: (channels: Channel[]) => Promise<void>
  loadChannels: () => Promise<Channel[]>
  openSettingsWindow: () => Promise<void>
  closeCurrentWindow: () => void
  saveUserData: (data: UserData) => Promise<boolean>
  loadUserData: () => Promise<UserData>
  togglePlay: () => Promise<void>
  setVolume: (vol: number) => Promise<void>
  toggleMute: () => Promise<boolean>
  skipTime: (seconds: number) => Promise<void>
  getPlayerTime: () => Promise<number>
  getPlayerDuration: () => Promise<number>
  setPlayerTime: (timeMs: number) => Promise<void>
  toggleFullscreen: () => Promise<void>
  notifyLayoutChange: () => Promise<void>
  exitFullscreen: () => Promise<void>
  exportM3U: () => Promise<{ success: boolean; error?: string }>
  fetchEpg: (tvgUrl: string) => Promise<EpgProgram[]>
  importEpgFromUrl: (url: string) => Promise<{ success: boolean; count: number; tvgIds: string[]; error?: string }>
  refreshPlaylists: () => Promise<{ total: number; errors: string[] }>
  refreshPlaylistUrl: (url: string) => Promise<{ added: number; updated: number; removed: number; error?: string }>
  onPlaylistsRefreshed: (callback: (channels: Channel[]) => void) => void
  checkChannelUrl: (url: string) => Promise<{ online: boolean; length?: number; lastCheckedAt: number; error?: string }>
  checkAllChannels: () => Promise<{ total: number }>
  onChannelsCheckProgress: (callback: (progress: { checked: number; total: number }) => void) => void
  onChannelsCheckDone: (callback: (channels: Channel[]) => void) => void
  togglePip: () => Promise<{ active: boolean }>
  onPipStateChange: (callback: (active: boolean) => void) => void
  onPlayerBuffering: (callback: () => void) => void
  onPlayerPlaying: (callback: () => void) => void
  onPlayerError: (callback: () => void) => void
}

interface Window {
  electronAPI: ElectronAPI
}

interface ImportMeta {
  env: Record<string, string | undefined>
}

export {}
