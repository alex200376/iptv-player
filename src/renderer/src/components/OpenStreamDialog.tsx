import { useState } from 'react'
import { useStore } from '../stores/useStore'
import { useTranslation } from 'react-i18next'

const PROTOCOLS = ['rtmp://', 'rtsp://', 'http://', 'https://', 'mms://', 'udp://']

export default function OpenStreamDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const addDirectStream = useStore((s) => s.addDirectStream)
  const setCurrentChannel = useStore((s) => s.setCurrentChannel)

  const handlePlay = async () => {
    const trimmed = url.trim()
    if (!trimmed) { setError(t('stream.emptyError')); return }

    const hasProtocol = PROTOCOLS.some((p) => trimmed.toLowerCase().startsWith(p))
    if (!hasProtocol) { setError(t('stream.protocolError')); return }

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
      <div className="w-[90vw] max-w-[480px] bg-tv-bg-surface rounded-tv-md border border-tv-border p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-tv-base font-semibold text-tv-text-primary">{t('stream.title')}</h2>
          <button onClick={onClose} className="text-tv-text-secondary hover:text-tv-text-primary p-0.5 rounded-tv-sm">
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
            placeholder={t('stream.placeholder')}
            className="w-full px-3 py-2 bg-tv-bg border border-tv-border rounded-tv-sm text-tv-sm text-tv-text-primary placeholder-tv-text-secondary"
          />
          {error && <div className="text-tv-xs text-red-400 bg-red-900/30 border border-red-800 rounded-tv-sm px-3 py-2">{error}</div>}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 py-2 px-3 bg-tv-bg border border-tv-border hover:bg-tv-bg-surface rounded-tv-sm text-tv-sm transition-colors"
            >
              {t('stream.cancel')}
            </button>
            <button
              onClick={handlePlay}
              className="flex-1 py-2 px-3 bg-tv-accent hover:bg-tv-accent-hover rounded-tv-sm text-tv-sm font-medium transition-colors"
            >
              {t('stream.play')}
            </button>
          </div>
          <div className="text-tv-xs text-tv-text-secondary">
            {t('stream.supported')}
          </div>
        </div>
      </div>
    </div>
  )
}
