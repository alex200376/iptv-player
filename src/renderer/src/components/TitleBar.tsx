import { useEffect, useState, useCallback, useRef } from 'react'
import { Tv, Minus, Square, Copy, X } from 'lucide-react'
import { useStore } from '../stores/useStore'

interface TitleBarProps {}

export default function TitleBar(_props: TitleBarProps) {
  const [maximized, setMaximized] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const titleRef = useRef<HTMLDivElement>(null)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const currentChannel = useStore((s) => s.currentChannel)

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

  const appBrand = (
    <>
      <div className="titlebar-logo">
        <Tv className="w-3.5 h-3.5" />
      </div>
      <span className="titlebar-app-name">
        IPTV <span className="titlebar-app-name-accent">Player</span>
      </span>
    </>
  )

  const windowButtons = (
    <>
      <button
        className="titlebar-btn titlebar-ctrl-btn"
        onClick={() => window.electronAPI.minimizeWindow()}
        title="Minimize"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      <button
        className="titlebar-btn titlebar-ctrl-btn"
        onClick={() => window.electronAPI.maximizeWindow()}
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
      </button>

      <button
        className="titlebar-btn titlebar-close-btn"
        onClick={() => window.electronAPI.closeWindow()}
        title="Close"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </>
  )

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
          <div className="flex items-center gap-2 pl-2 min-w-0" style={{ WebkitAppRegion: 'no-drag' as unknown as string }}>
            {appBrand}
          </div>

          <div className="flex-1" />

          <div className="flex items-center">
            <button
              className="flex items-center justify-center w-11 h-9 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => window.electronAPI.minimizeWindow()}
              title="Minimize"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <button
              className="flex items-center justify-center w-11 h-9 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              onClick={() => window.electronAPI.maximizeWindow()}
              title={maximized ? 'Restore' : 'Maximize'}
            >
              {maximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
            </button>

            <button
              className="flex items-center justify-center w-11 h-9 text-white/60 hover:bg-red-600 hover:text-white transition-colors"
              onClick={() => window.electronAPI.closeWindow()}
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
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
        {appBrand}
      </div>

      <div className="titlebar-center">
        {currentChannel && (
          <span className="titlebar-channel truncate">{currentChannel.name}</span>
        )}
      </div>

      <div className="titlebar-right">
        {windowButtons}
      </div>
    </div>
  )
}
