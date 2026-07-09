import { net } from 'electron'
import { parseXmltv, type EpgProgram } from './epgParser'
import { loadEpgCache, saveEpgCacheEntry, isCacheValid, restorePrograms, CACHE_TTL } from './epgStore'

interface CacheEntry {
  fetchedAt: number
  programs: EpgProgram[]
}

const memoryCache = new Map<string, CacheEntry>()
let diskCacheLoaded = false

async function ensureDiskCacheLoaded(): Promise<void> {
  if (diskCacheLoaded) return
  diskCacheLoaded = true
  const disk = await loadEpgCache()
  for (const [url, entry] of disk) {
    if (isCacheValid(entry)) {
      memoryCache.set(url, {
        fetchedAt: entry.fetchedAt,
        programs: restorePrograms(entry),
      })
    }
  }
}

export async function fetchEpgForUrl(tvgUrl: string): Promise<EpgProgram[]> {
  await ensureDiskCacheLoaded()
  const cached = memoryCache.get(tvgUrl)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.programs
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    const res = await net.fetch(tvgUrl, { signal: controller.signal })
    clearTimeout(timeout)
    if (!res.ok) return []

    const xml = await res.text()
    // parseXmltv is now async (chunked with setImmediate) — must await
    const programs = await parseXmltv(xml)

    const entry: CacheEntry = { fetchedAt: Date.now(), programs }
    memoryCache.set(tvgUrl, entry)
    saveEpgCacheEntry(tvgUrl, programs)

    return programs
  } catch {
    return []
  }
}

export function getCachedPrograms(tvgUrl: string): EpgProgram[] | null {
  const cached = memoryCache.get(tvgUrl)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.programs
  }
  return null
}

export function getCurrentProgram(programs: EpgProgram[]): EpgProgram | null {
  const now = new Date()
  return programs.find((p) => p.start <= now && p.stop > now) || null
}

export function getNextPrograms(programs: EpgProgram[], count = 5): EpgProgram[] {
  const now = new Date()
  return programs.filter((p) => p.start > now).slice(0, count)
}

export interface ImportEpgResult {
  success: boolean
  count: number
  tvgIds: string[]
  error?: string
}

export async function importEpgFromUrl(url: string): Promise<ImportEpgResult> {
  const programs = await fetchEpgForUrl(url)
  if (programs.length === 0) {
    return { success: false, count: 0, tvgIds: [], error: '\u672a\u83b7\u53d6\u5230\u8282\u76ee\u6570\u636e' }
  }
  const tvgIds = [...new Set(programs.map((p) => p.channelTvgId).filter(Boolean))]
  return { success: true, count: programs.length, tvgIds }
}
