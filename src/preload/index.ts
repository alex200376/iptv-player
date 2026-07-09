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

// Helper: register a listener and return a cleanup function.
function on<T>(channel: string, cb: (payload: T) => void): () => void {
  const wrapper = (_event: Electron.IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, wrapper)
  return () => ipcRenderer.removeListener(channel, wrapper)
}

const api = {
  switchChannel: (url: string) => ipcRenderer.invoke('switch-channel', url),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  snoozeUpdate: (until: number) => ipcRenderer.invoke('snooze-update', until),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // All on* methods now return an unsubscribe () => void so components can
  // call it from their useEffect cleanup and avoid listener accumulation.
  onUpdateStatus: (callback: (text: string) => void) =>
    on<string>('update-status', callback),

  onUpdateDownloadProgress: (
    callback: (progress: {
      percent: number
      bytesPerSecond: number
      total: number
      transferred: number
    }) => void,
  ) => on('update-download-progress', callback),

  onUpdateDownloaded: (callback: (info: { version: string }) => void) =>
    on<{ version: string }>('update-downloaded', callback),

  onUpdateAvailable: (
    callback: (info: { version: string; releaseDate?: string; releaseNotes?: string }) => void,
  ) => on('update-available', callback),

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

  refreshPlaylists: () => ipcRenderer.invoke('refresh-playlists'),
  refreshPlaylistUrl: (url: string) => ipcRenderer.invoke('refresh-playlist-url', url),
  onPlaylistsRefreshed: (callback: (channels: unknown[]) => void) =>
    on<unknown[]>('playlists-refreshed', callback),

  checkChannelUrl: (url: string) => ipcRenderer.invoke('check-channel-url', url),
  checkAllChannels: () => ipcRenderer.invoke('check-all-channels'),
  removeOfflineChannels: () =>
    ipcRenderer.invoke('remove-offline-channels') as Promise<{
      channels: Channel[]
      removedCount: number
    }>,
  onChannelsCheckProgress: (
    callback: (progress: { checked: number; total: number }) => void,
  ) => on('channels-check-progress', callback),

  onChannelsCheckDone: (callback: (channels: unknown[]) => void) =>
    on<unknown[]>('channels-check-done', callback),

  togglePip: () => ipcRenderer.invoke('toggle-pip'),
  onPipStateChange: (callback: (active: boolean) => void) =>
    on<boolean>('pip-state-changed', callback),

  // Player state events — all return unsubscribe functions.
  onPlayerBuffering: (callback: () => void): (() => void) => {
    const wrapper = () => callback()
    ipcRenderer.on('player-buffering', wrapper)
    return () => ipcRenderer.removeListener('player-buffering', wrapper)
  },
  onPlayerPlaying: (callback: () => void): (() => void) => {
    const wrapper = () => callback()
    ipcRenderer.on('player-playing', wrapper)
    return () => ipcRenderer.removeListener('player-playing', wrapper)
  },
  onPlayerError: (callback: () => void): (() => void) => {
    const wrapper = () => callback()
    ipcRenderer.on('player-error', wrapper)
    return () => ipcRenderer.removeListener('player-error', wrapper)
  },
}

contextBridge.exposeInMainWorld('electronAPI', api)
