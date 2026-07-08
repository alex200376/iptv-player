import { ipcMain, app } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { getState } from './shared'
import { readSettings, writeSettings } from '../settingsStore'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

let checkInProgress = false
let _updateAvailable: UpdateInfo | null = null

function sendToRenderer(channel: string, ...args: unknown[]) {
  const state = getState()
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send(channel, ...args)
  }
}

async function backgroundCheck() {
  const settings = readSettings()
  if (settings.snoozeUpdateUntil > Date.now()) return
  try {
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo.version > autoUpdater.currentVersion) {
      _updateAvailable = result.updateInfo
      sendToRenderer('update-available', {
        version: result.updateInfo.version,
        releaseDate: result.updateInfo.releaseDate,
        releaseNotes: result.updateInfo.releaseNotes,
      })
      if (settings.autoDownloadUpdates) {
        autoUpdater.downloadUpdate()
        sendToRenderer('update-status', '正在背景下载更新...')
      }
    }
  } catch {
    // silent
  }
}

export function registerUpdateIpc() {
  ipcMain.handle('get-app-version', () => app.getVersion())

  ipcMain.handle('check-for-update', async () => {
    if (checkInProgress) return { checking: true }
    checkInProgress = true
    try {
      const result = await autoUpdater.checkForUpdates()
      checkInProgress = false
      if (result && result.updateInfo.version > autoUpdater.currentVersion) {
        _updateAvailable = result.updateInfo
        return { available: true, info: result.updateInfo }
      }
      _updateAvailable = null
      return { available: false }
    } catch (e) {
      checkInProgress = false
      return { available: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('download-update', async () => {
    try {
      autoUpdater.downloadUpdate()
      return { downloading: true }
    } catch (e) {
      return { downloading: false, error: (e as Error).message }
    }
  })

  ipcMain.handle('install-update', () => {
    setImmediate(() => autoUpdater.quitAndInstall())
    return true
  })

  ipcMain.handle('snooze-update', (_event, until: number) => {
    const settings = readSettings()
    writeSettings({ ...settings, snoozeUpdateUntil: until })
    return true
  })
}

autoUpdater.on('download-progress', (progress) => {
  sendToRenderer('update-download-progress', {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    total: progress.total,
    transferred: progress.transferred,
  })
})

autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
  _updateAvailable = null
  sendToRenderer('update-downloaded', { version: info.version })
})

autoUpdater.on('error', (err) => {
  sendToRenderer('update-status', `更新錯誤: ${err.message}`)
})

export { backgroundCheck }
