import { useState } from 'react'
import { useStore } from '../stores/useStore'

const PROTOCOLS = ['rtmp://', 'rtsp://', 'http://', 'https://', 'mms://', 'udp://']

export default function OpenStreamDialog({ onClose }: { onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const addDirectStream = useStore((s) => s.addDirectStream)
  const setCurrentChannel = useStore((s) => s.setCurrentChannel)

  const handlePlay = async () => {
    const trimmed = url.trim()
    if (!trimmed) { setError('请输入流地址'); return }

    const hasProtocol = PROTOCOLS.some((p) => trimmed.toLowerCase().startsWith(p))
    if (!hasProtocol) { setError('地址需以 rtmp://, rtsp:// 或 http:// 开头'); return }

    setError('')
    const state = useStore.getState()
    if (state.settingsOpen) {
      state.setSettingsOpen(false)
      await new Promise((r) => setTimeout(r, 16))
    }
    const result = await window.electronAPI.switchChannel(trimmed)
    if (!result.success) { setError(result.error); return }
    const channel = addDirectStream(trimmed)
    setCurrentChannel(channel)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-[fadeIn_150ms_ease]">
      <div className="w-[90vw] max-w-[480px] bg-tv-bg-surface rounded-lg border border-tv-border p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-tv-base font-semibold text-tv-text-primary">打开网络流</h2>
          <button onClick={onClose} className="text-tv-text-secondary hover:text-tv-text-primary p-0.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring">
            <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l7 7M11 4l-7 7" />
            </svg>
          </button>
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
            placeholder="rtmp:// 或 rtsp:// 或 http://..."
            className="w-full px-3 py-2 bg-tv-bg border border-tv-border rounded-md text-tv-sm text-tv-text-primary placeholder-tv-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
          />
          {error && <div className="text-tv-xs text-red-400 bg-red-900/30 border border-red-800 rounded-md px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-3 bg-tv-bg border border-tv-border hover:bg-tv-bg-surface rounded-md text-tv-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
            >
              取消
            </button>
            <button
              onClick={handlePlay}
              className="flex-1 py-2 px-3 bg-tv-accent hover:bg-tv-accent-hover rounded-md text-tv-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
            >
              播放
            </button>
          </div>
          <div className="text-tv-xs text-tv-text-secondary">
            支持: RTMP, RTSP, HLS (.m3u8), HTTP Live, UDP 多播
          </div>
        </div>
      </div>
    </div>
  )
}
