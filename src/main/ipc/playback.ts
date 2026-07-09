import { ipcMain } from 'electron'
import { VlcPlayer } from 'electron-vlc-player'
import { readSettings } from '../settingsStore'
import { getState, ensurePlayerEmbedded, ensureEmbedded, buildMediaOptions } from './shared'
import { exitPipMode } from './pip'
import { needsProxy, getProxyUrl, stopProxy } from '../streamProxy'

let _playId = 0

async function doPlay(
  url: string,
  settings: ReturnType<typeof readSettings>,
  currentPlayId: number,
): Promise<{ success: boolean; error?: string }> {
  const mediaOptions = buildMediaOptions(settings)
  const state = getState()

  function attachListeners(player: InstanceType<typeof VlcPlayer>) {
    player.removeAllListeners('error')
    player.removeAllListeners('playing')
    player.removeAllListeners('buffering')

    player.on('error', (...args: unknown[]) => {
      if (currentPlayId !== _playId) return
      console.error('[vlc-error]', url.substring(0, 60), ...args)
      try { console.error('[vlc-state]', state.player?.getState()) } catch {}
      try { console.error('[vlc-hasVout]', state.player?.hasVout()) } catch {}
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('player-error')
      }
    })
    player.on('playing', () => {
      if (currentPlayId !== _playId) return
      console.log('[vlc-playing]', url.substring(0, 60))
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('player-playing')
      }
    })
    player.on('buffering', () => {
      if (currentPlayId !== _playId) return
      console.log('[vlc-buffering]', url.substring(0, 60))
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('player-buffering')
      }
    })
  }

  try {
    if (!state.player) {
      state.player = new VlcPlayer({
        window: state.mainWindow!,
        container: '#player',
        vlcDir: state.vlcDir!,
        locale: 'zh-CN',
        hardwareAcceleration: settings.hardwareAcceleration,
      })
      if (currentPlayId !== _playId) return { success: false }
      await ensurePlayerEmbedded()
      if (currentPlayId !== _playId) return { success: false }
      state.player.showOverlay()
      attachListeners(state.player)
      state.player.setSource(url, { mediaOptions })
      state.player.play()
      state.currentUrl = url
      return { success: true }
    }

    attachListeners(state.player)
    state.player.setSource(url, { mediaOptions })
    state.player.play()
    state.currentUrl = url
    return { success: true }
  } catch (e) {
    console.error('[play] error, rebuilding player:', url, (e as Error).message)

    if (state.player) {
      try { state.player.destroy() } catch {}
      state.player = null
    }

    if (currentPlayId !== _playId) return { success: false }

    try {
      state.player = new VlcPlayer({
        window: state.mainWindow!,
        container: '#player',
        vlcDir: state.vlcDir!,
        locale: 'zh-CN',
        hardwareAcceleration: settings.hardwareAcceleration,
      })

      await ensurePlayerEmbedded()
      if (currentPlayId !== _playId) return { success: false }

      state.player.showOverlay()
      attachListeners(state.player)
      state.player.setSource(url, { mediaOptions })
      state.player.play()
      state.currentUrl = url
      return { success: true }
    } catch (e2) {
      return { success: false, error: (e2 as Error).message }
    }
  }
}

export function registerPlaybackIpc() {
  ipcMain.handle('switch-channel', async (_event, url: string) => {
    const state = getState()
    if (state.pipWindow) {
      await exitPipMode()
    }

    const currentPlayId = ++_playId
    const settings = readSettings()

    // Kill any running proxy/ffmpeg IMMEDIATELY before starting the new stream.
    // This is the key fix: a dead stream's ffmpeg stays alive during its TCP
    // probe timeout unless we force-kill it here, causing the next stream to
    // contend for the same pipe and VLC to lag/freeze.
    stopProxy()

    if (currentPlayId !== _playId) return { success: false }

    let playUrl = url
    if (settings.streamProxy && needsProxy(url)) {
      try {
        playUrl = await getProxyUrl(url, state.vlcDir, settings.proxyResolution)
        console.log('[switch-channel] proxied:', url.substring(0, 60), '->', playUrl)
      } catch (e) {
        console.error('[switch-channel] proxy failed, falling back:', (e as Error).message)
      }
    }

    if (currentPlayId !== _playId) return { success: false }

    state.originalUrl = playUrl !== url ? url : ''
    return doPlay(playUrl, settings, currentPlayId)
  })

  ipcMain.handle('toggle-play', async () => {
    const state = getState()
    if (ensureEmbedded()) state.player!.togglePause()
  })

  ipcMain.handle('set-volume', async (_e, vol: number) => {
    if (ensureEmbedded()) getState().player!.setVolume(vol)
  })

  ipcMain.handle('toggle-mute', async () => {
    if (ensureEmbedded()) {
      const p = getState().player!
      const muted = !p.isMuted()
      p.setMute(muted)
      return muted
    }
    return false
  })

  ipcMain.handle('skip-time', async (_e, seconds: number) => {
    if (ensureEmbedded()) {
      const p = getState().player!
      const current = p.getTime()
      p.setTime(Math.max(0, current + seconds * 1000))
    }
  })

  ipcMain.handle('get-player-time', async () => {
    if (ensureEmbedded()) return getState().player!.getTime()
    return 0
  })

  ipcMain.handle('get-player-duration', async () => {
    if (ensureEmbedded()) return getState().player!.getLength()
    return 0
  })

  ipcMain.handle('set-player-time', async (_e, timeMs: number) => {
    if (ensureEmbedded()) getState().player!.setTime(timeMs)
  })

  ipcMain.handle('hide-player', () => {
    _playId++
    const state = getState()
    if (state.pipWindow) {
      if (state.player) { try { state.player.destroy() } catch {}; state.player = null }
      if (!state.pipWindow.isDestroyed()) state.pipWindow.close()
      state.pipWindow = null
    }
    if (state.player) {
      try { state.player.removeAllListeners() } catch {}
      try { state.player.destroy() } catch {}
      state.player = null
    }
    stopProxy()
  })
}
