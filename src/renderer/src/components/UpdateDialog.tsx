import { useState, useEffect, useCallback } from 'react'

type State =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string; notes?: string }
  | { phase: 'up-to-date' }
  | { phase: 'downloading'; percent: number; speed: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string }

export default function UpdateDialog({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ phase: 'checking' })
  const [appVersion, setAppVersion] = useState('')

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion)
  }, [])

  useEffect(() => {
    window.electronAPI.onUpdateDownloadProgress((progress) => {
      setState({ phase: 'downloading', percent: progress.percent, speed: progress.bytesPerSecond })
    })
    window.electronAPI.onUpdateDownloaded((info) => {
      setState({ phase: 'downloaded', version: info.version })
    })
    window.electronAPI.onUpdateStatus((text) => {
      setState({ phase: 'error', message: text })
    })
  }, [])

  useEffect(() => {
    window.electronAPI.checkForUpdate().then((result) => {
      if (result.checking) return
      if (result.error) {
        setState({ phase: 'error', message: result.error })
      } else if (result.available && result.info) {
        setState({ phase: 'available', version: result.info.version, notes: result.info.releaseNotes })
      } else {
        setState({ phase: 'up-to-date' })
      }
    })
  }, [])

  const handleDownload = useCallback(async () => {
    const result = await window.electronAPI.downloadUpdate()
    if (!result.downloading) {
      setState({ phase: 'error', message: result.error || '下载失败' })
    }
  }, [])

  const handleInstall = useCallback(() => {
    window.electronAPI.installUpdate()
  }, [])

  const handleRetry = useCallback(() => {
    setState({ phase: 'checking' })
    window.electronAPI.checkForUpdate().then((result) => {
      if (result.checking) return
      if (result.error) {
        setState({ phase: 'error', message: result.error })
      } else if (result.available && result.info) {
        setState({ phase: 'available', version: result.info.version, notes: result.info.releaseNotes })
      } else {
        setState({ phase: 'up-to-date' })
      }
    })
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-[fadeIn_200ms_ease]">
      <div className="w-[90vw] max-w-[420px] bg-tv-bg-surface border border-tv-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-tv-border">
          <h2 className="text-tv-lg font-bold text-tv-text-primary">检查更新</h2>
          <button onClick={onClose} className="text-tv-text-secondary hover:text-tv-text-primary p-1 rounded">
            <svg className="w-5 h-5" viewBox="0 0 15 15" fill="none"><path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        <div className="px-6 py-6">
          {state.phase === 'checking' && (
            <div className="flex items-center gap-3 text-tv-sm text-tv-text-secondary">
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
              正在检查更新...
            </div>
          )}

          {state.phase === 'up-to-date' && (
            <div className="text-center">
              <svg className="w-12 h-12 mx-auto mb-3 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-tv-sm text-tv-text-primary">已是最新版本</p>
              <p className="text-tv-xs text-tv-text-secondary mt-1">v{appVersion} 已为最新版</p>
            </div>
          )}

          {state.phase === 'available' && (
            <div className="space-y-4">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 text-tv-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 5v14m-7-7h14" strokeLinecap="round"/>
                </svg>
                <p className="text-tv-sm text-tv-text-primary">新版本可用</p>
                <p className="text-tv-xs text-tv-text-secondary">v{state.version}</p>
              </div>
              {state.notes && (
                <div className="bg-tv-bg rounded-lg p-3 max-h-32 overflow-y-auto text-tv-xs text-tv-text-secondary whitespace-pre-wrap">
                  {state.notes}
                </div>
              )}
              <button
                onClick={handleDownload}
                className="w-full py-2.5 bg-tv-accent text-white text-tv-sm rounded-lg hover:bg-tv-accent-hover transition-colors"
              >
                下载更新
              </button>
            </div>
          )}

          {state.phase === 'downloading' && (
            <div className="space-y-3">
              <p className="text-tv-sm text-tv-text-primary text-center">正在下载更新...</p>
              <div className="w-full bg-tv-bg rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-tv-accent rounded-full transition-all duration-300"
                  style={{ width: `${state.percent}%` }}
                />
              </div>
              <p className="text-tv-xs text-tv-text-secondary text-center">
                {state.percent.toFixed(1)}%
                {state.speed > 0 && ` · ${(state.speed / 1024 / 1024).toFixed(1)} MB/s`}
              </p>
            </div>
          )}

          {state.phase === 'downloaded' && (
            <div className="text-center space-y-4">
              <svg className="w-12 h-12 mx-auto text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-tv-sm text-tv-text-primary">更新已下载完成</p>
              <p className="text-tv-xs text-tv-text-secondary">重启应用以安装 v{state.version}</p>
              <button
                onClick={handleInstall}
                className="w-full py-2.5 bg-tv-accent text-white text-tv-sm rounded-lg hover:bg-tv-accent-hover transition-colors"
              >
                立即重启安装
              </button>
            </div>
          )}

          {state.phase === 'error' && (
            <div className="text-center space-y-4">
              <svg className="w-12 h-12 mx-auto text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01" strokeLinecap="round"/>
              </svg>
              <p className="text-tv-sm text-tv-text-primary">检查更新失败</p>
              <p className="text-tv-xs text-tv-text-secondary">{state.message}</p>
              <button
                onClick={handleRetry}
                className="w-full py-2.5 bg-tv-accent text-white text-tv-sm rounded-lg hover:bg-tv-accent-hover transition-colors"
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
