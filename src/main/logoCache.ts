import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { rm } from 'fs/promises'
import { createHash } from 'crypto'
import { net } from 'electron'

interface LogoCacheIndex {
  [url: string]: string
}

function getLogoDir(): string {
  const dir = join(app.getPath('userData'), 'logos')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getIndexPath(): string {
  return join(getLogoDir(), 'index.json')
}

function loadIndex(): LogoCacheIndex {
  try {
    return JSON.parse(readFileSync(getIndexPath(), 'utf-8'))
  } catch {
    return {}
  }
}

function saveIndex(index: LogoCacheIndex): void {
  writeFileSync(getIndexPath(), JSON.stringify(index, null, 2))
}

function urlToFilename(url: string): string {
  const extMatch = url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)(\?.*)?$/i)
  const ext = extMatch?.[1] || 'png'
  const hash = createHash('md5').update(url).digest('hex')
  return `${hash}.${ext}`
}

export function getLocalLogoUrl(url: string): string | null {
  const index = loadIndex()
  const filename = index[url]
  if (!filename) return null
  const localPath = join(getLogoDir(), filename)
  if (!existsSync(localPath)) {
    delete index[url]
    saveIndex(index)
    return null
  }
  return `logo://${filename}`
}

export async function downloadAndCacheLogo(url: string): Promise<boolean> {
  if (getLocalLogoUrl(url)) return true

  try {
    const response = await net.fetch(url, {
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        Accept: 'image/*',
      },
    })
    if (!response.ok) return false

    const buffer = Buffer.from(await response.arrayBuffer())
    if (buffer.length === 0) return false

    const filename = urlToFilename(url)
    const localPath = join(getLogoDir(), filename)
    writeFileSync(localPath, buffer)

    const index = loadIndex()
    index[url] = filename
    saveIndex(index)
    return true
  } catch {
    return false
  }
}

const MAX_CONCURRENT = 5
let activeCount = 0
const queue: string[] = []

function processQueue(): void {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const url = queue.shift()!
    activeCount++
    downloadAndCacheLogo(url).finally(() => {
      activeCount--
      processQueue()
    })
  }
}

export function queueCacheLogos(urls: string[]): void {
  const index = loadIndex()
  for (const url of urls) {
    if (!url) continue
    if (index[url] && existsSync(join(getLogoDir(), index[url]))) continue
    if (queue.includes(url)) continue
    queue.push(url)
  }
  processQueue()
}

export async function clearLogoCache(): Promise<void> {
  try {
    await rm(getLogoDir(), { recursive: true, force: true })
  } catch { /* ignore */ }
}
