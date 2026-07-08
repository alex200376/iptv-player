import { BrowserWindow, app, dialog } from 'electron'
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

let mainWindow: BrowserWindow | null = null
let player: VlcPlayer | null = null

async function createWindow() {
  const iconPath = join(__dirname, '../../build/icon.png')
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 900,
    minHeight: 500,
    title: 'IPTV Player',
    backgroundColor: '#0f0f1a',
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  const state = getState()
  state.mainWindow = mainWindow

  mainWindow.on('resize', () => {
    if (player && !player.destroyed) {
      try { player.notifyLayoutChange() } catch {}
    }
  })

  const vlcDir = probeDefaultVlcDir()
  if (!vlcDir) {
    dialog.showErrorBox('缺少 VLC', '未找到 VLC Media Player，请先安装 VLC 3.0 或更高版本')
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
