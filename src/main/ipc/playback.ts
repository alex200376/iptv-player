import { ipcMain, BrowserWindow } from 'electron'
import { VlcPlayer } from 'electron-vlc-player'
import { readSettings } from '../settingsStore'
import { getState, ensurePlayerEmbedded, ensureEmbedded, buildMediaOptions } from './shared'
import { exitPipMode } from './pip'
import { needsProxy, getProxyUrl, stopProxy, isFfmpegAvailable } from '../streamProxy'
import { probeChannel } from './playlist'

let _playId = 0
let _lastSwitchTime = 0
const SWITCH_DEBOUNCE_MS = 300
const DEAD_STREAM_TIMEOUT_MS = 10000
const VERIFY_GRACE_MS = 15000
const AUTO_VERIFY_FIRST_MS = 120000
const AUTO_VERIFY_INTERVAL_MS = 300000
const _deadTimers = new Map<number, ReturnType<typeof setTimeout>>()
const _verifyIntervals = new Map<number, ReturnType<typeof setInterval>>()

function clearDeadTimer(playId: number) {
  const t = _deadTimers.get(playId)
  if (t) { clearTimeout(t); _deadTimers.delete(playId) }
}

function clearVerifyInterval(playId: number) {
  const i = _verifyIntervals.get(playId)
  if (i) { clearInterval(i); _verifyIntervals.delete(playId) }
}

/** States where stop() is guaranteed non-blocking */
const SAFE_STATES = new Set([0, 3, 4, 5, 6, 7])

export async function checkSingleChannel(
  url: string,
): Promise<{ online: boolean; error?: string }> {
  const settings = readSettings()
  const mediaOptions = buildMediaOptions({ ...settings, networkCache: Math.max(settings.networkCache, 800) })
  const checkOptions = [...mediaOptions, ':aout=null', ':volume=0']
  const vlcLocale = settings.language === 'zh-CN' ? 'zh-CN' : 'en'
  const s = getState()
  if (!s.vlcDir) return { online: false, error: 'VLC not initialized' }

  const checkWin = new BrowserWindow({
    show: false,
    width: 320,
    height: 240,
    frame: false,
    webPreferences: { sandbox: false },
  })

  await checkWin.loadURL(
    'data:text/html,<!DOCTYPE html><html><body><div id="check-player"></div></body></html>',
  )

  const checkPlayer = new VlcPlayer({
    window: checkWin,
    container: '#check-player',
    vlcDir: s.vlcDir,
    locale: vlcLocale,
    hardwareAcceleration: settings.hardwareAcceleration,
  })

  const embedTimedOut = await Promise.race([
    Promise.resolve(checkPlayer.embed?.()).then(() => false).catch(() => true),
    new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 5000)),
  ])

  if (embedTimedOut) {
    try { checkPlayer.destroy() } catch {}
    try { if (!checkWin.isDestroyed()) checkWin.destroy() } catch {}
    return { online: false, error: 'embed timeout' }
  }

  let playingFired = false
  let rebuffered = false

  checkPlayer.on('playing', () => { playingFired = true; try { checkPlayer.setVolume(0) } catch {} })
  checkPlayer.on('buffering', () => { if (playingFired) rebuffered = true })
  checkPlayer.on('error', () => { /* handled by timeout */ })

  checkPlayer.setSource(url, { mediaOptions: checkOptions })
  checkPlayer.play()

  return new Promise<{ online: boolean; error?: string }>((resolve) => {
    let settled = false
    let stage2: ReturnType<typeof setTimeout> | undefined

    const cleanup = () => {
      try { checkPlayer.removeAllListeners() } catch {}
      try { checkPlayer.destroy() } catch {}
      try { if (!checkWin.isDestroyed()) checkWin.destroy() } catch {}
    }

    const settle = (online: boolean, error?: string) => {
      if (settled) return
      settled = true
      clearTimeout(stage2)
      cleanup()
      resolve({ online, error })
    }

    // Stage 1 — 10s: probe + playingFired + initial hasVout
    setTimeout(async () => {
      if (settled) return

      let probeOnline = false
      try { const { result } = await probeChannel(url); probeOnline = result === 'online' } catch {}

      if (!probeOnline) return settle(false, 'stream unreachable')
      if (!playingFired) return settle(false, 'VLC did not start')

      let vout = 0
      try { vout = checkPlayer.hasVout?.() ?? 0 } catch {}
      if (vout > 0) return settle(true)

      // Stage 2 — 15s grace: wait for hasVout
      stage2 = setTimeout(() => {
        if (settled) return
        if (rebuffered) return settle(true)
        try { vout = checkPlayer.hasVout?.() ?? 0 } catch {}
        settle(vout > 0, vout > 0 ? undefined : 'no video output')
      }, VERIFY_GRACE_MS)
    }, DEAD_STREAM_TIMEOUT_MS)
  })
}

/**
 * Abandon a VlcPlayer, destroying it only when safe.
 *
 * `libvlc_media_player_stop()` blocks on stuck network I/O (Opening/Buffering).
 * For safe states (Playing/Paused/terminal) stop() returns instantly.
 *
 * CRITICAL: getState() is safe (reads a field, no mutex).  setVolume/setPaused
 * use `var_Set` which acquires the player mutex — NEVER call them on a stuck
 * player or the main process blocks.
 */
function abandonPlayer(player: InstanceType<typeof VlcPlayer> | null) {
  if (!player || player.destroyed) return
  try { player.removeAllListeners() } catch { /* ignore */ }

  let state = -1
  try { state = player.getState() } catch { /* not embedded */ }

  const stuck = state === 1 || state === 2
  const notEmbedded = state === -1

  if (stuck) {
    try { player.unloadMedia() } catch { /* ignore */ }
    setTimeout(() => {
      try {
        if (player.destroyed) return
        player.destroy()
      } catch { /* ignore */ }
    }, 2000)
    return
  }

  if (notEmbedded) return

  if (SAFE_STATES.has(state)) {
    try { player.destroy() } catch (e) { console.error('[playback] destroy failed:', e) }
  } else {
    try { player.unloadMedia() } catch { /* ignore */ }
    setTimeout(() => {
      try {
        if (player.destroyed) return
        const s = player.getState()
        if (SAFE_STATES.has(s)) player.destroy()
      } catch { /* ignore */ }
    }, 2000)
  }
}

async function createNewPlayer(
  url: string,
  settings: ReturnType<typeof readSettings>,
  currentPlayId: number,
  mediaOptions: string[],
): Promise<{ success: boolean; error?: string }> {
  const state = getState()
  const vlcLocale = settings.language === 'zh-CN' ? 'zh-CN' : 'en'
  state.player = new VlcPlayer({
    window: state.mainWindow!,
    container: '#player',
    vlcDir: state.vlcDir!,
    locale: vlcLocale,
    hardwareAcceleration: settings.hardwareAcceleration,
  })
  if (currentPlayId !== _playId) {
    abandonPlayer(state.player)
    state.player = null
    return { success: false }
  }

  const embedTimedOut = await Promise.race([
    Promise.resolve(ensurePlayerEmbedded()).then(() => false),
    new Promise<boolean>((resolve) =>
      setTimeout(() => resolve(true), 5000),
    ),
  ]).catch(() => true)

  if (embedTimedOut) {
    console.warn('[playback] embed timed out')
    try { state.player?.removeAllListeners() } catch {}
    setImmediate(() => {
      try { state.player?.destroy() } catch (e) { console.error('[playback] destroy new player:', e) }
    })
    state.player = null
    return { success: false, error: 'embed timeout' }
  }

  if (currentPlayId !== _playId) {
    abandonPlayer(state.player)
    state.player = null
    return { success: false }
  }

  let playingFired = false

  function attachListeners() {
    state.player!.removeAllListeners('error')
    state.player!.removeAllListeners('playing')
    state.player!.removeAllListeners('buffering')

    state.player!.on('error', (...args: unknown[]) => {
      if (currentPlayId !== _playId) return
      console.error('[vlc-error]', url.substring(0, 60), ...args)
      try { console.error('[vlc-state]', state.player?.getState()) } catch {}
      try { console.error('[vlc-hasVout]', state.player?.hasVout()) } catch {}
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('player-error')
      }
    })
    state.player!.on('playing', () => {
      if (currentPlayId !== _playId) return
      playingFired = true
      console.log('[vlc-playing]', url.substring(0, 60))
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('player-playing')
      }
    })
    state.player!.on('buffering', () => {
      if (currentPlayId !== _playId) return
      if (playingFired) clearDeadTimer(currentPlayId)
      console.log('[vlc-buffering]', url.substring(0, 60))
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('player-buffering')
      }
    })
  }

  attachListeners()
  state.player.showOverlay()
  state.player.setSource(url, { mediaOptions })
  state.player.play()
  state.currentUrl = url

  clearDeadTimer(currentPlayId)
  _deadTimers.set(currentPlayId, setTimeout(async () => {
    if (currentPlayId !== _playId) return
    console.log('[dead-stream] 10s elapsed, probing...', url.substring(0, 60))

    const probeUrl = state.originalUrl || url
    let probeOnline = false
    try {
      const { result } = await probeChannel(probeUrl)
      probeOnline = result === 'online'
    } catch (e) {
      console.warn('[dead-stream] probe failed:', (e as Error).message)
    }

    if (!probeOnline) {
      console.log('[dead-stream] probe offline — removing')
      if (state.mainWindow && !state.mainWindow.isDestroyed())
        state.mainWindow.webContents.send('player-dead', url)
      return
    }

    if (!playingFired) {
      console.log('[dead-stream] probe online but VLC not playing yet — keeping')
      return
    }

    // Playing fired but stream may still be dead (no video output)
    if (currentPlayId !== _playId) return
    try {
      const vout = state.player?.hasVout() ?? 0
      if (vout > 0) {
        console.log('[dead-stream] hasVout =', vout, '— alive')
        // Schedule periodic auto-verify while playing
        clearVerifyInterval(currentPlayId)
        const startInterval = () => {
          _verifyIntervals.set(currentPlayId, setInterval(async () => {
            if (currentPlayId !== _playId) { clearVerifyInterval(currentPlayId); return }
            console.log('[auto-verify] probing', probeUrl.substring(0, 60))
            try {
              const { result } = await probeChannel(probeUrl)
              if (result === 'offline') {
                console.log('[auto-verify] offline — notifying', probeUrl.substring(0, 60))
                if (state.mainWindow && !state.mainWindow.isDestroyed())
                  state.mainWindow.webContents.send('player-dead-notify', url)
              }
            } catch (e) {
              console.warn('[auto-verify] probe failed:', (e as Error).message)
            }
          }, AUTO_VERIFY_INTERVAL_MS))
        }
        // First check after AUTO_VERIFY_FIRST_MS (2 min), then every AUTO_VERIFY_INTERVAL_MS (5 min)
        setTimeout(startInterval, AUTO_VERIFY_FIRST_MS)
        return
      }
      console.log('[dead-stream] playing fired but hasVout = 0 — dead')
    } catch {
      console.warn('[dead-stream] hasVout check failed')
    }

    if (state.mainWindow && !state.mainWindow.isDestroyed())
      state.mainWindow.webContents.send('player-dead', url)
  }, DEAD_STREAM_TIMEOUT_MS))

  return { success: true }
}

async function doPlay(
  url: string,
  settings: ReturnType<typeof readSettings>,
  currentPlayId: number,
  cacheOverride?: number,
): Promise<{ success: boolean; error?: string }> {
  const effectiveCache = cacheOverride ?? settings.networkCache
  const mediaOptions = buildMediaOptions({ ...settings, networkCache: effectiveCache })
  const state = getState()

  if (state.player && !state.player.destroyed) {
    abandonPlayer(state.player)
  }
  state.player = null

  try {
    return await createNewPlayer(url, settings, currentPlayId, mediaOptions)
  } catch (e) {
    console.error('[playback] createNewPlayer error:', url, (e as Error).message)
    abandonPlayer(state.player)
    state.player = null
    if (currentPlayId !== _playId) return { success: false }
    try {
      return await createNewPlayer(url, settings, currentPlayId, mediaOptions)
    } catch (e2) {
      return { success: false, error: (e2 as Error).message }
    }
  }
}

export function registerPlaybackIpc() {
  ipcMain.handle('switch-channel', async (_event, url: string) => {
    const now = Date.now()
    if (now - _lastSwitchTime < SWITCH_DEBOUNCE_MS) {
      console.log('[switch-channel] debounced, ignoring rapid switch')
      return { success: false }
    }
    _lastSwitchTime = now
    _verifyIntervals.forEach((i) => clearInterval(i))
    _verifyIntervals.clear()

    const state = getState()
    if (state.pipWindow) {
      await exitPipMode()
    }

    const currentPlayId = ++_playId
    const settings = readSettings()

    const isSameUrl = state.currentUrl === url || state.originalUrl === url
    if (!isSameUrl) {
      stopProxy()
    }

    if (currentPlayId !== _playId) return { success: false }

    let playUrl = url
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
    _deadTimers.forEach((t) => clearTimeout(t))
    _deadTimers.clear()
    _verifyIntervals.forEach((i) => clearInterval(i))
    _verifyIntervals.clear()
    const state = getState()
    if (state.pipWindow) {
      abandonPlayer(state.player)
      state.player = null
      if (!state.pipWindow.isDestroyed()) state.pipWindow.close()
      state.pipWindow = null
    }
    abandonPlayer(state.player)
    state.player = null
    stopProxy()
  })
}
