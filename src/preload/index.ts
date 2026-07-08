import { contextBridge, ipcRenderer } from 'electron'

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

interface PlaylistMeta {
  id: string
  name: string
  source: 'file' | 'url'
  path?: string
  url?: string
  importedAt: number
  channelCount: number
}

interface HistoryEntry {
  channel: Channel
  watchedAt: number
}

interface EpgSource {
  url: string
  importedAt: number
  programCount: number
  tvgIds: string[]
}

interface UserData {
  favoriteIds: string[]
  historyEntries: HistoryEntry[]
  playlists: PlaylistMeta[]
  epgSources?: EpgSource[]
}

const api = {
  switchChannel: (url: string) => ipcRenderer.invoke('switch-channel', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (text: string) => void) => {
    ipcRenderer.on('update-status', (_event, text) => callback(text))
  },
  onUpdateDownloadProgress: (callback: (progress: { percent: number; bytesPerSecond: number; total: number; transferred: number }) => void) => {
    ipcRenderer.on('update-download-progress', (_event, progress) => callback(progress))
  },
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    ipcRenderer.on('update-downloaded', (_event, info) => callback(info))
  },
  importM3U: () => ipcRenderer.invoke('import-m3u'),
  importM3UFromUrl: (url: string) => ipcRenderer.invoke('import-m3u-url', url),
  hidePlayer: () => ipcRenderer.invoke('hide-player'),
  hidePlayerWindow: () => ipcRenderer.invoke('hide-player-window'),
  showPlayerWindow: () => ipcRenderer.invoke('show-player-window'),
  hideOverlay: () => ipcRenderer.send('hide-overlay'),
  showOverlay: () => ipcRenderer.send('show-overlay'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (s: Record<string, unknown>) => ipcRenderer.invoke('save-settings', s),
  applyHwAccel: () => ipcRenderer.invoke('apply-hw-accel'),
  saveChannels: (channels: Channel[]) => ipcRenderer.invoke('save-channels', channels),
  loadChannels: () => ipcRenderer.invoke('load-channels'),
  openSettingsWindow: () => ipcRenderer.invoke('open-settings-window'),
  closeCurrentWindow: () => ipcRenderer.send('close-current-window'),
  saveUserData: (data: UserData) => ipcRenderer.invoke('save-user-data', data),
  loadUserData: () => ipcRenderer.invoke('load-user-data'),

  // Playback controls
  togglePlay: () => ipcRenderer.invoke('toggle-play'),
  setVolume: (vol: number) => ipcRenderer.invoke('set-volume', vol),
  toggleMute: () => ipcRenderer.invoke('toggle-mute'),
  skipTime: (seconds: number) => ipcRenderer.invoke('skip-time', seconds),
  getPlayerTime: () => ipcRenderer.invoke('get-player-time'),
  getPlayerDuration: () => ipcRenderer.invoke('get-player-duration'),
  setPlayerTime: (timeMs: number) => ipcRenderer.invoke('set-player-time', timeMs),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  notifyLayoutChange: () => ipcRenderer.invoke('notify-layout-change'),
  exitFullscreen: () => ipcRenderer.invoke('exit-fullscreen'),
  exportM3U: () => ipcRenderer.invoke('export-m3u'),
  fetchEpg: (tvgUrl: string) => ipcRenderer.invoke('fetch-epg', tvgUrl),
  importEpgFromUrl: (url: string) => ipcRenderer.invoke('import-epg-url', url),

  // Playlist refresh
  refreshPlaylists: () => ipcRenderer.invoke('refresh-playlists'),
  refreshPlaylistUrl: (url: string) => ipcRenderer.invoke('refresh-playlist-url', url),
  onPlaylistsRefreshed: (callback: (channels: unknown[]) => void) => {
    ipcRenderer.on('playlists-refreshed', (_event, channels) => callback(channels))
  },

  // Link check
  checkChannelUrl: (url: string) => ipcRenderer.invoke('check-channel-url', url),
  checkAllChannels: () => ipcRenderer.invoke('check-all-channels'),
  onChannelsCheckProgress: (callback: (progress: { checked: number; total: number }) => void) => {
    ipcRenderer.on('channels-check-progress', (_event, progress) => callback(progress))
  },
  onChannelsCheckDone: (callback: (channels: unknown[]) => void) => {
    ipcRenderer.on('channels-check-done', (_event, channels) => callback(channels))
  },

  // Picture-in-Picture
  togglePip: () => ipcRenderer.invoke('toggle-pip'),
  onPipStateChange: (callback: (active: boolean) => void) => {
    ipcRenderer.on('pip-state-changed', (_event, active) => callback(active))
  },

  // Player state
  onPlayerBuffering: (callback: () => void) => {
    ipcRenderer.on('player-buffering', () => callback())
  },
  onPlayerPlaying: (callback: () => void) => {
    ipcRenderer.on('player-playing', () => callback())
  },
  onPlayerError: (callback: () => void) => {
    ipcRenderer.on('player-error', () => callback())
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
