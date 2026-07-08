import { ipcMain } from 'electron'
import { readSettings, writeSettings } from '../settingsStore'
import { getState } from './shared'
import { refreshAllUrlPlaylists } from './playlist'

function startPlaylistRefreshTimer() {
  const state = getState()
  if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null }
  const settings = readSettings()
  const intervalMinutes = settings.playlistRefreshInterval
  if (!intervalMinutes || intervalMinutes <= 0) return
  state.refreshTimer = setInterval(() => { refreshAllUrlPlaylists() }, intervalMinutes * 60 * 1000)
}

export function registerSettingsIpc() {
  ipcMain.handle('get-settings', () => readSettings())

  ipcMain.handle('save-settings', (_event, s: Record<string, unknown>) => {
    writeSettings(s as any)
    startPlaylistRefreshTimer()
    return true
  })

  ipcMain.handle('apply-hw-accel', () => {
    const state = getState()
    if (state.player) { state.player.destroy(); state.player = null }
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('player-error')
    }
    return true
  })
}
