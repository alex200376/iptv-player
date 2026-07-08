import { useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useStore } from '../stores/useStore'
import type { PlaylistMeta } from '../types'

export default function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const setChannels = useStore((s) => s.setChannels)
  const addPlaylist = useStore((s) => s.addPlaylist)
  const groups = useStore((s) => s.groups)

  useEffect(() => {
    if (open) {
      window.electronAPI.hidePlayer()
      setSuccessMsg('')
    } else {
      setError('')
      setUrl('')
      setSuccessMsg('')
    }
  }, [open])

  function mergeChannels(newChannels: Channel[], playlistId: string, playlistName: string, source: 'file' | 'url' = 'file', playlistUrl?: string) {
    const existing = groups.flatMap((g) => g.channels)
    const existingUrls = new Set(existing.map((ch) => ch.url))
    const unique: any[] = []
    let dupCount = 0
    for (const ch of newChannels) {
      if (existingUrls.has(ch.url)) {
        dupCount++
      } else {
        existingUrls.add(ch.url)
        unique.push(ch)
      }
    }
    if (unique.length === 0) {
      setError(`所有频道已存在，跳过导入（共 ${dupCount} 个重复频道）`)
      return
    }
    const merged = [...existing, ...unique]
    setChannels(merged)
    window.electronAPI.saveChannels(merged as unknown[])

    const meta: PlaylistMeta = {
      id: playlistId,
      name: playlistName,
      source,
      url: playlistUrl,
      importedAt: Date.now(),
      channelCount: unique.length,
    }
    addPlaylist(meta)
    const dupText = dupCount > 0 ? `，已跳过 ${dupCount} 个重复频道` : ''
    setSuccessMsg(`成功导入 ${unique.length} 个频道${dupText}`)
  }

  const handleFile = async () => {
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const result = await window.electronAPI.importM3U()
      if (result.error) {
        setError(result.error)
      } else if (result.channels.length > 0 && result.playlistId) {
        mergeChannels(result.channels, result.playlistId, result.playlistName || '未命名', 'file')
        if (!error) setTimeout(() => onOpenChange(false), 1200)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleUrl = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      const result = await window.electronAPI.importM3UFromUrl(url.trim())
      if (result.error) {
        setError(result.error)
      } else if (result.channels.length > 0 && result.playlistId) {
        mergeChannels(result.channels, result.playlistId, result.playlistName || url.trim().slice(0, 50), 'url', result.url)
        if (!error) {
          setTimeout(() => { onOpenChange(false); setUrl('') }, 1200)
        }
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] max-w-[480px] bg-tv-bg-surface rounded-lg border border-tv-border p-6 shadow-xl animate-[fadeIn_150ms_ease]"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Dialog.Title className="text-tv-base font-semibold text-tv-text-primary mb-4">导入 M3U 播放列表</Dialog.Title>
          <div className="space-y-3">
            <button
              onClick={handleFile}
              disabled={loading}
              className="w-full py-2.5 px-4 bg-tv-accent hover:bg-tv-accent-hover disabled:opacity-50 rounded-md text-tv-sm font-medium transition-colors flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
            >
              <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M8 2v4h4M8 6l4-4M4 8h7M4 11h7" />
              </svg>
              {loading ? '导入中...' : '从文件导入 (.m3u / .m3u8)'}
            </button>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-tv-border" />
              <span className="text-tv-xs text-tv-text-secondary">或者</span>
              <div className="flex-1 h-px bg-tv-border" />
            </div>
            <div className="space-y-2">
              <input
                id="m3u-url-input"
                autoFocus
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="粘贴 M3U 在线地址..."
                className="w-full px-3 py-2 bg-tv-bg border border-tv-border rounded-md text-tv-sm text-tv-text-primary placeholder-tv-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
              />
              <button
                onClick={handleUrl}
                disabled={loading || !url.trim()}
                className="w-full py-2 px-3 bg-tv-bg border border-tv-border hover:bg-tv-bg-surface disabled:opacity-50 rounded-md text-tv-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
              >
                从 URL 导入
              </button>
            </div>
            {error && (
              <div className="text-tv-xs text-red-400 bg-red-900/30 border border-red-800 rounded-md px-3 py-2">{error}</div>
            )}
            {successMsg && (
              <div className="text-tv-xs text-green-400 bg-green-900/30 border border-green-800 rounded-md px-3 py-2">{successMsg}</div>
            )}
          </div>
          <Dialog.Close className="absolute top-4 right-4 text-tv-text-secondary hover:text-tv-text-primary p-0.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring">
            <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l7 7M11 4l-7 7" />
            </svg>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
