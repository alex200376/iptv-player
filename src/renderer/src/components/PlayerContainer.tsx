import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useStore } from '../stores/useStore'
import EpgOverlay from './EpgOverlay'
import LogoImg from './LogoImg'
import type { Channel, EpgProgram } from '../types'
import { useTranslation } from 'react-i18next'

function getCurrentProgram(programs: EpgProgram[], channelTvgId?: string): EpgProgram | null {
  const now = new Date()
  return (
    programs.find(
      (p) =>
        (!channelTvgId || p.channelTvgId === channelTvgId) &&
        new Date(p.start) <= now &&
        new Date(p.stop) > now,
    ) || null
  )
}

function getNextPrograms(programs: EpgProgram[], channelTvgId?: string, count = 20): EpgProgram[] {
  const now = Date.now()
  return programs.filter((p) =>
    (!channelTvgId || p.channelTvgId === channelTvgId) && new Date(p.start).getTime() > now
  ).slice(0, count)
}

function formatTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function findPrograms(
  epgCache: Record<string, EpgProgram[]>,
  tvgUrl?: string,
  tvgId?: string,
): EpgProgram[] {
  if (tvgUrl && epgCache[tvgUrl]) return epgCache[tvgUrl]
  if (tvgId) {
    for (const programs of Object.values(epgCache)) {
      if (programs.some((p) => p.channelTvgId === tvgId)) return programs
    }
  }
  return []
}

function EpgProgressBar({ program, t }: { program: EpgProgram | null, t: (key: string, opts?: any) => string }) {
  if (!program) return null
  const start = new Date(program.start).getTime()
  const stop = new Date(program.stop).getTime()
  const now = Date.now()
  const pct = Math.min(100, Math.max(0, ((now - start) / (stop - start)) * 100))
  const elapsed = Math.floor((now - start) / 60000)
  const total = Math.floor((stop - start) / 60000)
  return (
    <div className="space-y-1">
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
        <span>{t('player.minutes', { count: elapsed })}</span>
        <span>{t('player.minutes', { count: total })}</span>
      </div>
    </div>
  )
}

export default function PlayerContainer() {
  const { t } = useTranslation()
  const [showInfo, setShowInfo] = useState(false)
  const [showEpg, setShowEpg] = useState(false)
  const [isBuffering, setIsBuffering] = useState(true)
  const [playerError, setPlayerError] = useState<string | null>(null)
  const currentChannel = useStore((s) => s.currentChannel)
  const epgCache = useStore((s) => s.epgCache)
  const loadEpg = useStore((s) => s.loadEpg)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const epgTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const bufferTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const tvgUrl = currentChannel?.tvgUrl
  const cachedPrograms = useMemo(() => {
    if (!currentChannel) return undefined
    const found = findPrograms(epgCache, tvgUrl, currentChannel.tvgId)
    return found.length > 0 ? found : undefined
  }, [currentChannel, tvgUrl, epgCache])

  const currentProgram = useMemo(
    () =>
      cachedPrograms ? getCurrentProgram(cachedPrograms, currentChannel?.tvgId) : null,
    [cachedPrograms, currentChannel?.tvgId],
  )

  const nextPrograms = useMemo(
    () => cachedPrograms ? getNextPrograms(cachedPrograms, currentChannel?.tvgId) : [],
    [cachedPrograms, currentChannel?.tvgId],
  )

  const handleReplay = useCallback(() => {
    if (!currentChannel) return
    setPlayerError(null)
    setIsBuffering(true)
    window.electronAPI.switchChannel(currentChannel.url)
  }, [currentChannel])

  useEffect(() => {
    const offBuffering = window.electronAPI.onPlayerBuffering(() => {
      setIsBuffering(true)
      setPlayerError(null)
      clearTimeout(bufferTimerRef.current)
      clearTimeout(errorTimerRef.current)
      errorTimerRef.current = setTimeout(() => {
        setPlayerError(t('player.bufferingTimeout'))
        setIsBuffering(false)
      }, 20000)
    })

    const offPlaying = window.electronAPI.onPlayerPlaying(() => {
      clearTimeout(bufferTimerRef.current)
      clearTimeout(errorTimerRef.current)
      setPlayerError(null)
      bufferTimerRef.current = setTimeout(() => setIsBuffering(false), 600)
    })

    const offError = window.electronAPI.onPlayerError(() => {
      clearTimeout(bufferTimerRef.current)
      clearTimeout(errorTimerRef.current)
      setIsBuffering(false)
      setPlayerError(t('player.playError'))
    })

    return () => {
      clearTimeout(bufferTimerRef.current)
      clearTimeout(errorTimerRef.current)
      offBuffering?.()
      offPlaying?.()
      offError?.()
    }
  }, [])

  useEffect(() => {
    if (currentChannel) {
      clearTimeout(bufferTimerRef.current)
      clearTimeout(errorTimerRef.current)
      clearTimeout(timerRef.current)

      setIsBuffering(true)
      setPlayerError(null)
      setShowInfo(true)
      timerRef.current = setTimeout(() => setShowInfo(false), 3000)

      clearTimeout(epgTimerRef.current)
      if (currentChannel.tvgUrl) {
        epgTimerRef.current = setTimeout(() => loadEpg(currentChannel.tvgUrl), 500)
      }
    }
    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(epgTimerRef.current)
    }
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

  useEffect(() => {
    window.electronAPI.notifyLayoutChange()
  }, [showEpg])

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
              <LogoImg src={currentChannel.logo} className="w-5 h-5 rounded object-contain" />
            )}
            <span className="text-sm font-medium text-white drop-shadow">
              {currentChannel.name}
            </span>
            {currentProgram && (
              <span className="text-xs text-white/60 ml-2 truncate">
                {currentProgram.title}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={`${showEpg ? 'flex-1' : 'flex-1'} relative group min-h-0`} id="player-container">
        <div id="player" className="w-full h-full" />
        {isBuffering && currentChannel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <svg
              className="w-10 h-10 text-white/60 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" strokeOpacity="0.3" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {playerError && (
          <div className="absolute inset-0 flex items-center justify-center z-20">
            <button
              onClick={handleReplay}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded-md text-sm text-primary transition-colors"
            >
              <svg
                className="w-4 h-4"
                viewBox="0 0 15 15"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 2.5v10l8-5z" />
              </svg>
              {playerError}
            </button>
          </div>
        )}
        {!currentChannel && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground select-none pointer-events-none">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
              <div className="text-sm">{t('player.empty')}</div>
              <div className="text-xs mt-1 opacity-60">{t('player.emptyHint')}</div>
            </div>
          </div>
        )}
      </div>

      {currentChannel && (
        <div className={`${showEpg ? 'flex-1 flex flex-col min-h-0' : ''} bg-card border-t border-border`}>
          <div className="px-4 pt-3 pb-2 space-y-3">
            {currentProgram && (
              <h1 className="text-lg font-bold text-foreground leading-tight">
                {currentProgram.title}
              </h1>
            )}

            <div className="flex items-center gap-3">
              {currentChannel.logo ? (
                <LogoImg
                  src={currentChannel.logo}
                  className="w-9 h-9 rounded-full object-contain flex-shrink-0 bg-background"
                />
              ) : (
                <span className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <path d="M8 21h8M12 17v4" />
                  </svg>
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground text-sm truncate">{currentChannel.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-red-500 font-bold border border-red-500/30 px-1.5 py-0.5 rounded">LIVE</span>
                </div>
              </div>
              <button
                onClick={() => setShowEpg((v) => !v)}
                className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  showEpg
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                {t('player.epgButton')}
              </button>
            </div>

            {currentProgram && (
              <div>
                <EpgProgressBar program={currentProgram} t={t} />
                {currentProgram.description && (
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                    {currentProgram.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {showEpg && (
            <div className="flex-1 min-h-0 overflow-y-auto border-t border-border">
              <EpgOverlay onClose={() => setShowEpg(false)} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
