import { app } from 'electron'
import { writeFile, readFile, rename, copyFile, unlink } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Channel } from './m3uParser'

const FILE = 'iptv-player-channels.json'
const FILE_TMP = 'iptv-player-channels.json.tmp'
const FILE_BAK = 'iptv-player-channels.json.bak'

function getUserDataDir(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getFilePath(): string {
  return join(getUserDataDir(), FILE)
}
function getTmpPath(): string {
  return join(getUserDataDir(), FILE_TMP)
}
function getBakPath(): string {
  return join(getUserDataDir(), FILE_BAK)
}

// ── Serialisation lock ───────────────────────────────────────────
// Prevents concurrent saveChannels calls from interfering with each
// other through the shared .tmp filename (writeFile → rename).
let saveQueue = Promise.resolve()

/**
 * Atomic write: write to .tmp first, then rename over the target.
 * A crash mid-write leaves .tmp behind and the original intact.
 * Before each save, copy the current file to .bak so the previous
 * session's data is always recoverable.
 *
 * Serialised so two concurrent calls never step on each other's .tmp.
 */
export async function saveChannels(channels: Channel[]): Promise<void> {
  const current = saveQueue.then(async () => {
    if (!Array.isArray(channels)) channels = []
    const filePath = getFilePath()
    const tmpPath = getTmpPath()
    const bakPath = getBakPath()

    // Clean up stale .tmp left from a previous crash before starting.
    // Safe because the queue guarantees only one save runs at a time,
    // so we never delete a .tmp that another call is actively writing.
    if (existsSync(tmpPath)) {
      try { await unlink(tmpPath) } catch { /* ignore */ }
    }

    // Backup current file before overwriting.
    if (existsSync(filePath)) {
      try { await copyFile(filePath, bakPath) } catch { /* best-effort */ }
    }

    await writeFile(tmpPath, JSON.stringify(channels, null, 2), 'utf-8')
    await rename(tmpPath, filePath)
  })
  saveQueue = current.catch(() => {})
  return current
}

/**
 * Load channels. If the main file is missing or corrupt, try the
 * backup.
 *
 * NOTE: This function intentionally does NOT clean up orphaned .tmp
 * files.  Doing so would race with a concurrent saveChannels that is
 * mid-write to .tmp — the unlink would delete the file before rename
 * finishes, producing an ENOENT crash.  .tmp cleanup is handled at
 * the start of saveChannels instead.
 */
export async function loadChannels(): Promise<Channel[]> {
  const filePath = getFilePath()
  const tmpPath = getTmpPath()
  const bakPath = getBakPath()

  // Try main file.
  if (existsSync(filePath)) {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    } catch { /* fall through to backup */ }
  }

  // Try backup.
  if (existsSync(bakPath)) {
    try {
      const raw = await readFile(bakPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        // Restore backup as main file.
        await writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf-8')
        return parsed
      }
    } catch { /* ignore */ }
  }

  return []
}
