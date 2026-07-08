import { useEffect, useState, useMemo, useRef } from 'react'
import { useStore } from '../stores/useStore'
import type { Channel, EpgProgram } from '../types'

function formatEpgTime(d: Date): string {
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function parsePrograms(raw: any[]): EpgProgram[] {
  return raw.map((p) => ({
    ...p,
    start: new Date(p.start),
    stop: new Date(p.stop),
  }))
}

function getCurrentProgram(programs: EpgProgram[], channelTvgId?: string): EpgProgram | null {
  const now = new Date()
  return programs.find((p) =>
    (!channelTvgId || p.channelTvgId === channelTvgId) &&
    p.start <= now && p.stop > now
  ) || null
}

function getNextPrograms(programs: EpgProgram[], channelTvgId?: string, count = 8): EpgProgram[] {
  const now = new Date()
  return programs.filter((p) =>
    (!channelTvgId || p.channelTvgId === channelTvgId) && p.start > now
  ).slice(0, count)
}

export default function EpgOverlay({ onClose }: { onClose: () => void }) {
  const currentChannel = useStore((s) => s.currentChannel)
  const epgCache = useStore((s) => s.epgCache)
  const loadEpg = useStore((s) => s.loadEpg)
  const importEpgFromUrl = useStore((s) => s.importEpgFromUrl)
  const epgSources = useStore((s) => s.epgSources)
  const [loading, setLoading] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showImport, setShowImport] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const tvgUrl = currentChannel?.tvgUrl
  const cached = useMemo(() => {
    if (!currentChannel) return undefined
    if (currentChannel.tvgUrl && epgCache[currentChannel.tvgUrl]) return epgCache[currentChannel.tvgUrl]
    if (currentChannel.tvgId) {
      for (const programs of Object.values(epgCache)) {
        if (programs.some((p) => p.channelTvgId === currentChannel.tvgId)) return programs
      }
    }
    return undefined
  }, [currentChannel, epgCache])
  const programs = useMemo(() => cached ? parsePrograms(cached) : [], [cached])
  const current = useMemo(() => getCurrentProgram(programs, currentChannel?.tvgId), [programs, currentChannel?.tvgId])
  const nextPrograms = useMemo(() => getNextPrograms(programs, currentChannel?.tvgId), [programs, currentChannel?.tvgId])

  useEffect(() => {
    if (tvgUrl && !cached) {
      setLoading(true)
      loadEpg(tvgUrl).finally(() => setLoading(false))
    }
  }, [tvgUrl, cached, loadEpg])

  const handleImport = async () => {
    const url = importUrl.trim()
    if (!url) return
    setImportMsg(null)
    const result = await importEpgFromUrl(url)
    if (result.success) {
      setImportMsg({ ok: true, text: `导入成功: ${result.count} 条节目数据` })
      setImportUrl('')
      setShowImport(false)
    } else {
      setImportMsg({ ok: false, text: result.error || '导入失败' })
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 animate-[fadeIn_150ms_ease]"
      onClick={onClose}
    >
      <div
        className="w-[90vw] max-w-[600px] max-h-[80vh] bg-tv-bg-surface border border-tv-border rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-tv-border">
          <h2 className="text-tv-base font-semibold text-tv-text-primary">
            节目表 — {currentChannel?.name || '未知'}
          </h2>
          <div className="flex items-center gap-2">
            {!showImport && (
              <button
                onClick={() => { setShowImport(true); setTimeout(() => inputRef.current?.focus(), 50) }}
                className="text-tv-xs text-tv-accent hover:text-tv-accent-hover px-2 py-1 rounded transition-colors"
              >
                + 导入 EPG
              </button>
            )}
            <button
              onClick={onClose}
              className="text-tv-text-secondary hover:text-tv-text-primary p-1 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
            >
              <svg className="w-5 h-5" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 4l7 7M11 4l-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {showImport && (
          <div className="px-6 py-3 border-b border-tv-border bg-tv-bg/50">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleImport()}
                placeholder="粘贴 EPG (XMLTV) 链接..."
                className="flex-1 px-3 py-1.5 bg-tv-bg border border-tv-border rounded-md text-tv-sm text-tv-text-primary placeholder-tv-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
              />
              <button
                onClick={handleImport}
                className="px-3 py-1.5 bg-tv-accent text-white text-tv-sm rounded-md hover:bg-tv-accent-hover transition-colors"
              >
                导入
              </button>
              <button
                onClick={() => { setShowImport(false); setImportUrl(''); setImportMsg(null) }}
                className="px-3 py-1.5 text-tv-xs text-tv-text-secondary hover:text-tv-text-primary transition-colors"
              >
                取消
              </button>
            </div>
            {importMsg && (
              <p className={`mt-2 text-tv-xs ${importMsg.ok ? 'text-green-500' : 'text-red-400'}`}>
                {importMsg.text}
              </p>
            )}
          </div>
        )}

        <div className="p-6 overflow-y-auto max-h-[calc(80vh-64px)]">
          {epgSources.length > 0 && !showImport && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {epgSources.map((es) => (
                <button
                  key={es.url}
                  onClick={() => { setImportUrl(es.url); setShowImport(true) }}
                  className="text-tv-xs text-tv-text-secondary bg-tv-bg border border-tv-border px-2 py-0.5 rounded hover:text-tv-accent transition-colors truncate max-w-[200px]"
                  title={es.url}
                >
                  {es.url.length > 30 ? es.url.slice(0, 27) + '...' : es.url}
                </button>
              ))}
            </div>
          )}

          {loading && (
            <div className="text-center text-tv-sm text-tv-text-secondary py-8">加载节目表中...</div>
          )}

          {!loading && !tvgUrl && (
            <div className="text-center text-tv-sm text-tv-text-secondary py-8">
              该频道暂无 EPG 数据
            </div>
          )}

          {!loading && tvgUrl && programs.length === 0 && (
            <div className="text-center text-tv-sm text-tv-text-secondary py-8">
              未获取到节目数据
            </div>
          )}

          {current && (
            <div className="mb-6 p-4 bg-tv-accent/10 border border-tv-accent/30 rounded-lg">
              <div className="text-tv-xs text-tv-accent font-medium mb-1">正在播放</div>
              <div className="text-tv-sm text-tv-text-primary font-medium">{current.title}</div>
              <div className="text-tv-xs text-tv-text-secondary mt-1">
                {formatEpgTime(current.start)} — {formatEpgTime(current.stop)}
              </div>
              {current.description && (
                <div className="text-tv-xs text-tv-text-secondary mt-2 line-clamp-2">{current.description}</div>
              )}
            </div>
          )}

          {nextPrograms.length > 0 && (
            <div>
              <div className="text-tv-xs text-tv-text-secondary font-medium mb-3">即将播出</div>
              <div className="space-y-2">
                {nextPrograms.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-tv-bg rounded-lg border border-tv-border"
                  >
                    <div className="text-tv-xs text-tv-text-secondary whitespace-nowrap min-w-[70px]">
                      {formatEpgTime(p.start)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-tv-sm text-tv-text-primary truncate">{p.title}</div>
                      {p.description && (
                        <div className="text-tv-xs text-tv-text-secondary mt-0.5 line-clamp-1">{p.description}</div>
                      )}
                    </div>
                    {p.category && (
                      <span className="text-tv-xs text-tv-text-secondary bg-tv-bg-surface px-2 py-0.5 rounded whitespace-nowrap">
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
    </div>
  )
}
