import { t } from './i18n'

export interface Channel {
  id: string
  name: string
  url: string
  logo?: string
  group?: string
  tvgId?: string
  tvgUrl?: string
  playlistId?: string
  status?: 'unknown' | 'online' | 'offline'
  lastCheckedAt?: number
}

export function urlToId(url: string): string {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return `ch-${Math.abs(hash).toString(36)}`
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
          const name = line.split(',').pop()?.trim()
          current = {
            group: group || t('group.ungrouped'),
            logo,
            tvgId,
            tvgUrl,
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
