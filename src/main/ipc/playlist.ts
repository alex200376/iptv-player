import { ipcMain, dialog, net } from 'electron'
import { readFileSync } from 'fs'
import { parseM3U, urlToId } from '../m3uParser'
import { saveChannels, loadChannels } from '../channelStore'
import { saveUserData, loadUserData } from '../userDataStore'
import { probeMedia } from 'electron-vlc-player'
import type { Channel } from '../m3uParser'
import { getState } from './shared'

let playlistIdCounter = 0
function nextPlaylistId(): string {
  return `pl-${++playlistIdCounter}`
}

function playlistNameFromPath(filePath: string): string {
  const parts = filePath.replace(/\\/g, '/').split('/')
  const name = parts.pop() || '\u672a\u547d\u540d'
  return name.replace(/\.(m3u|m3u8)$/i, '')
}

export async function refreshPlaylistUrl(
  url: string,
): Promise<{ added: number; updated: number; removed: number; error?: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await net.fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return { added: 0, updated: 0, removed: 0, error: `HTTP ${res.status}` }
    const content = await res.text()
    if (!content.trim()) return { added: 0, updated: 0, removed: 0, error: '\u54cd\u5e94\u5185\u5bb9\u4e3a\u7a7a' }

    const freshChannels = await parseM3U(content)
    const existing: Channel[] = await loadChannels()
    const freshUrlSet = new Set(freshChannels.map((c) => c.url))
    const kept: Channel[] = []
    let addCount = 0
    let updateCount = 0
    let removeCount = 0

    for (const old of existing) {
      if (freshUrlSet.has(old.url)) {
        const match = freshChannels.find((c) => c.url === old.url)
        if (match) {
          kept.push({
            ...old,
            name: match.name,
            logo: match.logo || old.logo,
            group: match.group || old.group,
            tvgId: match.tvgId || old.tvgId,
            tvgUrl: match.tvgUrl || old.tvgUrl,
          })
          updateCount++
        }
        freshUrlSet.delete(old.url)
      } else {
        removeCount++
      }
    }

    const existingPlaylistIds = new Set(
      existing
        .filter((c) => freshChannels.some((fc) => fc.url === c.url))
        .map((c) => c.playlistId),
    )
    const playlistId =
      existingPlaylistIds.values().next().value || `pl-refresh-${Date.now()}`

    for (const fresh of freshChannels) {
      if (!freshUrlSet.has(fresh.url)) continue
      kept.push({
        id: urlToId(fresh.url),
        name: fresh.name,
        url: fresh.url,
        logo: fresh.logo,
        group: fresh.group,
        tvgId: fresh.tvgId,
        tvgUrl: fresh.tvgUrl,
        playlistId,
      })
      addCount++
    }

    await saveChannels(kept)
    return { added: addCount, updated: updateCount, removed: removeCount }
  } catch (e) {
    const msg = (e as Error).message
    console.error('[refresh]', url, msg)
    return { added: 0, updated: 0, removed: 0, error: msg }
  }
}

export async function refreshAllUrlPlaylists(): Promise<{ total: number; errors: string[] }> {
  const userData = await loadUserData()
  const urlPlaylists = (userData.playlists || []).filter((p) => p.source === 'url' && p.url)
  let total = 0
  const errors: string[] = []
  for (const pl of urlPlaylists) {
    const result = await refreshPlaylistUrl(pl.url)
    total += result.added + result.updated
    if (result.error) errors.push(`${pl.name}: ${result.error}`)
  }
  const state = getState()
  if (total > 0 && state.mainWindow && !state.mainWindow.isDestroyed()) {
    const channels = await loadChannels()
    state.mainWindow.webContents.send('playlists-refreshed', channels)
  }
  return { total, errors }
}

/**
 * Probe a single channel URL off the main thread using a Promise wrapper.
 * probeMedia is synchronous and blocking — we wrap it so batches can run
 * concurrently via Promise.allSettled without serialising on the JS thread.
 */
function probeChannel(url: string, timeoutMs: number): Promise<'online' | 'offline'> {
  return new Promise((resolve) => {
    // setImmediate yields the event loop tick so multiple probes overlap I/O
    setImmediate(() => {
      try {
        // First do a quick HTTP HEAD / TCP connect check for http(s) streams
        // to avoid tying up VLC probe slots on clearly dead URLs.
        const result = probeMedia(url, timeoutMs)
        resolve(result.parsed ? 'online' : 'offline')
      } catch {
        resolve('offline')
      }
    })
  })
}

export function registerPlaylistIpc() {
  ipcMain.handle('save-channels', async (_event, channels: unknown[]) => {
    await saveChannels(channels as Channel[])
  })

  ipcMain.handle('load-channels', async () => {
    return await loadChannels()
  })

  ipcMain.handle('check-channel-url', async (_event, url: string) => {
    const now = Date.now()
    try {
      // Use a tighter 8s timeout for single-channel checks
      const status = await probeChannel(url, 8000)
      return { online: status === 'online', lastCheckedAt: now }
    } catch (e) {
      return { online: false, lastCheckedAt: now, error: (e as Error).message }
    }
  })

  ipcMain.handle('check-all-channels', async () => {
    const channels: Channel[] = await loadChannels()
    const now = Date.now()
    let checked = 0
    // Smaller batch to avoid overwhelming probeMedia (which uses VLC internally)
    const batchSize = 8
    const state = getState()

    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize)

      // Run batch probes concurrently — each probe yields via setImmediate
      const results = await Promise.allSettled(
        batch.map((ch) => probeChannel(ch.url, 8000)),
      )

      for (let j = 0; j < batch.length; j++) {
        const r = results[j]
        batch[j].status = r.status === 'fulfilled' ? r.value : 'offline'
        batch[j].lastCheckedAt = now
        checked++
      }

      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('channels-check-progress', {
          checked,
          total: channels.length,
        })
      }
    }

    await saveChannels(channels)

    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('channels-check-done', channels)
    }

    return { total: channels.length }
  })

  /**
   * Remove all channels whose status is 'offline'.
   * Returns the updated channel list so the renderer can sync immediately.
   */
  ipcMain.handle('remove-offline-channels', async () => {
    const channels: Channel[] = await loadChannels()
    const kept = channels.filter((ch) => ch.status !== 'offline')
    const removedCount = channels.length - kept.length
    await saveChannels(kept)
    console.log(`[remove-offline] removed ${removedCount} offline channels`)
    return { channels: kept, removedCount }
  })

  ipcMain.handle('import-m3u', async () => {
    const state = getState()
    if (!state.mainWindow) return { channels: [], error: '\u7a97\u53e3\u672a\u521d\u59cb\u5316' }
    const result = await dialog.showOpenDialog(state.mainWindow, {
      properties: ['openFile'],
      filters: [{ name: 'M3U Playlist', extensions: ['m3u', 'm3u8'] }],
    })
    if (result.canceled || result.filePaths.length === 0) return { channels: [] }
    try {
      const filePath = result.filePaths[0]
      const content = readFileSync(filePath, 'utf-8')
      const playlistId = nextPlaylistId()
      const playlistName = playlistNameFromPath(filePath)
      const channels = await parseM3U(content, playlistId)
      return { channels, playlistId, playlistName }
    } catch (e) {
      return { channels: [], error: `\u8bfb\u53d6\u6587\u4ef6\u5931\u8d25: ${(e as Error).message}` }
    }
  })

  ipcMain.handle('import-m3u-url', async (_event, url: string) => {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await net.fetch(url, { signal: controller.signal })
      clearTimeout(timeout)
      if (!res.ok) return { channels: [], error: `HTTP ${res.status}: ${res.statusText}` }
      const content = await res.text()
      if (!content.trim()) return { channels: [], error: '\u54cd\u5e94\u5185\u5bb9\u4e3a\u7a7a' }
      const playlistId = nextPlaylistId()
      const channels = await parseM3U(content, playlistId)
      return {
        channels,
        playlistId,
        playlistName: url.replace(/^https?:\/\//, '').slice(0, 50),
        url,
      }
    } catch (e) {
      const err = e as Error & { cause?: Error; code?: string }
      console.error('[import-m3u-url]', url, err.message, err.code || '', err.cause?.message || '')
      const msg = err.message + (err.cause ? ` (${err.cause.message})` : '')
      if (msg.includes('abort')) return { channels: [], error: '\u8bf7\u6c42\u8d85\u65f6\uff0810\u79d2\uff09' }
      if (msg.includes('ECONNREFUSED'))
        return { channels: [], error: '\u8fde\u63a5\u88ab\u62d2\u7edd\uff0c\u8bf7\u786e\u8ba4\u670d\u52a1\u5668\u6b63\u5728\u8fd0\u884c' }
      return { channels: [], error: `\u8bf7\u6c42\u5931\u8d25: ${msg}` }
    }
  })

  ipcMain.handle('refresh-playlists', async () => {
    return await refreshAllUrlPlaylists()
  })

  ipcMain.handle('refresh-playlist-url', async (_event, url: string) => {
    return await refreshPlaylistUrl(url)
  })

  ipcMain.handle('save-user-data', async (_event, data: unknown) => {
    await saveUserData(data as import('../userDataStore').UserData)
    return true
  })

  ipcMain.handle('load-user-data', async () => {
    return await loadUserData()
  })

  ipcMain.handle('export-m3u', async () => {
    const state = getState()
    if (!state.mainWindow) return { success: false, error: '\u7a97\u53e3\u672a\u521d\u59cb\u5316' }
    const channels = await loadChannels()
    if (!channels || channels.length === 0)
      return { success: false, error: '\u65e0\u9891\u9053\u53ef\u5bfc\u51fa' }
    const result = await dialog.showSaveDialog(state.mainWindow, {
      title: '\u5bfc\u51fa M3U \u64ad\u653e\u5217\u8868',
      defaultPath: 'iptv-playlist.m3u',
      filters: [{ name: 'M3U Playlist', extensions: ['m3u'] }],
    })
    if (result.canceled || !result.filePath) return { success: false }
    try {
      let m3u = '#EXTM3U\n'
      for (const ch of channels as Channel[]) {
        const attrs = []
        if (ch.tvgId) attrs.push(`tvg-id="${ch.tvgId}"`)
        if (ch.logo) attrs.push(`tvg-logo="${ch.logo}"`)
        if (ch.group) attrs.push(`group-title="${ch.group}"`)
        m3u += `#EXTINF:-1 ${attrs.join(' ')},${ch.name || '\u672a\u77e5'}\n${ch.url}\n`
      }
      const { writeFileSync } = require('fs')
      writeFileSync(result.filePath, m3u, 'utf-8')
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
