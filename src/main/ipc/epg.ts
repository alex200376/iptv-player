import { ipcMain } from 'electron'
import { fetchEpgForUrl, importEpgFromUrl } from '../epgCache'

export function registerEpgIpc() {
  ipcMain.handle('import-epg-url', async (_event, url: string) => {
    if (!url) return { success: false, count: 0, tvgIds: [], error: 'URL 不能为空' }
    return importEpgFromUrl(url)
  })

  ipcMain.handle('fetch-epg', async (_event, tvgUrl: string) => {
    if (!tvgUrl) return []
    const programs = await fetchEpgForUrl(tvgUrl)
    return programs.map((p) => ({
      ...p,
      start: p.start.toISOString(),
      stop: p.stop.toISOString(),
    }))
  })
}
