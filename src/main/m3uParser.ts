import { createHash } from 'crypto'
import { t } from './i18n'
import type { Channel } from '../shared/types'

/**
 * FIX(high): Replaced 32-bit djb2 hash with SHA-1 truncated to 16 hex chars.
 * The old hash had significant collision probability on large playlists (10k+
 * channels), causing channels to silently overwrite each other in the store.
 */
export function urlToId(url: string): string {
  return 'ch-' + createHash('sha1').update(url).digest('hex').slice(0, 16)
}

/**
 * True when the fetched content is an HLS playlist (master or media).
 * A normal M3U channel list uses #EXTM3U/#EXTINF tags; HLS adds #EXT-X-* tags.
 *
 * Used to stop an HLS master playlist being mis-parsed as a channel list:
 * the first non-comment line of a master playlist is the video-only variant
 * URL, and extracting it as the channel URL drops the separate
 * EXT-X-MEDIA audio group → silent video (e.g. short links like
 * `r.jdshipin.com/62WM7` that redirect to an obfuscated master).
 */
export function isHlsPlaylistContent(content: string): boolean {
  // HLS tags always begin at the start of a line. Anchoring avoids false
  // positives from channel URLs that merely contain "#EXT-X-" as a fragment.
  return /^\s*#EXT-X-/m.test(content)
}

/**
 * Build the single channel representing an HLS playlist, locked to the
 * original source URL ("import URL") instead of a variant URL. VLC's
 * adaptive demux (and the ffmpeg proxy) then use the full master playlist,
 * which includes the separate audio group.
 */
export function hlsSingleChannel(sourceUrl: string, playlistId?: string): Channel {
  const name = sourceUrl.split('/').pop()?.split('?')[0] || sourceUrl.slice(0, 40)
  return {
    id: urlToId(sourceUrl),
    name,
    url: sourceUrl,
    group: t('group.ungrouped'),
    playlistId,
  }
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
