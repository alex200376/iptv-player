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

// ── Serialisation lock ───────────────────────────────────────────
// Prevents concurrent saveUserData calls from interfering with each
// other through the shared .tmp filename (writeFile → rename).
let saveQueue = Promise.resolve()

function isValidUserData(data: unknown): data is UserData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return (
    Array.isArray(d.favoriteIds) &&
    Array.isArray(d.historyEntries) &&
    (d.playlists === undefined || Array.isArray(d.playlists))
  )
}

/**
 * Atomic write + backup: write to .tmp, rename over target.
 * Previous file is copied to .bak before each save.
 *
 * Serialised so two concurrent calls never step on each other's .tmp.
 */
export async function saveUserData(data: UserData): Promise<void> {
  const current = saveQueue.then(async () => {
    const filePath = getFilePath()
    const tmpPath = getTmpPath()
    const bakPath = getBakPath()

    // Clean up stale .tmp left from a previous crash before starting.
    // Safe because the queue guarantees only one save runs at a time.
    if (existsSync(tmpPath)) {
      try { await unlink(tmpPath) } catch { /* ignore */ }
    }

    // Backup current file.
    if (existsSync(filePath)) {
      try { await copyFile(filePath, bakPath) } catch { /* best-effort */ }
    }

    // Ensure playlists is always an array so the key is never omitted from JSON.
    // A missing playlists key would fail isValidUserData on next load,
    // causing all playlist metadata to be silently lost after restart.
    const dataToSave = {
      ...data,
      playlists: Array.isArray(data.playlists) ? data.playlists : [],
    }

    await writeFile(tmpPath, JSON.stringify(dataToSave, null, 2), 'utf-8')
    await rename(tmpPath, filePath)
  })
  saveQueue = current.catch(() => {})
  return current
}

/**
 * Load user data. Falls back to backup if main file is missing/corrupt.
 *
 * NOTE: This function intentionally does NOT clean up orphaned .tmp
 * files.  Doing so would race with a concurrent saveUserData that is
 * mid-write to .tmp — the unlink would delete the file before rename
 * finishes, producing an ENOENT crash.  .tmp cleanup is handled at
 * the start of saveUserData instead.
 */
export async function loadUserData(): Promise<UserData> {
  const filePath = getFilePath()
  const tmpPath = getTmpPath()
  const bakPath = getBakPath()

  // Try main file.
  if (existsSync(filePath)) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (isValidUserData(parsed)) {
        const safe = { ...DEFAULTS, ...parsed }
        if (!Array.isArray(safe.playlists)) safe.playlists = DEFAULTS.playlists
        return safe
      }
    } catch { /* fall through to backup */ }
  }

  // Try backup.
  if (existsSync(bakPath)) {
    try {
      const raw = await readFile(bakPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (isValidUserData(parsed)) {
        const safe = { ...DEFAULTS, ...parsed }
        if (!Array.isArray(safe.playlists)) safe.playlists = DEFAULTS.playlists
        // Restore backup as main file.
        await writeFile(filePath, JSON.stringify(safe, null, 2), 'utf-8')
        return safe
      }
    } catch { /* ignore */ }
  }

  return { ...DEFAULTS }
}
