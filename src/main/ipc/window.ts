import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { getBinding } from 'electron-vlc-player'
import { getState, ensureEmbedded } from './shared'
import { showMenuPopup } from '../menu'
import { t } from '../i18n'

// Rate-limit notify-layout-change so rapid sidebar toggles / React re-renders
// do not hammer the VLC surface renegotiation path (causes ~200 ms freeze each time).
let _layoutChangeTimer: ReturnType<typeof setTimeout> | null = null
let _lastLayoutW = 0
let _lastLayoutH = 0
const LAYOUT_DEBOUNCE_MS = 120

function debouncedNotifyLayout() {
  if (_layoutChangeTimer) return
  _layoutChangeTimer = setTimeout(() => {
    _layoutChangeTimer = null
    const state = getState()
    if (!state.player || state.player.destroyed) return
    // Only forward to VLC when the window bounds actually changed.
    const win = state.mainWindow
    if (win && !win.isDestroyed()) {
      const [w, h] = win.getContentSize()
      if (Math.abs(w - _lastLayoutW) < 4 && Math.abs(h - _lastLayoutH) < 4) return
      _lastLayoutW = w
      _lastLayoutH = h
    }
    try { state.player.notifyLayoutChange() } catch (e) { console.error('[window] notifyLayoutChange:', e) }
  }, LAYOUT_DEBOUNCE_MS)
}

export function registerWindowIpc() {
  ipcMain.handle('get-vlc-version', async () => {
    try {
      const binding = getBinding()
      const version = binding?.getVersion?.() || '3.0.23'
      return version
    } catch {
      return '3.0.23'
    }
  })
  ipcMain.handle('hide-player-window', async () => {
    const state = getState()
    if (ensureEmbedded()) {
      try { getBinding().setPlayerWindowVisible(state.player!.playerId, false) } catch (e) { console.error('[window] hidePlayerWindow:', e) }
      state.player!.hideOverlay()
    }
  })

  ipcMain.handle('show-player-window', async () => {
    const state = getState()
    if (ensureEmbedded()) {
      try { getBinding().setPlayerWindowVisible(state.player!.playerId, true) } catch (e) { console.error('[window] showPlayerWindow:', e) }
      state.player!.showOverlay()
    }
  })

  ipcMain.on('hide-overlay', () => { try { getState().player?.hideOverlay() } catch (e) { console.error('[window] hideOverlay:', e) } })
  ipcMain.on('show-overlay', () => { try { getState().player?.showOverlay() } catch (e) { console.error('[window] showOverlay:', e) } })

  ipcMain.handle('minimize-window', () => {
    getState().mainWindow?.minimize()
  })

  ipcMain.handle('maximize-window', () => {
    const win = getState().mainWindow
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })

  ipcMain.handle('close-window', () => {
    getState().mainWindow?.close()
  })

  ipcMain.handle('is-window-maximized', () => {
    return getState().mainWindow?.isMaximized() ?? false
  })

  ipcMain.handle('show-app-menu', (_event, menuName: string, x: number, y: number) => {
    const win = getState().mainWindow
    if (!win) return
    showMenuPopup(menuName, win, x, y)
  })

  ipcMain.handle('toggle-fullscreen', () => {
    const state = getState()
    if (!state.mainWindow) return
    state.mainWindow.setFullScreen(!state.mainWindow.isFullScreen())
  })

  // Debounced + dimension-checked so sidebar/EPG panel toggles don't
  // trigger a full VLC surface renegotiation on every React render.
  ipcMain.handle('notify-layout-change', () => {
    debouncedNotifyLayout()
  })

  ipcMain.handle('exit-fullscreen', () => {
    const state = getState()
    if (state.mainWindow?.isFullScreen()) state.mainWindow.setFullScreen(false)
  })

  ipcMain.handle('open-settings-window', () => {
    const settingsWin = new BrowserWindow({
      width: 780,
      height: 640,
      title: t('window.settingsTitle'),
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
