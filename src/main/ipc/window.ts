import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { getBinding } from 'electron-vlc-player'
import { getState, ensureEmbedded } from './shared'

export function registerWindowIpc() {
  ipcMain.handle('hide-player-window', async () => {
    const state = getState()
    if (ensureEmbedded()) {
      try { getBinding().setPlayerWindowVisible(state.player!.playerId, false) } catch {}
      state.player!.hideOverlay()
    }
  })

  ipcMain.handle('show-player-window', async () => {
    const state = getState()
    if (ensureEmbedded()) {
      try { getBinding().setPlayerWindowVisible(state.player!.playerId, true) } catch {}
      state.player!.showOverlay()
    }
  })

  ipcMain.on('hide-overlay', () => { try { getState().player?.hideOverlay() } catch {} })
  ipcMain.on('show-overlay', () => { try { getState().player?.showOverlay() } catch {} })

  ipcMain.handle('toggle-fullscreen', () => {
    const state = getState()
    if (!state.mainWindow) return
    state.mainWindow.setFullScreen(!state.mainWindow.isFullScreen())
  })

  ipcMain.handle('notify-layout-change', () => {
    try { getState().player?.notifyLayoutChange() } catch {}
  })

  ipcMain.handle('exit-fullscreen', () => {
    const state = getState()
    if (state.mainWindow?.isFullScreen()) state.mainWindow.setFullScreen(false)
  })

  ipcMain.handle('open-settings-window', () => {
    const settingsWin = new BrowserWindow({
      width: 780,
      height: 640,
      title: '设置 - IPTV Player',
      backgroundColor: '#0f0f1a',
      icon: join(__dirname, '../../build/icon.png'),
      resizable: true,
      maximizable: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    if (process.env.ELECTRON_RENDERER_URL) {
      settingsWin.loadURL(`${process.env.ELECTRON_RENDERER_URL}#/settings`)
    } else {
      settingsWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/settings' })
    }
  })

  ipcMain.on('close-current-window', (event) => {
    const state = getState()
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win && win !== state.mainWindow) win.close()
  })
}
