import { BrowserWindow, app, dialog, session } from 'electron'
import { join } from 'path'
import { VlcPlayer, probeDefaultVlcDir, initLibVlc } from 'electron-vlc-player'
import { getState } from './ipc/shared'
import { registerPlaybackIpc } from './ipc/playback'
import { registerSettingsIpc } from './ipc/settings'
import { registerPlaylistIpc } from './ipc/playlist'
import { registerPipIpc } from './ipc/pip'
import { registerEpgIpc } from './ipc/epg'
import { registerWindowIpc } from './ipc/window'
import { registerUpdateIpc, backgroundCheck } from './ipc/update'
import { destroyProxy } from './streamProxy'
import { t } from './i18n'

let mainWindow: BrowserWindow | null = null

async function createWindow() {
  const iconPath = join(__dirname, '../../build/icon.png')
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 900,
    minHeight: 500,
    title: 'IPTV Player',
    frame: false,
    backgroundColor: '#0f0f1a',
    icon: iconPath,
    // Prevent Electron from throttling the renderer when window is hidden/minimised
    // which can cause audio/video stutter on refocus
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      // Enable GPU rasterisation so CSS animations don't block the VLC overlay
      enableBlinkFeatures: 'CSSContainerQueries',
    },
  })

  // electron-vlc-player registers window-level listeners (close/resize/minimize/etc.)
  // on every new VlcPlayer() and never removes them. Suppress the MaxListeners warning.
  mainWindow.setMaxListeners(0)

  // Ask Chromium to prefer hardware compositing
  app.commandLine.appendSwitch('enable-gpu-rasterization')
  app.commandLine.appendSwitch('enable-zero-copy')
  // Prevent GPU process from being killed on resize (common freeze source)
  app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds')

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const state = getState()
  state.mainWindow = mainWindow

  // Debounce resize events — calling notifyLayoutChange on every pixel move
  // causes VLC to re-negotiate the video surface and can freeze for ~200 ms
  let resizeTimer: ReturnType<typeof setTimeout> | null = null
  mainWindow.on('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      resizeTimer = null
      const p = getState().player
      if (p && !p.destroyed) {
        try { p.notifyLayoutChange() } catch (e) { console.error('[main] notifyLayoutChange:', e) }
      }
    }, 150)
  })
  mainWindow.on('maximize', () => {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('window-maximized', true)
    }
  })
  mainWindow.on('unmaximize', () => {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('window-maximized', false)
    }
  })
  mainWindow.on('enter-full-screen', () => {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('fullscreen-changed', true)
    }
  })
  mainWindow.on('leave-full-screen', () => {
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('fullscreen-changed', false)
    }
  })
  mainWindow.on('closed', () => {
    if (resizeTimer) { clearTimeout(resizeTimer); resizeTimer = null }
  })

  const vlcDir = probeDefaultVlcDir()
  if (!vlcDir) {
    dialog.showErrorBox(t('error.missingVlc'), t('error.missingVlcDesc'))
    return
  }
  state.vlcDir = vlcDir
  process.env.PATH = vlcDir + ';' + process.env.PATH
  initLibVlc(vlcDir)
}

function setupIPC() {
  registerPlaybackIpc()
  registerSettingsIpc()
  registerPlaylistIpc()
  registerPipIpc()
  registerEpgIpc()
  registerWindowIpc()
  registerUpdateIpc()
}

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: blob: https: http:; " +
          "media-src 'self' http: https:; " +
          "connect-src 'self' http://127.0.0.1:* https:; " +
          "frame-src 'none'"
        ]
      }
    })
  })

  setupIPC()
  await createWindow()

  setTimeout(() => {
    backgroundCheck()
  }, 5000)

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow()
  })
})

app.on('window-all-closed', () => {
  const state = getState()
  if (state.pipWindow) {
    if (state.player) { state.player.destroy(); state.player = null }
    if (!state.pipWindow.isDestroyed()) state.pipWindow.close()
    state.pipWindow = null
  }
  if (state.player) { state.player.destroy(); state.player = null }
  if (state.refreshTimer) { clearInterval(state.refreshTimer); state.refreshTimer = null }
  destroyProxy()
  if (process.platform !== 'darwin') app.quit()
})
