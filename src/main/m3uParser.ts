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

export function parseM3U(content: string, playlistId?: string): Channel[] {
  const lines = content.split('\n')
  const channels: Channel[] = []
  let current: Partial<Channel> | null = null

  for (let rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#EXTM3U')) continue

    if (line.startsWith('#EXTINF:')) {
      const group = line.match(/group-title="([^"]*)"/)?.[1]
      const logo = line.match(/tvg-logo="([^"]*)"/)?.[1]
      const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1]
      const tvgUrl = line.match(/tvg-url="([^"]*)"/)?.[1]
      const name = line.split(',').pop()?.trim()

      current = {
        group: group || '未分组',
        logo,
        tvgId,
        tvgUrl,
        name: name || '未知频道',
      }
    } else if (line.startsWith('#')) {
      continue
    } else if (current) {
      channels.push({
        id: urlToId(line),
        name: current.name || '未知频道',
        url: line,
        logo: current.logo,
        group: current.group || '未分组',
        tvgId: current.tvgId,
        tvgUrl: current.tvgUrl,
        playlistId,
      })
      current = null
    }
  }

  return channels
}
