import { useCallback, useRef, useEffect } from 'react'
import { useStore } from '../stores/useStore'
import { useState } from 'react'
import { usePlayChannel } from '../hooks/usePlayChannel'
import { useTranslation } from 'react-i18next'
import LogoImg from './LogoImg'
import MarqueeText from './MarqueeText'
import type { Channel } from '../types'

export default function HistoryList() {
  const { t, i18n } = useTranslation()

  function formatTime(ts: number): string {
    const d = new Date(ts)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    if (diff < 60000) return t('history.justNow')
    if (diff < 3600000) return t('history.minutesAgo', { count: Math.floor(diff / 60000) })
    if (diff < 86400000) return t('history.hoursAgo', { count: Math.floor(diff / 3600000) })
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  const historyEntries = useStore((s) => s.historyEntries)
  const currentChannel = useStore((s) => s.currentChannel)
  const clearHistory = useStore((s) => s.clearHistory)

  const activeRef = useRef<HTMLButtonElement>(null)

  const handlePlay = usePlayChannel()

  const copyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).catch(() => {})
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, ch: any) => {
    e.preventDefault()
    window.electronAPI.showContextMenu({
      x: e.clientX,
      y: e.clientY,
      channel: ch as unknown as Record<string, unknown>,
      actions: [
        { id: 'play', label: '▶ ' + t('channel.play') },
        { id: 'copy-url', label: '📋 ' + t('channel.copyUrl') },
      ],
    })
  }, [t])

  useEffect(() => {
    const off = window.electronAPI.onContextMenuAction(({ action, channel }) => {
      const ch = channel as unknown as Channel
      switch (action) {
        case 'play':
          handlePlay(ch)
          break
        case 'copy-url':
          copyUrl(ch.url)
          break
      }
    })
    return off
  }, [handlePlay, copyUrl])

  if (historyEntries.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-tv-xs text-tv-text-secondary">
        {t('history.empty')}
      </div>
    )
  }

  return (
    <div>
      <div className="px-3 py-2 border-b border-tv-border flex items-center justify-between">
        <span className="text-tv-xs text-tv-text-secondary">{t('history.count', { count: historyEntries.length })}</span>
        <button
          onClick={clearHistory}
          className="text-tv-xs text-tv-text-secondary hover:text-red-400 transition-colors"
        >
          {t('history.clear')}
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
            <LogoImg src={entry.channel.logo} className="w-5 h-5 rounded-tv-sm object-contain flex-shrink-0" />
          ) : (
            <span className="w-5 h-5 rounded-tv-sm flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
              </svg>
            </span>
          )}
          <div className="flex-1 min-w-0">
            <MarqueeText>{entry.channel.name}</MarqueeText>
            <div className="text-tv-xs opacity-60">{formatTime(entry.watchedAt)}</div>
          </div>
        </button>
      ))}
    </div>
  )
}
