import { ipcMain } from 'electron'
import { VlcPlayer } from 'electron-vlc-player'
import { readSettings } from '../settingsStore'
import { getState, ensurePlayerEmbedded, ensureEmbedded, buildMediaOptions } from './shared'
import { exitPipMode } from './pip'
import { needsProxy, getProxyUrl, stopProxy, isFfmpegAvailable } from '../streamProxy'

let _playId = 0
// Tightened to 300 ms: 500 ms felt sluggish when navigating with arrow keys.
// Still long enough to discard duplicate rapid-fire switch requests.
let _lastSwitchTime = 0
const SWITCH_DEBOUNCE_MS = 300

async function doPlay(
  url: string,
  settings: ReturnType<typeof readSettings>,
  currentPlayId: number,
  cacheOverride?: number,
): Promise<{ success: boolean; error?: string }> {
  const effectiveCache = cacheOverride ?? settings.networkCache
  const mediaOptions = buildMediaOptions({ ...settings, networkCache: effectiveCache })
  const state = getState()
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null

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
      if (watchdogTimer) { clearTimeout(watchdogTimer); watchdogTimer = null }
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

  // Destroy existing player BEFORE creating a new one — reusing a VLC player
  // hung on a dead stream with setSource() freezes the app because libVLC's
  // I/O thread is still blocked. Always start fresh.
  if (state.player) {
    try {
      state.player.removeAllListeners()
      state.player.destroy()
    } catch (e) {
      console.error('[playback] destroy player failed:', e)
    }
    // Give libVLC extra time to release GPU surfaces / threads before
    // allocating a new VlcPlayer (avoids race on Windows / dead-stream freeze).
    await new Promise<void>((r) => setTimeout(r, 120))
    if (currentPlayId !== _playId) return { success: false }
  }

  async function createPlayer(): Promise<{ success: boolean; error?: string }> {
    const vlcLocale = settings.language === 'zh-CN' ? 'zh-CN' : 'en'
    state.player = new VlcPlayer({
      window: state.mainWindow!,
      container: '#player',
      vlcDir: state.vlcDir!,
      locale: vlcLocale,
      hardwareAcceleration: settings.hardwareAcceleration,
    })
    if (currentPlayId !== _playId) return { success: false }

    // Wrap embed() in a timeout so a hung libVLC surface negotiation can
    // never block the Electron main process indefinitely.
    await Promise.race([
      Promise.resolve(ensurePlayerEmbedded()),
      new Promise<void>((_res, reject) =>
        setTimeout(() => reject(new Error('embed timeout')), 5000),
      ),
    ]).catch((e) => {
      console.warn('[play] embed timed out or failed:', e?.message)
    })

    if (currentPlayId !== _playId) return { success: false }
    state.player.showOverlay()
    attachListeners(state.player)
    state.player.setSource(url, { mediaOptions })
    state.player.play()
    state.currentUrl = url

    // Watchdog: if playing event doesn't fire within 15s, kill player and report error.
    // This bounds the worst-case freeze to ~15s instead of VLC's default 20-30s.
    watchdogTimer = setTimeout(() => {
      if (currentPlayId !== _playId) return
      console.warn('[play] watchdog: no playing event within 15s, killing player')
      if (state.player) {
        try { state.player.removeAllListeners(); state.player.destroy() } catch (e) { console.error('[playback] watchdog kill failed:', e) }
        state.player = null
      }
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('player-error')
      }
    }, 15000)

    return { success: true }
  }

  try {
    return await createPlayer()
  } catch (e) {
    console.error('[play] error, rebuilding player:', url, (e as Error).message)
    if (state.player) {
      try { state.player.removeAllListeners(); state.player.destroy() } catch (e) { console.error('[playback] rebuild destroy failed:', e) }
      state.player = null
    }
    if (currentPlayId !== _playId) return { success: false }
    try {
      return await createPlayer()
    } catch (e2) {
      return { success: false, error: (e2 as Error).message }
    }
  }
}

export function registerPlaybackIpc() {
  ipcMain.handle('switch-channel', async (_event, url: string) => {
    // Debounce rapid channel switches (e.g. clicking two dead streams quickly)
    // to prevent concurrent VlcPlayer allocations that race on GPU surfaces.
    const now = Date.now()
    if (now - _lastSwitchTime < SWITCH_DEBOUNCE_MS) {
      console.log('[switch-channel] debounced, ignoring rapid switch')
      return { success: false }
    }
    _lastSwitchTime = now

    const state = getState()
    if (state.pipWindow) {
      await exitPipMode()
    }

    const currentPlayId = ++_playId
    const settings = readSettings()

    // Kill any running proxy/ffmpeg IMMEDIATELY before starting the new stream.
    // A dead stream's ffmpeg stays alive during its TCP probe timeout unless
    // we force-kill it here, causing the next stream to contend for the same
    // pipe and VLC to lag/freeze.
    stopProxy()

    if (currentPlayId !== _playId) return { success: false }

    let playUrl = url
    // Non-HTTP streams (RTMP, RTSP, UDP, RTP) are always proxied through ffmpeg
    // when available — VLC cannot reliably handle them natively.
    // HTTP .ts streams are only proxied when the user has enabled streamProxy in
    // settings (they use standard HTTP which VLC can handle directly).
    const isNonHttp = /^rtmp[s]?:\/\/|^rtsp:\/\/|^udp:\/\/|^rtp:\/\//i.test(url)
    if (needsProxy(url) && (isNonHttp || settings.streamProxy)) {
      if (isNonHttp && !(await isFfmpegAvailable(state.vlcDir))) {
        console.warn('[switch-channel] ffmpeg not found, passing RTMP/RTSP directly to VLC')
      } else {
        try {
          playUrl = await getProxyUrl(url, state.vlcDir, settings.proxyResolution)
          console.log('[switch-channel] proxied:', url.substring(0, 60), '->', playUrl)
        } catch (e) {
          console.error('[switch-channel] proxy failed, falling back:', (e as Error).message)
        }
      }
    }

    if (currentPlayId !== _playId) return { success: false }

    // Proxied streams (RTMP, RTSP, UDP, and HTTP .ts) all feed through
    // the local ffmpeg→FLV pipeline — use a low VLC network cache so the
    // player doesn't add an extra buffer on top of ffmpeg's own buffer.
    const isProxied = playUrl.startsWith('http://127.0.0.1')
    state.originalUrl = isProxied ? url : ''
    return doPlay(playUrl, settings, currentPlayId, isProxied ? 150 : undefined)
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
      if (state.player) { try { state.player.destroy() } catch (e) { console.error('[playback] pip destroy:', e) }; state.player = null }
      if (!state.pipWindow.isDestroyed()) state.pipWindow.close()
      state.pipWindow = null
    }
    if (state.player) {
      try { state.player.removeAllListeners() } catch (e) { console.error('[playback] removeAllListeners:', e) }
      try { state.player.destroy() } catch (e) { console.error('[playback] destroy:', e) }
      state.player = null
    }
    stopProxy()
  })
}
