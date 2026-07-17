import { ipcMain } from 'electron'
import { VlcPlayer, getBinding } from 'electron-vlc-player'
import { readSettings } from '../settingsStore'
import { getState, buildMediaOptions } from './shared'
import { createPipWindow, getPipHtml, positionPipBottomRight } from '../pipManager'
import { needsProxy, getProxyUrl, stopProxy, isFfmpegAvailable } from '../streamProxy'

async function enterPipMode() {
  const state = getState()
  if (!state.player || !state.mainWindow || !state.currentUrl) return
  const settings = readSettings()

  let pipUrl = state.currentUrl
  if (state.originalUrl && await isFfmpegAvailable(state.vlcDir)) {
    try {
      pipUrl = await getProxyUrl(state.originalUrl, state.vlcDir, settings.proxyResolution)
    } catch (e) {
      console.error('[pip] proxy failed, using original URL:', e)
    }
  }
  const wasPlaying = state.player.isPlaying()
  const savedVolume = state.player.getVolume()
  const savedTime = state.player.getTime()
  const savedMuted = getBinding().getMute(state.player.playerId)

  state.player.removeAllListeners()
  state.player.destroy()
  state.player = null

  state.pipWindow = createPipWindow(state.vlcDir!)
  await state.pipWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(getPipHtml()))
  positionPipBottomRight(state.pipWindow)

  state.player = new VlcPlayer({
    window: state.pipWindow,
    container: '#player',
    vlcDir: state.vlcDir!,
    locale: 'zh-CN',
    hardwareAcceleration: settings.hardwareAcceleration,
  })
  await state.player.embed()
  state.player.hideOverlay()
  state.player.removeAllListeners('error')
  state.player.removeAllListeners('playing')
  state.player.removeAllListeners('buffering')
  state.player.on('error', (...args) => {
    console.error('[pip-vlc-error]', pipUrl.substring(0, 60), ...args)
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('player-error')
    }
  })
  state.player.on('playing', () => {
    console.log('[pip-vlc-playing]', pipUrl.substring(0, 60))
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('player-playing')
    }
  })
  state.player.on('buffering', () => {
    console.log('[pip-vlc-buffering]', pipUrl.substring(0, 60))
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('player-buffering')
    }
  })
  state.player.setVolume(savedVolume)
  state.player.setMute(savedMuted)
  const pipIsProxied = pipUrl.startsWith('http://127.0.0.1')
  const pipEffectiveCache = pipIsProxied ? 150 : settings.networkCache
  state.player.setSource(pipUrl, { mediaOptions: buildMediaOptions({ ...settings, networkCache: pipEffectiveCache }) })
  state.player.play()
  if (savedTime > 0 && wasPlaying) state.player.setTime(savedTime)

  state.pipWindow.on('resize', () => {
    const s = getState()
    if (!s.player || !s.pipWindow || s.pipWindow.isDestroyed()) return
    try { s.player.notifyLayoutChange() } catch (e) { console.error('[pip] notifyLayoutChange:', e) }
  })

  state.pipWindow.on('closed', () => {
    const s = getState()
    s.pipWindow = null
    if (s.mainWindow && !s.mainWindow.isDestroyed()) {
      s.mainWindow.webContents.send('pip-state-changed', false)
    }
  })

  state.mainWindow.webContents.send('pip-state-changed', true)
}

export async function exitPipMode() {
  const state = getState()
  if (!state.pipWindow || state.pipWindow.isDestroyed() || !state.player || !state.mainWindow) return
  const settings = readSettings()
  const savedVolume = state.player.getVolume()
  const savedTime = state.player.getTime()
  const savedMuted = getBinding().getMute(state.player.playerId)

  state.player.removeAllListeners()
  state.player.destroy()
  state.player = null

  if (!state.pipWindow.isDestroyed()) state.pipWindow.close()
  state.pipWindow = null

  let playUrl = state.currentUrl
  if (state.originalUrl && await isFfmpegAvailable(state.vlcDir)) {
    try {
      playUrl = await getProxyUrl(state.originalUrl, state.vlcDir, settings.proxyResolution)
    } catch (e) {
      console.error('[pip] exit proxy failed:', e)
    }
  }

  state.player = new VlcPlayer({
    window: state.mainWindow,
    container: '#player',
    vlcDir: state.vlcDir!,
    locale: 'zh-CN',
    hardwareAcceleration: settings.hardwareAcceleration,
  })
  await state.player.embed()
  state.player.showOverlay()
  state.player.setVolume(savedVolume)
  state.player.setMute(savedMuted)
  if (playUrl) {
    const exitIsProxied = playUrl.startsWith('http://127.0.0.1')
    const exitEffectiveCache = exitIsProxied ? 150 : settings.networkCache
    state.player.setSource(playUrl, { mediaOptions: buildMediaOptions({ ...settings, networkCache: exitEffectiveCache }) })
    state.player.play()
    if (savedTime > 0) state.player.setTime(savedTime)
  }

  state.mainWindow.webContents.send('pip-state-changed', false)
}

export async function reloadPipSource() {
  const state = getState()
  if (!state.pipWindow || state.pipWindow.isDestroyed() || !state.player || !state.mainWindow) return

  stopProxy('pip')
  await new Promise<void>((r) => setTimeout(r, 100))

  const settings = readSettings()
  let playUrl = state.currentUrl
  if (state.originalUrl && await isFfmpegAvailable(state.vlcDir)) {
    try {
      playUrl = await getProxyUrl(state.originalUrl, state.vlcDir, settings.proxyResolution, 'pip')
    } catch (e) {
      console.error('[pip] reload proxy failed:', e)
    }
  }

  const isProxied = playUrl.startsWith('http://127.0.0.1')
  const effectiveCache = isProxied ? 150 : settings.networkCache
  const mediaOptions = buildMediaOptions({ ...settings, networkCache: effectiveCache })

  console.log('[pip] reloading source:', playUrl?.substring(0, 60))

  const savedBounds = state.pipWindow.getBounds()

  state.player.removeAllListeners()
  state.player.destroy()
  state.player = null

  await new Promise<void>((r) => setTimeout(r, 120))

  state.player = new VlcPlayer({
    window: state.pipWindow,
    container: '#player',
    vlcDir: state.vlcDir!,
    locale: 'zh-CN',
    hardwareAcceleration: settings.hardwareAcceleration,
  })
  await state.player.embed()
  state.player.hideOverlay()
  state.player.removeAllListeners('error')
  state.player.removeAllListeners('playing')
  state.player.removeAllListeners('buffering')
  state.player.on('error', (...args) => {
    console.error('[pip-vlc-error]', playUrl?.substring(0, 60), ...args)
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('player-error')
    }
  })
  state.player.on('playing', () => {
    console.log('[pip-vlc-playing]', playUrl?.substring(0, 60))
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('player-playing')
    }
  })
  state.player.on('buffering', () => {
    console.log('[pip-vlc-buffering]', playUrl?.substring(0, 60))
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('player-buffering')
    }
  })
  state.player.setSource(playUrl, { mediaOptions })
  state.player.play()

  if (!state.pipWindow.isDestroyed()) {
    state.pipWindow.setBounds(savedBounds)
    try { state.player.notifyLayoutChange() } catch (e) { console.error('[pip] notifyLayoutChange after reload:', e) }
  }
}

export function registerPipIpc() {
  ipcMain.handle('toggle-pip', async () => {
    const state = getState()
    if (state.pipWindow && !state.pipWindow.isDestroyed()) {
      await exitPipMode()
      return { active: false }
    }
    await enterPipMode()
    return { active: true }
  })

  ipcMain.handle('exit-pip', async () => {
    await exitPipMode()
  })

  ipcMain.handle('pip-reload-source', async () => {
    await reloadPipSource()
  })

  ipcMain.handle('pip-move-by', (_event, dx: number, dy: number) => {
    const state = getState()
    if (!state.pipWindow || state.pipWindow.isDestroyed()) return
    const [x, y] = state.pipWindow.getPosition()
    state.pipWindow.setPosition(x + dx, y + dy)
  })

  ipcMain.handle('pip-get-playback-state', () => {
    const state = getState()
    if (!state.player) return { playing: false, muted: false, volume: 0 }
    try {
      return {
        playing: state.player.isPlaying(),
        muted: getBinding().getMute(state.player.playerId),
        volume: state.player.getVolume(),
      }
    } catch {
      return { playing: false, muted: false, volume: 0 }
    }
  })
}
