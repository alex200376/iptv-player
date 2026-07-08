import { app } from 'electron'
import { writeFile, readFile, mkdir } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Channel } from './m3uParser'

const FILE = 'iptv-player-channels.json'

function getFilePath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return join(dir, FILE)
}

export async function saveChannels(channels: Channel[]): Promise<void> {
  await writeFile(getFilePath(), JSON.stringify(channels, null, 2), 'utf-8')
}

export async function loadChannels(): Promise<Channel[]> {
  try {
    const raw = await readFile(getFilePath(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}
