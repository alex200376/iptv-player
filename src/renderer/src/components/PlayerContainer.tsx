import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useStore } from '../stores/useStore'
import EpgOverlay from './EpgOverlay'
import type { Channel, EpgProgram } from '../types'

function getCurrentProgram(programs: EpgProgram[], channelTvgId?: string): EpgProgram | null {
  const now = new Date()
  return programs.find((p) =>
    (!channelTvgId || p.channelTvgId === channelTvgId) &&
    new Date(p.start) <= now && new Date(p.stop) > now
  ) || null
}

export default function PlayerContainer() {
  const [showInfo, setShowInfo] = useState(false)
  const [showEpg, setShowEpg] = useState(false)
  const [isBuffering, setIsBuffering] = useState(true)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const currentChannel = useStore((s) => s.currentChannel)
  const setCurrentChannel = useStore((s) => s.setCurrentChannel)
  const epgCache = useStore((s) => s.epgCache)
  const loadEpg = useStore((s) => s.loadEpg)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const epgTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const tvgUrl = currentChannel?.tvgUrl
  const cachedPrograms = useMemo(() => {
    if (!currentChannel) return undefined
    if (currentChannel.tvgUrl && epgCache[currentChannel.tvgUrl]) return epgCache[currentChannel.tvgUrl] as EpgProgram[]
    if (currentChannel.tvgId) {
      for (const programs of Object.values(epgCache)) {
        if (programs.some((p) => p.channelTvgId === currentChannel.tvgId)) return programs as EpgProgram[]
      }
    }
    return undefined
  }, [currentChannel, epgCache])
  const currentProgram = useMemo(() => cachedPrograms ? getCurrentProgram(cachedPrograms, currentChannel?.tvgId) : null, [cachedPrograms, currentChannel?.tvgId])

  const handleReplay = useCallback(() => {
    if (!currentChannel) return
    setPlayerError(null)
    setIsBuffering(true)
    window.electronAPI.switchChannel(currentChannel.url)
  }, [currentChannel])

  useEffect(() => {
    window.electronAPI.onPlayerBuffering(() => {
      setIsBuffering(true)
      setPlayerError(null)
      clearTimeout(bufferTimerRef.current)
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = setTimeout(() => {
        setPlayerError('连接超时，播放无响应')
        setIsBuffering(false)
      }, 10000)
    })
    window.electronAPI.onPlayerPlaying(() => {
      clearTimeout(bufferTimerRef.current)
      clearTimeout(errorTimerRef.current)
      setPlayerError(null)
      bufferTimerRef.current = setTimeout(() => setIsBuffering(false), 600)
    })
    window.electronAPI.onPlayerError(() => {
      clearTimeout(bufferTimerRef.current)
      clearTimeout(errorTimerRef.current)
      setIsBuffering(false)
      setPlayerError('播放出错，点击重试')
    })
    return () => { clearTimeout(bufferTimerRef.current); clearTimeout(errorTimerRef.current) }
  }, [])

  useEffect(() => {
    if (currentChannel) {
      setIsBuffering(true)
      setShowInfo(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setShowInfo(false), 3000)

      clearTimeout(epgTimerRef.current)
      if (currentChannel.tvgUrl) {
        epgTimerRef.current = setTimeout(() => loadEpg(currentChannel.tvgUrl), 500)
      }
    }
    return () => { clearTimeout(timerRef.current); clearTimeout(epgTimerRef.current) }
  }, [currentChannel, loadEpg])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'g' || e.key === 'G') && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement)?.tagName
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault()
          if (currentChannel) setShowEpg((v) => !v)
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [currentChannel])

  return (
    <div className="flex-1 relative bg-black flex flex-col min-w-0">
      <div className="scanline-overlay" />
      {currentChannel && (
        <div
          className={`absolute top-0 left-0 right-0 z-10 px-4 py-2 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
            showInfo ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2">
            {currentChannel.logo && (
              <img src={currentChannel.logo} alt="" className="w-5 h-5 rounded-tv-sm object-contain" />
            )}
            <span className="text-tv-sm font-medium text-white drop-shadow">{currentChannel.name}</span>
            {currentProgram && (
              <span className="text-tv-xs text-white/60 ml-2 truncate">
                {currentProgram.title}
              </span>
            )}
            {tvgUrl && (
              <button
                onClick={() => setShowEpg(true)}
                className="ml-auto text-tv-xs text-white/50 hover:text-white/90 transition-colors px-1.5 py-0.5 rounded-tv-sm"
                title="节目表 (G)"
              >
                EPG
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 relative group" id="player-container">
        <div id="player" className="w-full h-full" />
        {isBuffering && currentChannel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <svg className="w-10 h-10 text-white/60 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {playerError && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <button
              onClick={handleReplay}
              className="flex items-center gap-2 px-5 py-2.5 bg-tv-accent/20 hover:bg-tv-accent/30 border border-tv-accent/40 rounded-tv-md text-tv-sm text-tv-accent transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 2.5v10l8-5z" />
              </svg>
              {playerError}
            </button>
          </div>
        )}
        {!currentChannel && (
          <div className="absolute inset-0 flex items-center justify-center text-tv-text-secondary select-none pointer-events-none">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
              </svg>
              <div className="text-tv-sm">导入 M3U 播放列表开始观看</div>
              <div className="text-tv-xs mt-1 opacity-60">Ctrl+I 导入 · Ctrl+B 切换频道列表</div>
            </div>
          </div>
        )}
      </div>

      {showEpg && <EpgOverlay onClose={() => setShowEpg(false)} />}
    </div>
  )
}

