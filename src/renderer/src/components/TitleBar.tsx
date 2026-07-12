import { useEffect, useState, useCallback, useRef } from 'react'

interface TitleBarProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export default function TitleBar({ sidebarOpen, onToggleSidebar }: TitleBarProps) {
  const [maximized, setMaximized] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const titleRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    window.electronAPI.isWindowMaximized().then(setMaximized)
    const offMax = window.electronAPI.onWindowMaximized(setMaximized)
    const offFs = window.electronAPI.onFullscreenChanged(setFullscreen)
    return () => { offMax(); offFs() }
  }, [])

  const handleDoubleClick = useCallback(() => {
    window.electronAPI.maximizeWindow()
  }, [])

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => {
      setShowOverlay(false)
    }, 2000)
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!fullscreen) return
    if (e.clientY < 50) {
      clearTimeout(hideTimerRef.current)
      clearTimeout(overlayTimerRef.current)
      setShowOverlay(true)
    } else if (showOverlay) {
      scheduleHide()
    }
  }, [fullscreen, showOverlay, scheduleHide])

  const handleMouseEnter = useCallback(() => {
    if (!fullscreen) return
    clearTimeout(hideTimerRef.current)
    clearTimeout(overlayTimerRef.current)
    setShowOverlay(true)
  }, [fullscreen])

  const handleMouseLeave = useCallback(() => {
    if (!fullscreen) return
    scheduleHide()
  }, [fullscreen, scheduleHide])

  useEffect(() => {
    return () => {
      clearTimeout(hideTimerRef.current)
      clearTimeout(overlayTimerRef.current)
    }
  }, [])

  if (fullscreen) {
    return (
      <div
        className="fixed top-0 left-0 right-0 z-[100]"
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          ref={titleRef}
          className={`flex items-center h-9 bg-gradient-to-b from-black/70 to-transparent backdrop-blur-sm transition-opacity duration-200 ${
            showOverlay ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          onDoubleClick={handleDoubleClick}
          style={{ WebkitAppRegion: 'drag' as unknown as string }}
        >
          <div className="flex items-center gap-1 pl-1 min-w-0" style={{ WebkitAppRegion: 'no-drag' as unknown as string }}>
            <button
              className="flex items-center justify-center w-7 h-7 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              onClick={onToggleSidebar}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-xs font-semibold text-white/80 uppercase tracking-wider ml-1 select-none">IPTV Player</span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center">
            <button
              className="flex items-center justify-center w-11 h-9 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => window.electronAPI.minimizeWindow()}
              title="Minimize"
            >
              <svg width="12" height="12" viewBox="0 0 12 1">
                <rect y="0" width="12" height="1" fill="currentColor" />
              </svg>
            </button>

            <button
              className="flex items-center justify-center w-11 h-9 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => window.electronAPI.maximizeWindow()}
              title={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="2.5" y="0.5" width="9" height="9" rx="0.5" stroke="currentColor" />
                  <rect x="0.5" y="2.5" width="9" height="9" rx="0.5" fill="transparent" stroke="currentColor" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <rect x="0.5" y="0.5" width="11" height="11" rx="1" stroke="currentColor" />
                </svg>
              )}
            </button>

            <button
              className="flex items-center justify-center w-11 h-9 text-white/60 hover:bg-red-600 hover:text-white transition-colors"
              onClick={() => window.electronAPI.closeWindow()}
              title="Close"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={titleRef}
      className="titlebar"
      onDoubleClick={handleDoubleClick}
    >
      <div className="titlebar-left">
        <button
          className="titlebar-btn titlebar-icon-btn"
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <span className="titlebar-app-name">IPTV Player</span>
      </div>

      <div className="titlebar-center" />

      <div className="titlebar-right">
        <button
          className="titlebar-btn titlebar-ctrl-btn"
          onClick={() => window.electronAPI.minimizeWindow()}
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 12 1">
            <rect y="0" width="12" height="1" fill="currentColor" />
          </svg>
        </button>

        <button
          className="titlebar-btn titlebar-ctrl-btn"
          onClick={() => window.electronAPI.maximizeWindow()}
          title={maximized ? 'Restore' : 'Maximize'}
        >
          {maximized ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="2.5" y="0.5" width="9" height="9" rx="0.5" stroke="currentColor" />
              <rect x="0.5" y="2.5" width="9" height="9" rx="0.5" fill="var(--tv-bg-secondary)" stroke="currentColor" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect x="0.5" y="0.5" width="11" height="11" rx="1" stroke="currentColor" />
            </svg>
          )}
        </button>

        <button
          className="titlebar-btn titlebar-close-btn"
          onClick={() => window.electronAPI.closeWindow()}
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
