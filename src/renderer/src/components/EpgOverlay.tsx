import { useEffect, useState, useMemo, useRef } from 'react'
import { useStore } from '../stores/useStore'
import type { EpgProgram } from '../types'

function formatEpgTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function getCurrentProgram(programs: EpgProgram[], channelTvgId?: string): EpgProgram | null {
  const now = Date.now()
  return programs.find((p) =>
    (!channelTvgId || p.channelTvgId === channelTvgId) &&
    new Date(p.start).getTime() <= now &&
    new Date(p.stop).getTime() > now
  ) || null
}

function getNextPrograms(programs: EpgProgram[], channelTvgId?: string, count = 8): EpgProgram[] {
  const now = Date.now()
  return programs.filter((p) =>
    (!channelTvgId || p.channelTvgId === channelTvgId) && new Date(p.start).getTime() > now
  ).slice(0, count)
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

export default function EpgOverlay({ onClose }: { onClose: () => void }) {
  const currentChannel = useStore((s) => s.currentChannel)
  const epgCache = useStore((s) => s.epgCache)
  const loadEpg = useStore((s) => s.loadEpg)
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef(false)

  const tvgUrl = currentChannel?.tvgUrl
  const programs = useMemo(() => {
    if (!currentChannel) return []
    return findPrograms(epgCache, tvgUrl, currentChannel.tvgId)
  }, [currentChannel, tvgUrl, epgCache])

  const current = useMemo(
    () => getCurrentProgram(programs, currentChannel?.tvgId),
    [programs, currentChannel?.tvgId],
  )

  const nextPrograms = useMemo(
    () => getNextPrograms(programs, currentChannel?.tvgId),
    [programs, currentChannel?.tvgId],
  )

  const hasData = programs.length > 0

  useEffect(() => {
    if (tvgUrl && !hasData && !loadedRef.current) {
      loadedRef.current = true
      setLoading(true)
      loadEpg(tvgUrl).finally(() => setLoading(false))
    }
  }, [tvgUrl, hasData, loadEpg])

  return (
    <div className="bg-background overflow-hidden">
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            节目表 — {currentChannel?.name || '未知'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l7 7M11 4l-7 7" />
            </svg>
          </button>
        </div>

        {loading && (
          <div className="text-center text-sm text-muted-foreground py-4">加载节目表中...</div>
        )}

        {!hasData && !loading && (
          <div className="text-center text-sm text-muted-foreground py-4">
            该频道暂无 EPG 数据
          </div>
        )}

        {current && !loading && (
          <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <div className="text-xs text-primary font-medium mb-1">正在播放</div>
            <div className="text-sm text-foreground font-medium">{current.title}</div>
            <div className="text-xs text-muted-foreground mt-1 font-mono">
              {formatEpgTime(new Date(current.start))} — {formatEpgTime(new Date(current.stop))}
            </div>
            {current.description && (
              <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{current.description}</div>
            )}
          </div>
        )}

        {nextPrograms.length > 0 && !loading && (
          <div>
            <div className="text-xs text-muted-foreground font-medium mb-2">即将播出</div>
            <div className="space-y-1.5">
              {nextPrograms.map((p, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-2.5 bg-card rounded-lg border border-border"
                >
                  <div className="text-xs text-muted-foreground whitespace-nowrap min-w-[60px] font-mono pt-0.5">
                    {formatEpgTime(new Date(p.start))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{p.title}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.description}</div>
                    )}
                  </div>
                  {p.category && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded whitespace-nowrap">
                      {p.category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
