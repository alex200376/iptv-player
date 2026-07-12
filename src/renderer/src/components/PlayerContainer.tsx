import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useStore } from '../stores/useStore'
import EpgOverlay from './EpgOverlay'
import LogoImg from './LogoImg'
import MarqueeText from './MarqueeText'
import type { Channel, EpgProgram } from '../types'
import { useTranslation } from 'react-i18next'

// constants
const INFO_HIDE_MS = 3000
const EPG_LOAD_DELAY_MS = 500
const BUFFERING_GRACE_MS = 1500
const BUFFER_TIMEOUT_MS = 20000
const MAX_RETRIES = 5
const LAYOUT_NOTIFY_DELAY_MS = 50

// helpers
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
  return programs
    .filter(
      (p) =>
        (!channelTvgId || p.channelTvgId === channelTvgId) &&
        new Date(p.start).getTime() > now,
    )
    .slice(0, count)
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

function EpgProgressBar({
  program,
  t,
}: {
  program: EpgProgram | null
  t: (key: string, opts?: any) => string
}) {
  if (!program) return null
  const start = new Date(program.start).getTime()
  const stop = new Date(program.stop).getTime()
  const now = Date.now()
  const pct = Math.min(100, Math.max(0, ((now - start) / (stop - start)) * 100))
  const elapsed = Math.floor((now - start) / 60000)
  const total = Math.floor((stop - start) / 60000)
  return (
    <div className="w-full flex flex-col gap-0.5">
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{t('player.minutes', { count: elapsed })}</span>
        &nbsp;
        <span>{t('player.minutes', { count: total })}</span>
      </div>
    </div>
  )
}

// main component
export default function PlayerContainer() {
  const { t } = useTranslation()
  const currentChannel = useStore((s) => s.currentChannel)
  const epgCache = useStore((s) => s.epgCache)
  const loadEpg = useStore((s) => s.loadEpg)

  const [showInfo, setShowInfo] = useState(false)
  const [showEpg, setShowEpg] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)

  const pipActiveRef = useRef(false)
  const settingsRef = useRef<{ autoReconnect: boolean; reconnectInterval: number }>({
    autoReconnect: true,
    reconnectInterval: 2000,
  })

  const switchTokenRef = useRef(0)
  const retryCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()
  const epgTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const bufferGraceRef = useRef<ReturnType<typeof setTimeout>>()
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const errorTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const layoutDebounceRef = useRef<ReturnType<typeof setTimeout>>()
  const rafRef = useRef<number>()
  const playerContainerRef = useRef<HTMLDivElement>(null)

  const clearAllTimers = useCallback(() => {
    clearTimeout(timerRef.current)
    clearTimeout(epgTimerRef.current)
    clearTimeout(bufferGraceRef.current)
    clearTimeout(bufferTimeoutRef.current)
    clearTimeout(errorTimerRef.current)
    clearTimeout(reconnectTimerRef.current)
    clearTimeout(layoutDebounceRef.current)
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
  }, [])

  const tvgUrl = currentChannel?.tvgUrl
  const cachedPrograms = useMemo(() => {
    if (!currentChannel) return undefined
    const found = findPrograms(epgCache, tvgUrl, currentChannel.tvgId)
    return found.length > 0 ? found : undefined
  }, [currentChannel, tvgUrl, epgCache])

  const currentProgram = useMemo(
    () => (cachedPrograms ? getCurrentProgram(cachedPrograms, currentChannel?.tvgId) : null),
    [cachedPrograms, currentChannel?.tvgId],
  )

  const nextPrograms = useMemo(
    () => (cachedPrograms ? getNextPrograms(cachedPrograms, currentChannel?.tvgId) : []),
    [cachedPrograms, currentChannel?.tvgId],
  )
  void nextPrograms

  const handleReplay = useCallback(() => {
    if (!currentChannel) return
    switchTokenRef.current += 1
    retryCountRef.current = 0
    setPlayerError(null)
    setIsBuffering(false)
    window.electronAPI.switchChannel(currentChannel.url)
  }, [currentChannel])

  useEffect(() => {
    window.electronAPI.getSettings().then((s: any) => {
      if (!s) return
      settingsRef.current = {
        autoReconnect: s.autoReconnect ?? true,
        reconnectInterval: Math.max(500, s.reconnectInterval ?? 2000),
      }
    })
  }, [])

  useEffect(() => {
    const off = window.electronAPI.onPipStateChange((active: boolean) => {
      pipActiveRef.current = active
    })
    return () => {
      if (typeof off === 'function') off()
    }
  }, [])

  useEffect(() => {
    const offBuffering = window.electronAPI.onPlayerBuffering(() => {
      const token = switchTokenRef.current
      clearTimeout(bufferGraceRef.current)
      clearTimeout(bufferTimeoutRef.current)
      clearTimeout(errorTimerRef.current)

      bufferGraceRef.current = setTimeout(() => {
        if (switchTokenRef.current !== token) return
        setIsBuffering(true)
        setPlayerError(null)
      }, BUFFERING_GRACE_MS)

      bufferTimeoutRef.current = setTimeout(() => {
        if (switchTokenRef.current !== token) return
        setPlayerError(t('player.bufferingTimeout'))
        setIsBuffering(false)

        const { autoReconnect, reconnectInterval } = settingsRef.current
        if (autoReconnect && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1
          reconnectTimerRef.current = setTimeout(() => {
            if (switchTokenRef.current !== token) return
            const ch = useStore.getState().currentChannel
            if (!ch) return
            setPlayerError(null)
            setIsBuffering(false)
            // Fix Bug 2: preserve PiP during reconnect
            // Exit PiP first, reconnect, then restore PiP once playing fires
            if (pipActiveRef.current) {
              window.electronAPI.togglePip()
              pipActiveRef.current = false
              ;(pipActiveRef as any)._pendingRestore = true
            }
            window.electronAPI.switchChannel(ch.url)
          }, reconnectInterval)
        }
      }, BUFFER_TIMEOUT_MS)
    })

    const offPlaying = window.electronAPI.onPlayerPlaying(() => {
      const token = switchTokenRef.current
      if (switchTokenRef.current !== token) return
      clearTimeout(bufferGraceRef.current)
      clearTimeout(bufferTimeoutRef.current)
      clearTimeout(errorTimerRef.current)
      clearTimeout(reconnectTimerRef.current)
      retryCountRef.current = 0
      setPlayerError(null)
      setIsBuffering(false)
      // Restore PiP if it was active before reconnect
      if ((pipActiveRef as any)._pendingRestore) {
        ;(pipActiveRef as any)._pendingRestore = false
        setTimeout(() => window.electronAPI.togglePip(), 300)
      }
    })

    const offError = window.electronAPI.onPlayerError(() => {
      const token = switchTokenRef.current
      clearTimeout(bufferGraceRef.current)
      clearTimeout(bufferTimeoutRef.current)
      clearTimeout(errorTimerRef.current)
      clearTimeout(reconnectTimerRef.current)
      setIsBuffering(false)

      errorTimerRef.current = setTimeout(() => {
        if (switchTokenRef.current !== token) return
        setPlayerError(t('player.playError'))

        const { autoReconnect, reconnectInterval } = settingsRef.current
        if (autoReconnect && retryCountRef.current < MAX_RETRIES) {
          retryCountRef.current += 1
          reconnectTimerRef.current = setTimeout(() => {
            if (switchTokenRef.current !== token) return
            const ch = useStore.getState().currentChannel
            if (!ch) return
            setPlayerError(null)
            setIsBuffering(false)
            if (pipActiveRef.current) {
              window.electronAPI.togglePip()
              pipActiveRef.current = false
              ;(pipActiveRef as any)._pendingRestore = true
            }
            window.electronAPI.switchChannel(ch.url)
          }, reconnectInterval)
        }
      }, 800)
    })

    return () => {
      offBuffering?.()
      offPlaying?.()
      offError?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t])

  useEffect(() => {
    if (!currentChannel) return
    switchTokenRef.current += 1
    const token = switchTokenRef.current
    retryCountRef.current = 0
    clearAllTimers()
    setIsBuffering(false)
    setPlayerError(null)
    setShowInfo(true)

    timerRef.current = setTimeout(() => {
      if (switchTokenRef.current !== token) return
      setShowInfo(false)
    }, INFO_HIDE_MS)

    if (currentChannel.tvgUrl) {
      epgTimerRef.current = setTimeout(() => {
        if (switchTokenRef.current !== token) return
        loadEpg(currentChannel.tvgUrl!)
      }, EPG_LOAD_DELAY_MS)
    }

    return () => {
      clearTimeout(timerRef.current)
      clearTimeout(epgTimerRef.current)
    }
  }, [currentChannel, loadEpg, clearAllTimers])

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

  // Fix Bug 1: use double-rAF so VLC resizes only after DOM has fully painted
  useEffect(() => {
    clearTimeout(layoutDebounceRef.current)
    if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => {
        window.electronAPI.notifyLayoutChange()
      })
    })
  }, [showEpg])

  useEffect(() => {
    const el = playerContainerRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      clearTimeout(layoutDebounceRef.current)
      layoutDebounceRef.current = setTimeout(() => {
        window.electronAPI.notifyLayoutChange()
      }, LAYOUT_NOTIFY_DELAY_MS)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => clearAllTimers()
  }, [clearAllTimers])

  return (
    <div className="flex flex-col h-full">
      {currentChannel && (
        <div
          className={`flex items-center gap-2 px-3 py-2 text-sm transition-opacity duration-300 ${
            showInfo ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {currentChannel.logo && (
            <LogoImg src={currentChannel.logo} alt={currentChannel.name} className="h-5 w-auto" />
          )}
          &nbsp;
          <span className="font-medium truncate">{currentChannel.name}</span>
          &nbsp;
          {currentProgram && (
            <>
              &nbsp;&middot;&nbsp;
              <span className="text-muted-foreground truncate">{currentProgram.title}</span>
            </>
          )}
        </div>
      )}

      {/* Player area - flex-1 + min-h-0 ensures it fills remaining space and shrinks correctly */}
      <div ref={playerContainerRef} className="flex-1 min-h-0 relative bg-black">
        {isBuffering && currentChannel && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary" />
          </div>
        )}
        {playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-10 text-center px-4">
            <span className="text-destructive text-sm">{playerError}</span>
            <button
              onClick={handleReplay}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/90 transition-colors"
            >
              &nbsp;{t('player.retry')}
            </button>
          </div>
        )}
        {!currentChannel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <p className="text-sm">{t('player.empty')}</p>
            <p className="text-xs">{t('player.emptyHint')}</p>
          </div>
        )}
      </div>

      {/* Bottom info/EPG panel - flex-shrink-0 prevents it from eating into the player */}
      {currentChannel && (
        <div className="flex-shrink-0 flex flex-col gap-1 px-3 pt-2 pb-1">
          {currentProgram && (
            <EpgProgressBar program={currentProgram} t={t} />
          )}

          <div className="flex items-center gap-2 min-w-0">
            {currentChannel.logo ? (
              <LogoImg src={currentChannel.logo} alt={currentChannel.name} className="h-5 w-auto flex-shrink-0" />
            ) : (
              <div className="h-5 w-5 rounded bg-muted flex-shrink-0" />
            )}
            &nbsp;
            <span className="text-xs font-semibold text-red-500 flex-shrink-0">LIVE</span>
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
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium truncate">{currentProgram.title}</span>
              {currentProgram.description && (
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {currentProgram.description}
                </span>
              )}
            </div>
          )}

          {showEpg && (
            <div className="mt-1">
              <EpgOverlay
                programs={cachedPrograms || []}
                currentProgram={currentProgram}
                channel={currentChannel}
                onClose={() => setShowEpg(false)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
