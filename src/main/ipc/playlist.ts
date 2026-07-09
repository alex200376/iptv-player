import { ipcMain, dialog, net } from 'electron'
import { createConnection } from 'net'
import { readFileSync } from 'fs'
import { parseM3U, urlToId } from '../m3uParser'
import { saveChannels, loadChannels } from '../channelStore'
import { saveUserData, loadUserData } from '../userDataStore'
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

// ── Cancellation token ───────────────────────────────────────────────
let _checkCancelToken = 0

// ── Types ────────────────────────────────────────────────────────────
type ProbeResult = 'online' | 'offline' | 'unknown'

type ProtocolType = 'hls' | 'http' | 'm3u' | 'ts' | 'rtmp' | 'rtsp' | 'udp' | 'unknown'

// ── Protocol detection ───────────────────────────────────────────────
/**
 * Detect whether an HTTP(S) URL is a raw MPEG-TS stream.
 * Must stay in sync with isHttpTsStream() in streamProxy.ts.
 */
function isHttpTsUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    if (/\.ts$/.test(path)) return true
    if (/\/(live|stream|play|channel|video)\.ts/.test(path)) return true
    if (u.searchParams.has('channelId')) return true
  } catch {
    // malformed URL — fall through
  }
  return false
}

function detectProtocol(url: string): ProtocolType {
  if (/m3u8/i.test(url)) return 'hls'
  if (/^https?:\/\//i.test(url)) {
    if (/\.m3u(?:[^8]|$)/i.test(url)) return 'm3u'
    // Use the same TS detection logic as streamProxy so probe and playback
    // agree on whether a URL is a raw MPEG-TS stream.
    if (isHttpTsUrl(url)) return 'ts'
    return 'http'
  }
  if (/^rtmp[s]?:\/\//i.test(url)) return 'rtmp'
  if (/^rtsp:\/\//i.test(url)) return 'rtsp'
  if (/^udp:\/\//i.test(url) || /^rtp:\/\//i.test(url)) return 'udp'
  return 'unknown'
}

// ── Retry helper ─────────────────────────────────────────────────────
/**
 * Run `fn` up to `maxAttempts` times.
 * Returns on the first 'online' result.
 * If all attempts return 'offline', returns 'offline'.
 * 'unknown' results short-circuit immediately (UDP/RTP — no point retrying).
 *
 * A short delay between retries gives slow-starting or Stalker portal
 * streams time to recover from a transient session reset.
 */
async function withRetry(
  fn: () => Promise<ProbeResult>,
  maxAttempts: number = 3,
  delayMs: number = 1500,
): Promise<ProbeResult> {
  let lastResult: ProbeResult = 'offline'
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    lastResult = await fn()
    if (lastResult === 'online' || lastResult === 'unknown') return lastResult
    if (attempt < maxAttempts) {
      console.log(`[probe] attempt ${attempt}/${maxAttempts} offline — retrying in ${delayMs}ms`)
      await new Promise<void>((r) => setTimeout(r, delayMs))
    }
  }
  return lastResult
}

// ── URL helpers ──────────────────────────────────────────────────────
function parseHostPort(url: string, defaultPort: number): { host: string; port: number } | null {
  try {
    const u = new URL(url)
    const host = u.hostname
    if (!host) return null
    const port = u.port ? Number(u.port) : defaultPort
    return { host, port }
  } catch {
    return null
  }
}

// ── HLS probe ────────────────────────────────────────────────────────
async function probeHls(url: string): Promise<ProbeResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await net.fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (res.status === 403) return 'online'
    if (res.status !== 200 && res.status !== 206) return 'offline'

    const body = await res.text()
    if (!body.includes('#EXTM3U') && !body.includes('#EXT-X')) return 'offline'

    // Variant playlist — fetch first media segment
    if (body.includes('#EXT-X-STREAM-INF')) {
      const lines = body.split('\n')
      let mediaUrl = ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith('#')) {
          mediaUrl = trimmed
          break
        }
      }
      if (mediaUrl) {
        const resolvedUrl = new URL(mediaUrl, url).href
        const c2 = new AbortController()
        const t2 = setTimeout(() => c2.abort(), 8000)
        try {
          const mediaRes = await net.fetch(resolvedUrl, { signal: c2.signal })
          clearTimeout(t2)
          if (mediaRes.status === 200 || mediaRes.status === 206 || mediaRes.status === 403) return 'online'
        } catch {
          clearTimeout(t2)
        }
        return 'offline'
      }
    }

    return 'online'
  } catch {
    return 'offline'
  }
}

// ── Magic-byte helpers ───────────────────────────────────────────────
function validateTs(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0x47) return false
  const TS_PACKET = 188
  let syncCount = 1
  for (let k = 1; k < 5; k++) {
    const off = k * TS_PACKET
    if (off < bytes.length && bytes[off] === 0x47) syncCount++
  }
  if (syncCount < 3) return false
  // Check for PAT (PID 0x0000) or PMT (PID 0x1000) in first 5 packets
  for (let p = 0; p < 5; p++) {
    const off = p * TS_PACKET + 1
    if (off + 1 >= bytes.length) break
    const pid = ((bytes[off] & 0x1F) << 8) | bytes[off + 1]
    if (pid === 0x0000 || pid === 0x1000) return true
  }
  // No PAT/PMT found but sync is consistent — likely valid
  return syncCount >= 4
}

function validateMp4(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const tag = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7])
  if (tag !== 'ftyp' && tag !== 'moov') return false
  // Check for 'moov' (movie box) or 'mdat' (media data) within first 64KB
  const sample = String.fromCharCode(...Array.from(bytes.slice(0, Math.min(bytes.length, 65536))))
  return sample.includes('moov') || sample.includes('mdat')
}

function validateFlv(bytes: Uint8Array): boolean {
  if (bytes[0] !== 0x46 || bytes[1] !== 0x4C || bytes[2] !== 0x56) return false
  if (bytes.length < 13) return false
  // FLV header: "FLV" + version(1) + flags(1) + headerSize(4)
  const hasAudio = !!(bytes[4] & 4)
  const hasVideo = !!(bytes[4] & 1)
  return hasAudio || hasVideo
}

// ── HTTP(S) stream probe ─────────────────────────────────────────────
async function probeHttp(url: string): Promise<ProbeResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const res = await net.fetch(url, {
      method: 'GET',
      headers: {
        Range: 'bytes=0-131071',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        Accept: '*/*',
        'Icy-MetaData': '1',
      },
      signal: controller.signal,
    })

    // Read first available chunk for magic-byte analysis.
    // Do NOT loop — live streams trickle data slowly and would block.
    let bytes = new Uint8Array(0)
    try {
      const reader = res.body?.getReader()
      if (reader) {
        const { done, value } = await reader.read()
        if (!done && value) bytes = value
        reader.cancel()
      }
    } catch {}

    clearTimeout(timer)

    if (res.status === 403) return 'online'
    if (res.status !== 200 && res.status !== 206) return 'offline'

    const ct = (res.headers.get('content-type') || '').toLowerCase()
    if (
      ct.includes('video/') ||
      ct.includes('audio/') ||
      ct.includes('application/octet-stream') ||
      ct.includes('application/x-mpegurl') ||
      ct.includes('application/vnd.apple.mpegurl')
    ) return 'online'

    if (bytes.length < 4) return 'offline'

    // FLV
    if (validateFlv(bytes)) return 'online'
    // MPEG-TS — validate sync byte structure
    if (validateTs(bytes)) return 'online'
    // MP4 / QuickTime
    if (bytes.length >= 8 && validateMp4(bytes)) return 'online'
    // MPEG-PS / VOB
    if (bytes[0] === 0x00 && bytes[1] === 0x00 && bytes[2] === 0x01 && bytes[3] === 0xBA) return 'online'
    // WebM / Matroska
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return 'online'

    return 'offline'
  } catch {
    return 'offline'
  }
}

// ── TCP connect probe (RTMP / RTSP) ──────────────────────────────────
async function probeTcp(host: string, port: number, timeoutMs: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const socket = createConnection(port, host, () => {
      socket.destroy()
      resolve('online')
    })
    socket.setTimeout(timeoutMs, () => {
      socket.destroy()
      resolve('offline')
    })
    socket.on('error', () => {
      socket.destroy()
      resolve('offline')
    })
  })
}

// ── M3U playlist probe ───────────────────────────────────────────────
async function probeM3u(url: string, depth: number = 0): Promise<ProbeResult> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await net.fetch(url, { signal: controller.signal })
    clearTimeout(timer)

    if (res.status !== 200 && res.status !== 206) return 'offline'

    const body = await res.text()
    if (!body.includes('#EXTM3U')) return 'offline'

    // More than 5 data lines -> channel list, not a single stream playlist
    const dataLines = body.split('\n').filter((l) => {
      const t = l.trim()
      return t && !t.startsWith('#')
    })
    if (dataLines.length > 5) return 'online'

    // Recursive probe (max depth 1)
    if (depth >= 1) return 'online'

    const firstUrl = dataLines[0]
    if (!firstUrl) return 'offline'

    const resolvedUrl = new URL(firstUrl, url).href
    const protocol = detectProtocol(resolvedUrl)

    if (protocol === 'hls') return probeHls(resolvedUrl)
    if (protocol === 'http' || protocol === 'ts') return probeHttp(resolvedUrl)
    return 'offline'
  } catch {
    return 'offline'
  }
}

// ── Multi-protocol channel probe (with retry) ─────────────────────────
/**
 * Probe a single channel URL.
 * Each protocol-specific probe is retried up to 3 times (with a 1.5s gap
 * between attempts) before the channel is marked offline.
 *
 * Retry rationale:
 *  - HTTP .ts / Stalker portal streams may reject the first request while
 *    a session is being negotiated by the server.
 *  - HLS CDNs occasionally return transient 5xx errors.
 *  - TCP probes can timeout on the first try for slow WAN links.
 * UDP streams are never retried (they cannot be probed meaningfully).
 */
async function probeChannel(url: string): Promise<{ result: ProbeResult; skipped?: boolean }> {
  const protocol = detectProtocol(url)

  switch (protocol) {
    case 'hls': {
      const result = await withRetry(() => probeHls(url))
      console.log('[probe]', 'hls', url.slice(0, 60), result)
      return { result }
    }
    case 'http': {
      const result = await withRetry(() => probeHttp(url))
      console.log('[probe]', 'http', url.slice(0, 60), result)
      return { result }
    }
    case 'ts': {
      // .ts streams use a browser UA and benefit most from retry —
      // Stalker portal servers often need a moment before accepting a probe.
      const result = await withRetry(() => probeHttp(url), 3, 2000)
      console.log('[probe]', 'ts', url.slice(0, 60), result)
      return { result }
    }
    case 'm3u': {
      const result = await withRetry(() => probeM3u(url))
      console.log('[probe]', 'm3u', url.slice(0, 60), result)
      return { result }
    }
    case 'rtmp': {
      const parsed = parseHostPort(url, 1935)
      if (!parsed) return { result: 'offline' }
      const result = await withRetry(() => probeTcp(parsed.host, parsed.port, 4000))
      console.log('[probe]', 'rtmp', url.slice(0, 60), result)
      return { result }
    }
    case 'rtsp': {
      const parsed = parseHostPort(url, 554)
      if (!parsed) return { result: 'offline' }
      const result = await withRetry(() => probeTcp(parsed.host, parsed.port, 4000))
      console.log('[probe]', 'rtsp', url.slice(0, 60), result)
      return { result }
    }
    case 'udp':
      // UDP/RTP multicast cannot be probed — skip without retry.
      console.log('[probe]', 'udp', url.slice(0, 60), 'skipped')
      return { result: 'unknown', skipped: true }
    default:
      console.log('[probe]', 'unknown', url.slice(0, 60), 'offline')
      return { result: 'offline' }
  }
}

export function registerPlaylistIpc() {
  ipcMain.handle('save-channels', async (_event, channels: unknown[]) => {
    await saveChannels(channels as Channel[])
  })

  ipcMain.handle('load-channels', async () => {
    return await loadChannels()
  })

  ipcMain.handle('cancel-check-all', () => {
    _checkCancelToken++
  })

  ipcMain.handle('check-channel-url', async (_event, url: string) => {
    const now = Date.now()
    try {
      const { result, skipped } = await probeChannel(url)
      if (skipped) return { online: false, lastCheckedAt: now, skipped: true }
      return { online: result === 'online', lastCheckedAt: now }
    } catch (e) {
      return { online: false, lastCheckedAt: now, error: (e as Error).message }
    }
  })

  ipcMain.handle('check-all-channels', async () => {
    const channels: Channel[] = await loadChannels()
    const now = Date.now()
    let checked = 0
    const batchSize = 5
    const state = getState()
    const myToken = ++_checkCancelToken

    for (let i = 0; i < channels.length; i += batchSize) {
      if (myToken !== _checkCancelToken) break

      const batch = channels.slice(i, i + batchSize)

      const results = await Promise.allSettled(
        batch.map((ch) => probeChannel(ch.url)),
      )

      if (myToken !== _checkCancelToken) break

      for (let j = 0; j < batch.length; j++) {
        const r = results[j]
        let result: ProbeResult = 'offline'
        let skipped = false
        if (r.status === 'fulfilled') {
          result = r.value.result
          skipped = r.value.skipped || false
        }
        if (!skipped && result !== 'unknown') {
          batch[j].status = result
        }
        batch[j].lastCheckedAt = now
        checked++

        if (state.mainWindow && !state.mainWindow.isDestroyed()) {
          state.mainWindow.webContents.send('channels-check-log', {
            name: batch[j].name,
            url: batch[j].url,
            protocol: detectProtocol(batch[j].url),
            result: skipped ? 'skipped' : result,
            checked,
            total: channels.length,
          })
        }
      }

      await saveChannels(channels)

      if (state.mainWindow && !state.mainWindow.isDestroyed()) {
        state.mainWindow.webContents.send('channels-check-progress', {
          checked,
          total: channels.length,
          currentName: batch[batch.length - 1]?.name || '',
        })
      }
    }

    if (state.mainWindow && !state.mainWindow.isDestroyed()) {
      state.mainWindow.webContents.send('channels-check-done', channels)
    }

    return { total: channels.length, channels }
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
      const timeout = setTimeout(() => controller.abort(), 15000)
      const res = await net.fetch(url, {
        headers: {
          'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
          Accept: '*/*',
        },
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!res.ok) return { channels: [], error: `HTTP ${res.status}: ${res.statusText}` }
      const content = await res.text()
      if (!content.trim()) return { channels: [], error: '\u54cd\u5e94\u5185\u5bb9\u4e3a\u7a7a' }
      const playlistId = nextPlaylistId()
      const channels = await parseM3U(content, playlistId)

      // If no channels were parsed, the response is not an IPTV M3U
      // playlist. Treat the URL as a single playable stream — this
      // covers direct .ts streams, HLS manifests, and other URLs.
      if (channels.length === 0) {
        const name = url.split('/').pop()?.split('?')[0] || url.slice(0, 40)
        channels.push({
          id: urlToId(url),
          name,
          url,
          group: '\u672a\u5206\u7ec4',
          playlistId,
        })
      }

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
