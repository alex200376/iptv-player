import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../stores/useStore'
import type { Channel, EpgProgram } from '../types'

function getCurrentProgram(programs: EpgProgram[], channelTvgId?: string): EpgProgram | null {
  const now = new Date()
  return programs.find((p) =>
    (!channelTvgId || p.channelTvgId === channelTvgId) &&
    new Date(p.start) <= now && new Date(p.stop) > now
  ) || null
}

function findProgramsForChannel(ch: Channel, epgCache: Record<string, EpgProgram[]>): EpgProgram[] | undefined {
  if (ch.tvgUrl && epgCache[ch.tvgUrl]) return epgCache[ch.tvgUrl]
  if (ch.tvgId) {
    for (const programs of Object.values(epgCache)) {
      if (programs.some((p) => p.channelTvgId === ch.tvgId)) return programs
    }
  }
  return undefined
}

function programProgress(p: EpgProgram): number {
  const now = Date.now()
  const start = new Date(p.start).getTime()
  const stop = new Date(p.stop).getTime()
  if (stop <= start) return 0
  return Math.min(100, Math.max(0, ((now - start) / (stop - start)) * 100))
}

export default function EpgPage({ onClose }: { onClose: () => void }) {
  const groups = useStore((s) => s.groups)
  const currentChannel = useStore((s) => s.currentChannel)
  const setCurrentChannel = useStore((s) => s.setCurrentChannel)
  const setIsPlaying = useStore((s) => s.setIsPlaying)
  const epgCache = useStore((s) => s.epgCache)
  const loadEpg = useStore((s) => s.loadEpg)
  const importEpgFromUrl = useStore((s) => s.importEpgFromUrl)
  const epgSources = useStore((s) => s.epgSources)
  const removeEpgSource = useStore((s) => s.removeEpgSource)
  const [importUrl, setImportUrl] = useState('')
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const fetchedRef = useRef(new Set<string>())

  const channels = useMemo(() => groups.flatMap((g) => g.channels), [groups])

  useEffect(() => {
    for (const ch of channels) {
      if (ch.tvgUrl && !fetchedRef.current.has(ch.tvgUrl) && !epgCache[ch.tvgUrl]) {
        fetchedRef.current.add(ch.tvgUrl)
        loadEpg(ch.tvgUrl)
      }
    }
  }, [channels, epgCache, loadEpg])

  const grouped = useMemo(() => {
    const map = new Map<string, Channel[]>()
    for (const ch of channels) {
      const g = ch.group || '未分组'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(ch)
    }
    return Array.from(map.entries())
  }, [channels])

  const handlePlay = async (ch: Channel) => {
    setCurrentChannel(ch)
    setIsPlaying(true)
    await window.electronAPI.switchChannel(ch.url)
    onClose()
  }

  const handleImport = async () => {
    const url = importUrl.trim()
    if (!url) return
    setImporting(true)
    setImportMsg(null)
    const result = await importEpgFromUrl(url)
    setImporting(false)
    if (result.success) {
      setImportMsg({ ok: true, text: `导入成功: ${result.count} 条节目数据` })
      setImportUrl('')
    } else {
      setImportMsg({ ok: false, text: result.error || '导入失败' })
    }
  }

  return (
    <div className="h-full flex flex-col bg-tv-bg-surface">
      <div className="flex items-center justify-between px-8 py-5 border-b border-tv-border shrink-0">
        <h2 className="text-tv-lg font-bold text-tv-text-primary">节目指南</h2>
        <button
          onClick={onClose}
          className="text-tv-text-secondary hover:text-tv-text-primary p-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
        >
          <svg className="w-6 h-6" viewBox="0 0 15 15" fill="none">
            <path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="px-8 py-4 border-b border-tv-border bg-tv-bg/30 shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={importUrl}
            onChange={(e) => setImportUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleImport()}
            placeholder="粘贴 EPG (XMLTV) 链接..."
            disabled={importing}
            className="flex-1 px-3 py-2 bg-tv-bg border border-tv-border rounded-lg text-tv-sm text-tv-text-primary placeholder-tv-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
          />
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-4 py-2 bg-tv-accent text-white text-tv-sm rounded-lg hover:bg-tv-accent-hover transition-colors disabled:opacity-50"
          >
            {importing ? '导入中...' : '导入'}
          </button>
        </div>
        {importMsg && (
          <p className={`mt-2 text-tv-xs ${importMsg.ok ? 'text-green-500' : 'text-red-400'}`}>
            {importMsg.text}
          </p>
        )}
        {epgSources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {epgSources.map((es) => (
              <div
                key={es.url}
                className="flex items-center gap-1 px-2 py-0.5 bg-tv-bg border border-tv-border rounded text-tv-xs text-tv-text-secondary"
              >
                <span className="truncate max-w-[200px]">{es.url}</span>
                <button
                  onClick={() => removeEpgSource(es.url)}
                  className="text-tv-text-secondary hover:text-red-400 transition-colors"
                >
                  <svg className="w-3 h-3" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M4 4l7 7M11 4l-7 7" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-tv-sm text-tv-text-secondary">
            暂无频道
          </div>
        ) : (
          grouped.map(([groupName, chs]) => (
            <div key={groupName}>
              <div className="sticky top-0 bg-tv-bg-secondary px-8 py-2 text-tv-xs text-tv-text-secondary font-medium border-b border-tv-border z-10">
                {groupName}
              </div>
              {chs.map((ch) => {
                const cached = findProgramsForChannel(ch, epgCache)
                const current = cached ? getCurrentProgram(cached, ch.tvgId) : null
                const next = cached
                  ? cached.find((p) => p.channelTvgId === ch.tvgId && new Date(p.start) > new Date())
                  : null
                const isActive = ch.id === currentChannel?.id
                return (
                  <button
                    key={ch.id}
                    onClick={() => handlePlay(ch)}
                    className={`w-full flex items-start gap-3 px-8 py-3 text-left transition-colors border-b border-tv-border/50 ${
                      isActive
                        ? 'bg-tv-accent/15 border-l-2 border-l-tv-accent'
                        : 'hover:bg-tv-bg-surface border-l-2 border-l-transparent'
                    }`}
                  >
                    {ch.logo && (
                      <img src={ch.logo} alt="" className="w-7 h-7 mt-0.5 rounded object-contain shrink-0" loading="lazy" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-tv-sm ${isActive ? 'text-tv-accent font-medium' : 'text-tv-text-primary'}`}>
                        {ch.name}
                      </div>
                      {current && (
                        <div className="mt-1">
                          <div className="text-tv-xs text-tv-accent/80 font-medium truncate">{current.title}</div>
                          <div className="text-tv-xs text-tv-text-secondary">
                            {formatTime(current.start)} — {formatTime(current.stop)}
                          </div>
                          <div className="mt-1 h-1 bg-tv-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-tv-accent/60 rounded-full transition-[width] duration-500"
                              style={{ width: `${programProgress(current)}%` }}
                            />
                          </div>
                        </div>
                      )}
                      {next && (
                        <div className="mt-1.5 text-tv-xs text-tv-text-secondary/70">
                          下一步: {next.title} — {formatTime(next.start)}
                        </div>
                      )}
                    </div>
                    {current && (
                      <span className="shrink-0 self-start mt-1.5 px-2 py-0.5 rounded text-tv-xs bg-tv-accent/10 text-tv-accent/80 font-medium">
                        直播中
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function formatTime(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d)
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
}
