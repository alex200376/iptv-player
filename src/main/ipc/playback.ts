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

  // Same-URL reload optimisation: reuse the existing VlcPlayer instead of
  // destroy→recreate. This avoids libVLC GPU surface renegotiation which is
  // the root cause of the window auto-resize and black-screen flash.
  // Only applies when the stream is in a healthy Playing state — for stuck
  // streams (repeated buffering without playing), setSource() calls
  // libvlc_media_player_stop() internally which blocks the main process.
  if (state.player && !state.player.destroyed && state.currentUrl === url) {
    const healthy = (state.player as any).isPlaying?.() ?? false
    if (!healthy) {
      console.log('[playback] same-url reload skipped — player stuck, using two-player swap')
    } else {
      try {
        console.log('[playback] same-url reload — reusing player, skipping destroy')
        attachListeners(state.player)
        state.player.setSource(url, { mediaOptions })
        state.player.play()
        return { success: true }
      } catch (e) {
        console.warn('[playback] same-url reuse failed, falling back to recreate:', (e as Error).message)
      }
    }
  }

  // Destroy old player before creating the new one.
  if (state.player) {
    try {
      state.player.removeAllListeners()
      state.player.destroy()
    } catch (e) {
      console.error('[playback] destroy player failed:', e)
    } finally {
      state.player = null
    }
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
    const embedTimedOut = await Promise.race([
      Promise.resolve(ensurePlayerEmbedded()).then(() => false),
      new Promise<boolean>((resolve) =>
        setTimeout(() => resolve(true), 5000),
      ),
    ]).catch(() => true)

    if (embedTimedOut) {
      console.warn('[play] embed timed out — destroying player')
      if (state.player) {
        try { state.player.destroy() } catch (e) { console.error('[playback] embed timeout destroy:', e) }
        state.player = null
      }
      return { success: false, error: 'embed timeout' }
    }

    if (currentPlayId !== _playId) return { success: false }
    state.player.showOverlay()
    attachListeners(state.player)
    state.player.setSource(url, { mediaOptions })
    state.player.play()
    state.currentUrl = url

    return { success: true }
  }

  try {
    return await createPlayer()
  } catch (e) {
    console.error('[play] error, rebuilding player:', url, (e as Error).message)
    if (state.player) {
      try { (state.player as any).removeAllListeners(); (state.player as any).destroy() } catch (e) { console.error('[playback] rebuild destroy failed:', e) }
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
    // Skip proxy kill when reloading the same URL — terminating ffmpeg mid-stream
    // would cause a brief drop even on a healthy stream.
    const isSameUrl = state.currentUrl === url || state.originalUrl === url
    if (!isSameUrl) {
      stopProxy()
    }

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
      const muted = !(p as any).isMuted()
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
