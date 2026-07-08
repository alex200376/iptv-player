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
  const name = parts.pop() || '未命名'
  return name.replace(/\.(m3u|m3u8)$/i, '')
}

export async function refreshPlaylistUrl(url: string): Promise<{ added: number; updated: number; removed: number; error?: string }> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await net.fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return { added: 0, updated: 0, removed: 0, error: `HTTP ${res.status}` }
    const content = await res.text()
    if (!content.trim()) return { added: 0, updated: 0, removed: 0, error: '响应内容为空' }

    const freshChannels = parseM3U(content)
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
      existing.filter((c) => freshChannels.some((fc) => fc.url === c.url)).map((c) => c.playlistId),
    )
    const playlistId = existingPlaylistIds.values().next().value || `pl-refresh-${Date.now()}`

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
      const result = probeMedia(url, 6000)
      return { online: result.parsed, length: result.length, lastCheckedAt: now }
    } catch (e) {
      return { online: false, lastCheckedAt: now, error: (e as Error).message }
    }
  })

  ipcMain.handle('check-all-channels', async () => {
    const channels: Channel[] = await loadChannels()
    const now = Date.now()
    let checked = 0

    async function checkOne(ch: Channel): Promise<string> {
      const result = probeMedia(ch.url, 6000)
      return result.parsed ? 'online' : 'offline'
    }

    const batchSize = 15
    const state = getState()
    for (let i = 0; i < channels.length; i += batchSize) {
      const batch = channels.slice(i, i + batchSize)
      const results = await Promise.allSettled(batch.map((ch) => checkOne(ch)))
      for (let j = 0; j < batch.length; j++) {
        batch[j].status = results[j].status === 'fulfilled' ? results[j].value : 'offline'
        batch[j].lastCheckedAt = now
        checked++
      }
      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('channels-check-progress', { checked, total: channels.length })
      }
    }

    await saveChannels(channels)
    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('channels-check-done', channels)
    }
    return { total: channels.length }
  })

  ipcMain.handle('import-m3u', async () => {
    const state = getState()
    if (!state.mainWindow) return { channels: [], error: '窗口未初始化' }
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
      return { channels: parseM3U(content, playlistId), playlistId, playlistName }
    } catch (e) {
      return { channels: [], error: `读取文件失败: ${(e as Error).message}` }
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
      if (!content.trim()) return { channels: [], error: '响应内容为空' }
      const playlistId = nextPlaylistId()
      return { channels: parseM3U(content, playlistId), playlistId, playlistName: url.replace(/^https?:\/\//, '').slice(0, 50), url }
    } catch (e) {
      const err = e as Error & { cause?: Error; code?: string }
      console.error('[import-m3u-url]', url, err.message, err.code || '', err.cause?.message || '')
      const msg = err.message + (err.cause ? ` (${err.cause.message})` : '')
      if (msg.includes('abort')) return { channels: [], error: '请求超时（10秒）' }
      if (msg.includes('ECONNREFUSED')) return { channels: [], error: '连接被拒绝，请确认服务器正在运行' }
      return { channels: [], error: `请求失败: ${msg}` }
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
    if (!state.mainWindow) return { success: false, error: '窗口未初始化' }
    const channels = await loadChannels()
    if (!channels || channels.length === 0) return { success: false, error: '无频道可导出' }
    const result = await dialog.showSaveDialog(state.mainWindow, {
      title: '导出 M3U 播放列表',
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
        m3u += `#EXTINF:-1 ${attrs.join(' ')},${ch.name || '未知'}\n${ch.url}\n`
      }
      const { writeFileSync } = require('fs')
      writeFileSync(result.filePath, m3u, 'utf-8')
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
