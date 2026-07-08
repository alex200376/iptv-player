import { useState, useCallback } from 'react'
import { useStore } from '../stores/useStore'
import ImportDialog from './ImportDialog'

function formatDate(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function PlaylistList() {
  const playlists = useStore((s) => s.playlists)
  const removePlaylist = useStore((s) => s.removePlaylist)
  const setActivePlaylistId = useStore((s) => s.setActivePlaylistId)
  const activePlaylistId = useStore((s) => s.activePlaylistId)
  const setNavTab = useStore((s) => s.setNavTab)
  const groups = useStore((s) => s.groups)
  const setChannels = useStore((s) => s.setChannels)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingUrl, setRefreshingUrl] = useState<string | null>(null)

  const handleExport = useCallback(async () => {
    setExporting(true)
    const result = await window.electronAPI.exportM3U()
    setExporting(false)
    if (result.error) console.error('[export]', result.error)
  }, [])

  const handleRefreshAll = async () => {
    setRefreshing(true)
    const result = await window.electronAPI.refreshPlaylists()
    setRefreshing(false)
    if (result.errors.length > 0) {
      console.error('[refresh]', result.errors.join('; '))
    }
    const channels = await window.electronAPI.loadChannels()
    setChannels(channels)
  }

  const handleRefreshUrl = async (url: string) => {
    setRefreshingUrl(url)
    const result = await window.electronAPI.refreshPlaylistUrl(url)
    setRefreshingUrl(null)
    if (result.error) {
      console.error('[refresh]', url, result.error)
    }
    const channels = await window.electronAPI.loadChannels()
    setChannels(channels)
  }

  const handleSwitch = (id: string) => {
    setActivePlaylistId(id)
    setNavTab('channels')
  }

  const handleShowAll = () => {
    setActivePlaylistId(null)
    setNavTab('channels')
  }

  const handleDelete = (id: string) => {
    const pl = playlists.find((p) => p.id === id)
    if (!pl) return
    if (confirmDelete === id) {
      removePlaylist(id)
      setConfirmDelete(null)
    } else {
      setConfirmDelete(id)
    }
  }

  if (playlists.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 px-3">
        <div className="text-center text-tv-xs text-tv-text-secondary">
          暂无播放列表
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="px-4 py-2 bg-tv-accent hover:bg-tv-accent-hover rounded-md text-tv-sm font-medium transition-colors"
        >
          导入 M3U
        </button>
        <ImportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>
    )
  }

  const totalChannels = groups.flatMap((g) => g.channels).length

  return (
    <div>
      <div className="px-3 py-2 border-b border-tv-border flex items-center justify-between">
        <span className="text-tv-xs text-tv-text-secondary">共 {playlists.length} 个列表 · {totalChannels} 频道</span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="text-tv-xs text-tv-text-secondary hover:text-tv-accent transition-colors disabled:opacity-40"
            title="刷新所有 URL 播放列表"
          >
            {refreshing ? '刷新中...' : '刷新'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting || totalChannels === 0}
            className="text-tv-xs text-tv-text-secondary hover:text-tv-accent transition-colors disabled:opacity-40"
            title="导出为 M3U"
          >
            {exporting ? '导出中...' : '导出'}
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="text-tv-xs text-tv-accent hover:text-tv-accent-hover transition-colors"
          >
            导入
          </button>
        </div>
      </div>
      <ImportDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      <div className="px-2 py-1">
        <button
          onClick={handleShowAll}
          className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-tv-sm text-left transition-colors ${
            activePlaylistId === null
              ? 'text-tv-accent bg-tv-accent/10 font-medium'
              : 'text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-bg-surface'
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="11" height="11" rx="2" />
          </svg>
          <span className="flex-1">全部频道</span>
          <span className="text-tv-xs opacity-60">{totalChannels}</span>
        </button>
      </div>

      {playlists.map((pl) => (
        <div key={pl.id} className="px-2 py-0.5">
          <div className={`rounded-md transition-colors ${activePlaylistId === pl.id ? 'bg-tv-accent/5' : ''}`}>
            <button
              onClick={() => handleSwitch(pl.id)}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-tv-sm text-left"
            >
              <svg className="w-4 h-4 flex-shrink-0 text-tv-text-secondary" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4h11M2 8h11M2 12h11" />
              </svg>
              <div className="flex-1 min-w-0">
                <div className={`truncate ${activePlaylistId === pl.id ? 'text-tv-accent font-medium' : 'text-tv-text-primary'}`}>
                  {pl.name}
                </div>
                <div className="text-tv-xs text-tv-text-secondary">
                  {pl.channelCount} 频道 · {formatDate(pl.importedAt)}
                </div>
              </div>
            </button>
            <div className="flex items-center gap-1 px-2.5 pb-1.5">
              {pl.source === 'url' && pl.url && (
                <button
                  onClick={() => handleRefreshUrl(pl.url!)}
                  disabled={refreshingUrl === pl.url}
                  className="text-tv-xs text-tv-text-secondary hover:text-tv-accent transition-colors disabled:opacity-40"
                >
                  {refreshingUrl === pl.url ? '刷新中...' : '刷新'}
                </button>
              )}
              <button
                onClick={() => handleDelete(pl.id)}
                className={`text-tv-xs transition-colors ${
                  confirmDelete === pl.id
                    ? 'text-red-400 font-medium'
                    : 'text-tv-text-secondary hover:text-red-400'
                }`}
              >
                {confirmDelete === pl.id ? '确认删除' : '删除'}
              </button>
              {confirmDelete === pl.id && (
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="text-tv-xs text-tv-text-secondary hover:text-tv-text-primary transition-colors"
                >
                  取消
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
