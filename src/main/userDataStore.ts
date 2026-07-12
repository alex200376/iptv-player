import { app } from 'electron'
import { writeFile, readFile } from 'fs/promises'
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

function getFilePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, FILE)
}

const DEFAULTS: UserData = {
  favoriteIds: [],
  historyEntries: [],
  playlists: [],
}

export async function saveUserData(data: UserData): Promise<void> {
  await writeFile(getFilePath(), JSON.stringify(data, null, 2), 'utf-8')
}

export async function loadUserData(): Promise<UserData> {
  try {
    const raw = await readFile(getFilePath(), 'utf-8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}
