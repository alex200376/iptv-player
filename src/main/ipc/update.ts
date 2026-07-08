import { ipcMain, app } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'
import { getState } from './shared'

autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

let checkInProgress = false

function sendStatus(text: string) {
  const state = getState()
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send('update-status', text)
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
        return { available: true, info: result.updateInfo }
      }
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
}

autoUpdater.on('download-progress', (progress) => {
  const state = getState()
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send('update-download-progress', progress)
  }
})

autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
  const state = getState()
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send('update-downloaded', info)
  }
})

autoUpdater.on('error', (err) => {
  sendStatus(`更新錯誤: ${err.message}`)
})
