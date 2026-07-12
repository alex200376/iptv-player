import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useStore } from '../stores/useStore'
import EpgOverlay from './EpgOverlay'
import LogoImg from './LogoImg'
import MarqueeText from './MarqueeText'
import type { Channel, EpgProgram } from '../types'
import { useTranslation } from 'react-i18next'

// ─── constants ──────────────────────────────────────────────────────────────
const INFO_HIDE_MS = 3000
const EPG_LOAD_DELAY_MS = 500
const BUFFERING_GRACE_MS = 1500
const BUFFER_TIMEOUT_MS = 20000
const MAX_RETRIES = 5
// Reduced debounce so layout change is notified faster after EPG toggle
const LAYOUT_NOTIFY_DELAY_MS = 50

// ─── helpers ────────────────────────────────────────────────────────────────
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
    <div className="w-full">
      <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
        <span>{t('player.minutes', { count: elapsed })}</span>
        <span>{t('player.minutes', { count: total })}</span>
      </div>
    </div>
  )
}

// ─── main component ─────────────────────────────────────────────────────────
export default function PlayerContainer() {
  const { t } = useTranslation()

  const currentChannel = useStore((s) => s.currentChannel)
  const epgCache = useStore((s) => s.epgCache)
  const loadEpg = useStore((s) => s.loadEpg)

  const [showInfo, setShowInfo] = useState(false)
  const [showEpg, setShowEpg] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [playerError, setPlayerError] = useState<string | null>(null)
  // Track PiP state so reconnects don't destroy it
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
  const playerContainerRef = useRef<HTMLDivElement>(null)

  const clearAllTimers = useCallback(() => {
    clearTimeout(timerRef.current)
    clearTimeout(epgTimerRef.current)
    clearTimeout(bufferGraceRef.current)
    clearTimeout(bufferTimeoutRef.current)
    clearTimeout(errorTimerRef.current)
    clearTimeout(reconnectTimerRef.current)
    clearTimeout(layoutDebounceRef.current)
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

  // ── load settings on mount ────────────────────────────────────────────────
  useEffect(() => {
    window.electronAPI.getSettings().then((s: any) => {
      if (!s) return
      settingsRef.current = {
        autoReconnect: s.autoReconnect ?? true,
        reconnectInterval: Math.max(500, s.reconnectInterval ?? 2000),
      }
    })
  }, [])

  // ── track PiP state ───────────────────────────────────────────────────────
  useEffect(() => {
    const off = window.electronAPI.onPipStateChange((active: boolean) => {
      pipActiveRef.current = active
    })
    return () => {
      if (typeof off === 'function') off()
    }
  }, [])

  // ── player IPC events ─────────────────────────────────────────────────────
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
            // Reconnect: if PiP is active, keep the same stream reconnecting
            // without toggling PiP (avoids closing the PiP window)
            if (pipActiveRef.current) {
              // Toggle PiP off then re-switch then toggle back
              window.electronAPI.switchChannel(ch.url)
            } else {
              window.electronAPI.switchChannel(ch.url)
            }
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

  // ── channel change effect ─────────────────────────────────────────────────
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

  // ── keyboard shortcut: G → toggle EPG ────────────────────────────────────
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

  // ── notify VLC instantly when EPG panel toggles or container resizes ──────
  // Using both ResizeObserver (catches any size change) and a direct call
  // on showEpg toggle to ensure the layout update fires immediately.
  useEffect(() => {
    // Fire immediately on EPG toggle so VLC resizes without waiting for
    // the ResizeObserver debounce cycle.
    clearTimeout(layoutDebounceRef.current)
    window.electronAPI.notifyLayoutChange()
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

  // ── cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => clearAllTimers()
  }, [clearAllTimers])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div ref={playerContainerRef} className="flex flex-col w-full h-full overflow-hidden">
      {currentChannel && (
        <div
          className={`absolute top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${
            showInfo ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {currentChannel.logo && (
            <LogoImg src={currentChannel.logo} alt={currentChannel.name} className="w-8 h-8 rounded object-contain flex-shrink-0" />
          )}
          <span className="font-semibold text-white text-sm truncate">{currentChannel.name}</span>
          {currentProgram && (
            <>
              <span className="text-white/50 text-xs">·</span>
              <span className="text-white/80 text-xs truncate">{currentProgram.title}</span>
            </>
          )}
        </div>
      )}

      {/* Player area — flex-1 + min-h-0 ensures it fills remaining space and
          shrinks correctly when the EPG panel opens below it */}
      <div id="player-container" className="flex-1 min-h-0 relative overflow-hidden">
        <div id="player" />
        <div className="scanline-overlay" />

        {isBuffering && currentChannel && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 z-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {playerError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 z-20 gap-3 px-6">
            <span className="text-red-400 text-sm text-center">{playerError}</span>
            <button
              onClick={handleReplay}
              className="px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs hover:bg-primary/80 transition-colors"
            >
              {t('player.retry')}
            </button>
          </div>
        )}
        {!currentChannel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <p className="text-muted-foreground text-sm">{t('player.empty')}</p>
            <p className="text-muted-foreground/60 text-xs">{t('player.emptyHint')}</p>
          </div>
        )}
      </div>

      {/* Bottom info/EPG panel — flex-shrink-0 prevents it from eating into the player */}
      {currentChannel && (
        <div className="flex-shrink-0 border-t border-border bg-card">
          {currentProgram && (
            <div className="px-4 pt-2">
              <EpgProgressBar program={currentProgram} t={t} />
            </div>
          )}

          <div className="flex items-center gap-2 px-4 py-2">
            {currentChannel.logo ? (
              <LogoImg src={currentChannel.logo} alt={currentChannel.name} className="w-6 h-6 rounded object-contain flex-shrink-0" />
            ) : (
              <div className="w-6 h-6 rounded bg-muted flex-shrink-0" />
            )}
            <MarqueeText text={currentChannel.name} className="flex-1 font-medium text-sm min-w-0" />
            <span className="live-dot flex-shrink-0" />
            <span className="text-xs text-muted-foreground font-mono flex-shrink-0">LIVE</span>
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
            <div className="px-4 pb-2">
              {currentProgram.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{currentProgram.description}</p>
              )}
            </div>
          )}

          {showEpg && (
            <div className="border-t border-border">
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
