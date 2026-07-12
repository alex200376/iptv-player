import { app } from 'electron'
import { writeFile, readFile, rename, copyFile, unlink } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface UserData {
  favoriteIds: string[]
  historyEntries: { channel: Record<string, unknown>; watchedAt: number }[]
  playlists: { id: string; name: string; source: string; path?: string; url?: string; importedAt: number; channelCount: number }[]
  epgSources?: { url: string; importedAt: number; programCount: number; tvgIds: string[] }[]
  activePlaylistId?: string | null
}

const FILE = 'iptv-player-user-data.json'
const FILE_TMP = 'iptv-player-user-data.json.tmp'
const FILE_BAK = 'iptv-player-user-data.json.bak'

function getUserDataDir(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getFilePath(): string { return join(getUserDataDir(), FILE) }
function getTmpPath(): string { return join(getUserDataDir(), FILE_TMP) }
function getBakPath(): string { return join(getUserDataDir(), FILE_BAK) }

const DEFAULTS: UserData = {
  favoriteIds: [],
  historyEntries: [],
  playlists: [],
}

function isValidUserData(data: unknown): data is UserData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    Array.isArray(d.favoriteIds) &&
    Array.isArray(d.historyEntries) &&
    Array.isArray(d.playlists)
  )
}

/**
 * Atomic write + backup: write to .tmp, rename over target.
 * Previous file is copied to .bak before each save.
 */
export async function saveUserData(data: UserData): Promise<void> {
  const filePath = getFilePath()
  const tmpPath = getTmpPath()
  const bakPath = getBakPath()

  // Backup current file.
  if (existsSync(filePath)) {
    try { await copyFile(filePath, bakPath) } catch { /* best-effort */ }
  }

  await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  await rename(tmpPath, filePath)
}

/**
 * Load user data. Falls back to backup if main file is missing/corrupt.
 * Cleans up orphaned .tmp on startup.
 */
export async function loadUserData(): Promise<UserData> {
  const filePath = getFilePath()
  const tmpPath = getTmpPath()
  const bakPath = getBakPath()

  // Remove leftover .tmp from a previous crash.
  if (existsSync(tmpPath)) {
    try { await unlink(tmpPath) } catch { /* ignore */ }
  }

  // Try main file.
  if (existsSync(filePath)) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (isValidUserData(parsed)) return { ...DEFAULTS, ...parsed }
    } catch { /* fall through to backup */ }
  }

  // Try backup.
  if (existsSync(bakPath)) {
    try {
      const raw = await readFile(bakPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (isValidUserData(parsed)) {
        // Restore backup as main file.
        await writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf-8')
        return { ...DEFAULTS, ...parsed }
      }
    } catch { /* ignore */ }
  }

  return { ...DEFAULTS }
}
