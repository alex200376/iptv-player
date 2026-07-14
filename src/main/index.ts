import { BrowserWindow, app, dialog, session, protocol, net } from 'electron'
import { join, resolve, isAbsolute } from 'path'
import { existsSync } from 'fs'
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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
      enableBlinkFeatures: 'CSSContainerQueries',
    },
  })

  mainWindow.setMaxListeners(0)

  app.commandLine.appendSwitch('enable-gpu-rasterization')
  app.commandLine.appendSwitch('enable-zero-copy')
  app.commandLine.appendSwitch('disable-gpu-driver-bug-workarounds')

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const state = getState()
  state.mainWindow = mainWindow

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

  /**
   * FIX(high): Validate and normalise vlcDir before injecting into PATH.
   * Previously an attacker-controlled settings value could inject arbitrary
   * entries into PATH, potentially causing DLL/binary hijacking.
   */
  const safeVlcDir = resolve(vlcDir)
  if (isAbsolute(safeVlcDir) && existsSync(safeVlcDir)) {
    process.env.PATH = safeVlcDir + ';' + (process.env.PATH ?? '')
  } else {
    console.error('[main] vlcDir failed path validation, skipping PATH injection:', vlcDir)
  }

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

  const isDev = !!process.env.ELECTRON_RENDERER_URL
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline'; "
    : "script-src 'self'; "

app.whenReady().then(async () => {
  protocol.handle('logo', (request) => {
    const filename = request.url.slice('logo://'.length)
    const filePath = join(app.getPath('userData'), 'logos', filename)
    return net.fetch('file:///' + filePath.replace(/\\/g, '/'))
  })

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          scriptSrc +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: blob: file: logo: https: http:; " +
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
