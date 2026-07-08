import { useCallback, useRef } from 'react'
import { useStore } from '../stores/useStore'
import { useState } from 'react'
import ContextMenu from './ContextMenu'
import { usePlayChannel } from '../hooks/usePlayChannel'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

export default function HistoryList() {
  const historyEntries = useStore((s) => s.historyEntries)
  const currentChannel = useStore((s) => s.currentChannel)
  const clearHistory = useStore((s) => s.clearHistory)

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channel: any } | null>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  const handlePlay = usePlayChannel()

  const handleContextMenu = useCallback((e: React.MouseEvent, ch: any) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, channel: ch })
  }, [])

  const copyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).catch(() => {})
  }, [])

  if (historyEntries.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-tv-xs text-tv-text-secondary">
        暂无观看历史，播放频道后自动记录
      </div>
    )
  }

  return (
    <div>
      <div className="px-3 py-2 border-b border-tv-border flex items-center justify-between">
        <span className="text-tv-xs text-tv-text-secondary">共 {historyEntries.length} 条记录</span>
        <button
          onClick={clearHistory}
          className="text-tv-xs text-tv-text-secondary hover:text-red-400 transition-colors"
        >
          清除历史
        </button>
      </div>
      {historyEntries.map((entry) => (
        <button
          key={`${entry.channel.id}-${entry.watchedAt}`}
          ref={currentChannel?.id === entry.channel.id ? activeRef : undefined}
          onClick={() => handlePlay(entry.channel)}
          onContextMenu={(e) => handleContextMenu(e, entry.channel)}
          className={`channel-card w-full flex items-center gap-2.5 px-3 py-1.5 text-tv-sm text-left transition-colors ${
            currentChannel?.id === entry.channel.id
              ? 'active'
              : 'text-tv-text-secondary hover:text-tv-text-primary'
          }`}
        >
          {entry.channel.logo ? (
            <img src={entry.channel.logo} alt="" loading="lazy" className="w-5 h-5 rounded object-contain flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
          ) : (
            <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
              </svg>
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="truncate">{entry.channel.name}</div>
            <div className="text-tv-xs opacity-60">{formatTime(entry.watchedAt)}</div>
          </div>
        </button>
      ))}

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: '播放', onClick: () => handlePlay(ctxMenu.channel), icon: <PlayIcon /> },
            { label: '复制 URL', onClick: () => copyUrl(ctxMenu.channel.url), icon: <CopyIcon /> },
          ]}
        />
      )}
    </div>
  )
}

function PlayIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill="currentColor">
      <path d="M4 2.5v10l8-5z" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5.5" y="1.5" width="7" height="9" rx="1" /><path d="M1.5 5.5v7a1 1 0 001 1h7" />
    </svg>
  )
}
