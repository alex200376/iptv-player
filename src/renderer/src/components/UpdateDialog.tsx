import { useState, useEffect, useCallback, type ReactNode } from 'react'
import { useSettingsStore } from '../stores/settingsStore'

type State =
  | { phase: 'checking' }
  | { phase: 'available'; version: string; date?: string; notes?: string }
  | { phase: 'up-to-date' }
  | { phase: 'downloading'; percent: number; speed: number; total: number; transferred: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string }

function renderNotes(text: string): ReactNode[] {
  const elements: ReactNode[] = []
  let key = 0
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('### ')) {
      elements.push(<h3 key={key++} className="text-tv-sm font-bold text-tv-text-primary mt-3 mb-1">{trimmed.slice(4)}</h3>)
    } else if (trimmed.startsWith('## ')) {
      elements.push(<h2 key={key++} className="text-tv-base font-bold text-tv-text-primary mt-4 mb-1">{trimmed.slice(3)}</h2>)
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(<li key={key++} className="text-tv-xs text-tv-text-secondary ml-4 list-disc pl-1">{trimmed.slice(2)}</li>)
    } else if (trimmed === '') {
      elements.push(<div key={key++} className="h-1" />)
    } else {
      elements.push(<p key={key++} className="text-tv-xs text-tv-text-secondary">{trimmed}</p>)
    }
  }
  return elements
}

function formatEta(speed: number, remaining: number): string {
  if (speed <= 0) return ''
  const seconds = remaining / speed
  if (seconds < 60) return `剩余 ${Math.ceil(seconds)} 秒`
  if (seconds < 3600) return `剩余 ${Math.ceil(seconds / 60)} 分钟`
  return `剩余 ${(seconds / 3600).toFixed(1)} 小时`
}

export default function UpdateDialog({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ phase: 'checking' })
  const [appVersion, setAppVersion] = useState('')
  const { settings } = useSettingsStore()

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setAppVersion)
  }, [])

  useEffect(() => {
    window.electronAPI.onUpdateDownloadProgress((progress) => {
      setState({ phase: 'downloading', ...progress })
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
        setState({
          phase: 'available',
          version: result.info.version,
          date: result.info.releaseDate,
          notes: result.info.releaseNotes,
        })
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

  const handleSnooze = useCallback(() => {
    const tomorrow = Date.now() + 24 * 60 * 60 * 1000
    window.electronAPI.snoozeUpdate(tomorrow)
    onClose()
  }, [onClose])

  const handleRetry = useCallback(() => {
    setState({ phase: 'checking' })
    window.electronAPI.checkForUpdate().then((result) => {
      if (result.checking) return
      if (result.error) {
        setState({ phase: 'error', message: result.error })
      } else if (result.available && result.info) {
        setState({
          phase: 'available',
          version: result.info.version,
          date: result.info.releaseDate,
          notes: result.info.releaseNotes,
        })
      } else {
        setState({ phase: 'up-to-date' })
      }
    })
  }, [])

  const handleBackgroundDownload = useCallback(() => {
    window.electronAPI.downloadUpdate()
    onClose()
  }, [onClose])

  const isAutoDownload = settings.autoDownloadUpdates

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-[fadeIn_200ms_ease]">
      <div className="w-[90vw] max-w-[440px] bg-tv-bg-surface border border-tv-border rounded-xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-tv-border">
          <h2 className="text-tv-lg font-bold text-tv-text-primary">更新</h2>
          <button onClick={onClose} className="text-tv-text-secondary hover:text-tv-text-primary p-1 rounded transition-colors">
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
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-tv-xs text-tv-text-secondary">当前版本</p>
                  <p className="text-tv-sm text-tv-text-primary font-bold">v{appVersion}</p>
                </div>
                <svg className="w-6 h-6 text-tv-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14m-7-7l7 7-7 7" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <div className="text-center">
                  <p className="text-tv-xs text-tv-accent">最新版本</p>
                  <p className="text-tv-sm text-tv-accent font-bold">v{state.version}</p>
                </div>
              </div>
              {state.date && (
                <p className="text-tv-xs text-tv-text-secondary text-center">
                  发布于 {new Date(state.date).toLocaleDateString('zh-CN')}
                </p>
              )}
              {state.notes && (
                <div className="bg-tv-bg rounded-lg p-4 max-h-60 overflow-y-auto border border-tv-border/50 space-y-0.5">
                  {renderNotes(state.notes)}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 py-2.5 bg-tv-accent text-white text-tv-sm rounded-lg hover:bg-tv-accent-hover transition-colors"
                >
                  下载更新
                </button>
                <button
                  onClick={handleSnooze}
                  className="py-2.5 px-4 bg-tv-bg border border-tv-border text-tv-text-secondary text-tv-sm rounded-lg hover:text-tv-text-primary transition-colors"
                >
                  稍后提醒
                </button>
              </div>
            </div>
          )}

          {state.phase === 'downloading' && (
            <div className="space-y-4">
              <p className="text-tv-sm text-tv-text-primary text-center">正在下载更新...</p>
              <div className="w-full bg-tv-bg rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full bg-tv-accent rounded-full transition-all duration-300"
                  style={{ width: `${state.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-tv-xs text-tv-text-secondary">
                <span>{state.percent.toFixed(1)}%</span>
                <span>
                  {(state.transferred / 1024 / 1024).toFixed(1)} / {(state.total / 1024 / 1024).toFixed(1)} MB
                </span>
                <span>
                  {state.speed > 0 ? `${(state.speed / 1024 / 1024).toFixed(1)} MB/s` : ''}
                  {state.speed > 0 && formatEta(state.speed, state.total - state.transferred) && ` · ${formatEta(state.speed, state.total - state.transferred)}`}
                </span>
              </div>
              {!isAutoDownload && (
                <button
                  onClick={handleBackgroundDownload}
                  className="w-full py-2 text-tv-xs text-tv-accent hover:text-tv-accent-hover transition-colors"
                >
                  背景下载，关闭此窗口
                </button>
              )}
            </div>
          )}

          {state.phase === 'downloaded' && (
            <div className="text-center space-y-4">
              <svg className="w-12 h-12 mx-auto text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-tv-sm text-tv-text-primary">更新已下载完成</p>
              <p className="text-tv-xs text-tv-text-secondary">重启应用以安装 v{state.version}</p>
              <div className="flex gap-2">
                <button
                  onClick={handleInstall}
                  className="flex-1 py-2.5 bg-tv-accent text-white text-tv-sm rounded-lg hover:bg-tv-accent-hover transition-colors"
                >
                  立即重启安装
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 px-4 bg-tv-bg border border-tv-border text-tv-text-secondary text-tv-sm rounded-lg hover:text-tv-text-primary transition-colors"
                >
                  稍后
                </button>
              </div>
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
