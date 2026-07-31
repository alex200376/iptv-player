/// <reference types="vite/client" />

import type {
  Channel,
  EpgProgram,
  HistoryEntry,
  PlaylistMeta,
  UserData,
  EpgSource,
  Settings,
  ImportResult,
  PlayResult,
  UpdateDownloadProgress,
  UpdateInfo,
  ChannelCheckProgress,
  ChannelCheckLog,
} from '../../shared/types'

interface ElectronAPI {
  switchChannel: (url: string) => Promise<PlayResult>
  importM3U: () => Promise<ImportResult>
  importM3UFromUrl: (url: string) => Promise<ImportResult>
  importM3UFromFile: (filePath: string) => Promise<ImportResult>
  hidePlayer: () => Promise<void>
  hidePlayerWindow: () => Promise<void>
  showPlayerWindow: () => Promise<void>
  hideOverlay: () => void
  showOverlay: () => void
  getSettings: () => Promise<Settings>
  saveSettings: (s: Settings) => Promise<boolean>
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
  notifyLayoutChange: (force?: boolean) => Promise<void>
  notifyLayoutChangeNow: () => Promise<void>
  exitFullscreen: () => Promise<void>
  exportM3U: () => Promise<{ success: boolean; error?: string }>
  fetchEpg: (tvgUrl: string) => Promise<EpgProgram[]>
  importEpgFromUrl: (url: string) => Promise<{ success: boolean; count: number; tvgIds: string[]; error?: string }>
  refreshPlaylists: () => Promise<{ total: number; errors: string[] }>
  refreshPlaylistUrl: (playlistId: string, url?: string) => Promise<{ added: number; updated: number; removed: number; error?: string }>
  onPlaylistsRefreshed: (callback: (channels: Channel[]) => void) => () => void
  checkChannelUrl: (url: string) => Promise<{ online: boolean; length?: number; lastCheckedAt: number; error?: string }>
  checkAllChannels: () => Promise<{ total: number; channels: Channel[] }>
  cancelCheckAll: () => void
  removeOfflineChannels: () => Promise<{ channels: Channel[]; removedCount: number }>
  clearAllData: () => Promise<{ success: boolean; error?: string }>
  backupData: () => Promise<{ success: boolean; error?: string }>
  restoreData: () => Promise<{ success: boolean; info?: { channels: number; playlists: number }; error?: string }>
  getLogoUrl: (url: string) => Promise<string>
  cacheLogos: (urls: string[]) => Promise<boolean>
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  isWindowMaximized: () => Promise<boolean>
  showAppMenu: (menuName: string, x: number, y: number) => Promise<void>
  showContextMenu: (data: {
    x: number; y: number; channel: Channel; actions: Array<{
      id?: string; label: string; danger?: boolean; separator?: boolean
    }>
  }) => Promise<void>
  onContextMenuAction: (callback: (payload: { action: string; channel: Channel }) => void) => () => void
  onWindowMaximized: (callback: (maximized: boolean) => void) => () => void
  onFullscreenChanged: (callback: (fullscreen: boolean) => void) => () => void
  onMenuAction: (callback: (action: string) => void) => () => void
  onMenuClosed: (callback: () => void) => () => void
  onChannelsCheckProgress: (callback: (progress: ChannelCheckProgress) => void) => () => void
  onChannelsCheckLog: (callback: (log: ChannelCheckLog) => void) => () => void
  onChannelsCheckDone: (callback: (channels: Channel[]) => void) => () => void
  togglePip: () => Promise<{ active: boolean }>
  pipReloadSource: () => Promise<void>
  onPipStateChange: (callback: (active: boolean) => void) => () => void
  onPlayerBuffering: (callback: () => void) => () => void
  onPlayerPlaying: (callback: () => void) => () => void
  onPlayerError: (callback: () => void) => () => void
  onPlayerDead: (callback: (url: string) => void) => () => void
  onPlayerDeadNotify: (callback: (url: string) => void) => () => void

  getAppVersion: () => Promise<string>
  getVlcVersion: () => Promise<string>
  snoozeUpdate: (until: number) => Promise<boolean>
  checkForUpdate: () => Promise<{ available: boolean; info?: UpdateInfo; error?: string; checking?: boolean }>
  downloadUpdate: () => Promise<{ downloading: boolean; error?: string }>
  installUpdate: () => Promise<boolean>
  onUpdateStatus: (callback: (text: string) => void) => () => void
  onUpdateDownloadProgress: (callback: (progress: UpdateDownloadProgress) => void) => () => void
  onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => () => void
}

interface Window {
  electronAPI: ElectronAPI
}

interface ImportMeta {
  env: Record<string, string | undefined>
}

export {}
