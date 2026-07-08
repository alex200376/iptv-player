import { app } from 'electron'
import { writeFile, readFile } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { EpgProgram } from './epgParser'

export const CACHE_TTL = 30 * 60 * 1000
const FILE = 'iptv-player-epg-cache.json'

interface CacheEntry {
  fetchedAt: number
  programs: { channelTvgId: string; start: string; stop: string; title: string; description?: string; category?: string; icon?: string }[]
}

function getFilePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, FILE)
}

export async function loadEpgCache(): Promise<Map<string, CacheEntry>> {
  try {
    const raw = await readFile(getFilePath(), 'utf-8')
    const parsed: Record<string, CacheEntry> = JSON.parse(raw)
    const map = new Map<string, CacheEntry>()
    for (const [key, val] of Object.entries(parsed)) {
      if (Date.now() - val.fetchedAt < CACHE_TTL) {
        map.set(key, val)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

export async function saveEpgCacheEntry(url: string, programs: EpgProgram[]): Promise<void> {
  const map = await loadEpgCache()
  const entry: CacheEntry = {
    fetchedAt: Date.now(),
    programs: programs.map((p) => ({
      channelTvgId: p.channelTvgId,
      start: p.start.toISOString(),
      stop: p.stop.toISOString(),
      title: p.title,
      description: p.description,
      category: p.category,
      icon: p.icon,
    })),
  }
  map.set(url, entry)
  const obj: Record<string, CacheEntry> = {}
  for (const [key, val] of map) {
    obj[key] = val
  }
  await writeFile(getFilePath(), JSON.stringify(obj, null, 2), 'utf-8')
}

export function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.fetchedAt < CACHE_TTL
}

export function restorePrograms(entry: CacheEntry): EpgProgram[] {
  return entry.programs.map((p) => ({
    channelTvgId: p.channelTvgId,
    start: new Date(p.start),
    stop: new Date(p.stop),
    title: p.title,
    description: p.description,
    category: p.category,
    icon: p.icon,
  }))
}
