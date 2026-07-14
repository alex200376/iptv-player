import { describe, it, expect } from 'vitest'
import { parseM3U, urlToId } from '../m3uParser'

describe('urlToId', () => {
  it('produces a stable id for the same URL', () => {
    expect(urlToId('http://example.com/stream')).toBe(urlToId('http://example.com/stream'))
  })

  it('produces different ids for different URLs', () => {
    expect(urlToId('http://example.com/ch1')).not.toBe(urlToId('http://example.com/ch2'))
  })

  it('id starts with ch- prefix', () => {
    expect(urlToId('http://example.com/stream')).toMatch(/^ch-[0-9a-f]{16}$/)
  })
})

describe('parseM3U', () => {
  it('parses a basic M3U entry', async () => {
    const m3u = [
      '#EXTM3U',
      '#EXTINF:-1 tvg-id="bbc" tvg-logo="http://logo.png" group-title="News",BBC One',
      'http://example.com/bbc',
    ].join('\n')
    const channels = await parseM3U(m3u, 'playlist-1')
    expect(channels).toHaveLength(1)
    expect(channels[0].name).toBe('BBC One')
    expect(channels[0].tvgId).toBe('bbc')
    expect(channels[0].logo).toBe('http://logo.png')
    expect(channels[0].group).toBe('News')
    expect(channels[0].url).toBe('http://example.com/bbc')
    expect(channels[0].playlistId).toBe('playlist-1')
  })

  it('handles channel names that contain commas', async () => {
    const m3u = [
      '#EXTM3U',
      '#EXTINF:-1,BBC News, HD',
      'http://example.com/stream',
    ].join('\n')
    const channels = await parseM3U(m3u)
    expect(channels[0].name).toBe('BBC News, HD')
  })

  it('falls back to ungrouped when group-title is absent', async () => {
    const m3u = [
      '#EXTM3U',
      '#EXTINF:-1,My Channel',
      'http://example.com/ch',
    ].join('\n')
    const channels = await parseM3U(m3u)
    expect(channels[0].group).toBeTruthy()
  })

  it('parses a URL-only entry (no #EXTINF)', async () => {
    const m3u = [
      '#EXTM3U',
      'http://example.com/bare-stream',
    ].join('\n')
    const channels = await parseM3U(m3u)
    expect(channels).toHaveLength(1)
    expect(channels[0].url).toBe('http://example.com/bare-stream')
  })

  it('ignores comment lines', async () => {
    const m3u = [
      '#EXTM3U',
      '# This is a comment',
      '#EXTINF:-1,Channel A',
      'http://example.com/a',
    ].join('\n')
    const channels = await parseM3U(m3u)
    expect(channels).toHaveLength(1)
  })

  it('parses large playlists without collision', async () => {
    const lines = ['#EXTM3U']
    for (let i = 0; i < 200; i++) {
      lines.push(`#EXTINF:-1,Channel ${i}`)
      lines.push(`http://example.com/stream/${i}`)
    }
    const channels = await parseM3U(lines.join('\n'))
    const ids = channels.map((c) => c.id)
    const unique = new Set(ids)
    expect(unique.size).toBe(channels.length)
  })
})
