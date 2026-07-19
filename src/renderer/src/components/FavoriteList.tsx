import { useCallback, useMemo, useRef, useEffect } from 'react'
import { useStore } from '../stores/useStore'
import { useState } from 'react'
import MarqueeText from './MarqueeText'
import { usePlayChannel } from '../hooks/usePlayChannel'
import LogoImg from './LogoImg'
import { useTranslation } from 'react-i18next'
import type { Channel } from '../types'

export default function FavoriteList() {
  const { t } = useTranslation()
  const groups = useStore((s) => s.groups)
  const favoriteIds = useStore((s) => s.favoriteIds)
  const currentChannel = useStore((s) => s.currentChannel)
  const toggleFavorite = useStore((s) => s.toggleFavorite)

  const activeRef = useRef<HTMLButtonElement>(null)

  const favoriteChannels = useMemo(() => {
    if (favoriteIds.length === 0) return []
    const allChannels = groups.flatMap((g) => g.channels)
    return allChannels.filter((ch) => favoriteIds.includes(ch.id))
  }, [groups, favoriteIds])

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
        { separator: true, label: '' },
        { id: 'unfavorite', label: '★ ' + t('channel.unfavorite'), danger: true },
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
        case 'unfavorite':
          toggleFavorite(ch.id)
          break
      }
    })
    return off
  }, [handlePlay, copyUrl, toggleFavorite])

  if (favoriteChannels.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-tv-xs text-tv-text-secondary">
        {t('favorites.empty')}
      </div>
    )
  }

  return (
    <div>
      {favoriteChannels.map((ch) => (
        <button
          key={ch.id}
          ref={currentChannel?.id === ch.id ? activeRef : undefined}
          onClick={() => handlePlay(ch)}
          onContextMenu={(e) => handleContextMenu(e, ch)}
          className={`channel-card w-full flex items-center gap-2.5 px-3 py-1.5 text-tv-sm text-left transition-colors min-w-0 overflow-hidden ${
            currentChannel?.id === ch.id
              ? 'active'
              : 'text-tv-text-secondary hover:text-tv-text-primary'
          }`}
        >
          {ch.logo ? (
            <LogoImg src={ch.logo} className="w-5 h-5 rounded-tv-sm object-contain flex-shrink-0" />
          ) : (
            <span className="w-5 h-5 rounded-tv-sm flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
              </svg>
            </span>
          )}
          <MarqueeText className="flex-1">{ch.name}</MarqueeText>
          <span className="flex-shrink-0 text-tv-accent">
            <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill="currentColor">
              <path d="M7.5 1.5l2 4.5h4.5l-3.5 3 1.5 4.5-3.5-2.5-3.5 2.5 1.5-4.5-3.5-3h4.5z" />
            </svg>
          </span>
        </button>
      ))}
    </div>
  )
}
