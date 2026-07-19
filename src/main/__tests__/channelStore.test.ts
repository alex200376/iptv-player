import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const testDir = join(tmpdir(), 'iptv-channel-store-test')

beforeEach(() => {
  if (!existsSync(testDir)) mkdirSync(testDir, { recursive: true })
})

afterEach(() => {
  try { unlinkSync(join(testDir, 'iptv-player-channels.json')) } catch { /* ignore */ }
  try { unlinkSync(join(testDir, 'iptv-player-channels.json.tmp')) } catch { /* ignore */ }
  try { unlinkSync(join(testDir, 'iptv-player-channels.json.bak')) } catch { /* ignore */ }
})

describe('Channel JSON serialization', () => {
  it('round-trips channels through JSON correctly', async () => {
    const filePath = join(testDir, 'iptv-player-channels.json')
    const channels = [
      { id: 'ch-1', name: 'Channel 1', url: 'http://example.com/1', group: 'News' },
      { id: 'ch-2', name: 'Channel 2', url: 'http://example.com/2', group: 'Sports' },
    ]
    writeFileSync(filePath, JSON.stringify(channels, null, 2), 'utf-8')
    const raw = JSON.parse(readFileSync(filePath, 'utf-8'))
    expect(raw).toHaveLength(2)
    expect(raw[0].id).toBe('ch-1')
    expect(raw[1].group).toBe('Sports')
  })

  it('handles channels with all optional fields', async () => {
    const channels = [
      {
        id: 'ch-1',
        name: 'Full Channel',
        url: 'http://example.com/stream',
        logo: 'http://example.com/logo.png',
        group: 'News',
        tvgId: 'bbc',
        tvgUrl: 'http://example.com/epg',
        tvgChno: '101',
        playlistId: 'pl-1',
        status: 'online' as const,
        lastCheckedAt: Date.now(),
      },
    ]
    const json = JSON.stringify(channels)
    const parsed = JSON.parse(json)
    expect(parsed[0].logo).toBe('http://example.com/logo.png')
    expect(parsed[0].status).toBe('online')
    expect(parsed[0].tvgChno).toBe('101')
  })
})
