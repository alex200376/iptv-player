import { createHash } from 'crypto'
import { t } from './i18n'

export interface Channel {
  id: string
  name: string
  url: string
  logo?: string
  group?: string
  tvgId?: string
  tvgUrl?: string
  tvgChno?: string
  playlistId?: string
  status?: 'unknown' | 'online' | 'offline'
  lastCheckedAt?: number
}

/**
 * FIX(high): Replaced 32-bit djb2 hash with SHA-1 truncated to 16 hex chars.
 * The old hash had significant collision probability on large playlists (10k+
 * channels), causing channels to silently overwrite each other in the store.
 */
export function urlToId(url: string): string {
  return 'ch-' + createHash('sha1').update(url).digest('hex').slice(0, 16)
}

/**
 * Parse M3U content without blocking the event loop.
 * Large playlists (10 000+ channels) are processed in 500-line chunks
 * with a setImmediate yield between each chunk so IPC calls can
 * still be serviced during parsing.
 */
function looksLikeUrl(text: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text)
}

export function parseM3U(content: string, playlistId?: string): Promise<Channel[]> {
  return new Promise((resolve) => {
    const lines = content.split('\n')
    const channels: Channel[] = []
    let current: Partial<Channel> | null = null
    let i = 0
    const CHUNK = 500

    function processChunk() {
      const end = Math.min(i + CHUNK, lines.length)
      for (; i < end; i++) {
        const line = lines[i].trim()
        if (!line || line === '#EXTM3U') continue

        if (line.startsWith('#EXTINF:')) {
          const group = line.match(/group-title="([^"]*)"/)?.[1]
          const logo = line.match(/tvg-logo="([^"]*)"/)?.[1]
          const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1]
          const tvgUrl = line.match(/tvg-url="([^"]*)"/)?.[1]
          const tvgChno = line.match(/tvg-chno="([^"]*)"/)?.[1]
          /**
           * FIX(high): Use indexOf to find the FIRST comma, then take everything
           * after it as the channel name. The old `split(',').pop()` would truncate
           * names that legitimately contain commas (e.g. "BBC News, HD").
           */
          const commaIdx = line.indexOf(',')
          const name = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : ''
          current = {
            group: group || t('group.ungrouped'),
            logo,
            tvgId,
            tvgUrl,
            tvgChno,
            name: name || t('channel.unknown'),
          }
        } else if (line.startsWith('#') || line.startsWith('//')) {
          continue
        } else if (looksLikeUrl(line)) {
          const name = line.split('/').pop()?.split('?')[0] || line.slice(0, 40)
          const ch = current || {}
          channels.push({
            id: urlToId(line),
            name: ch.name || name,
            url: line,
            logo: ch.logo,
            group: ch.group || t('group.ungrouped'),
            tvgId: ch.tvgId,
            tvgUrl: ch.tvgUrl,
            tvgChno: ch.tvgChno,
            playlistId,
          })
          current = null
        }
      }

      if (i < lines.length) {
        setImmediate(processChunk)
      } else {
        resolve(channels)
      }
    }

    processChunk()
  })
}
