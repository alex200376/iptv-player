import { useCallback, useMemo, useRef } from 'react'
import { useStore } from '../stores/useStore'
import ContextMenu from './ContextMenu'
import { useState } from 'react'
import MarqueeText from './MarqueeText'
import { usePlayChannel } from '../hooks/usePlayChannel'
import LogoImg from './LogoImg'
import { useTranslation } from 'react-i18next'

export default function FavoriteList() {
  const { t } = useTranslation()
  const groups = useStore((s) => s.groups)
  const favoriteIds = useStore((s) => s.favoriteIds)
  const currentChannel = useStore((s) => s.currentChannel)
  const toggleFavorite = useStore((s) => s.toggleFavorite)

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channel: any } | null>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  const favoriteChannels = useMemo(() => {
    if (favoriteIds.length === 0) return []
    const allChannels = groups.flatMap((g) => g.channels)
    return allChannels.filter((ch) => favoriteIds.includes(ch.id))
  }, [groups, favoriteIds])

  const handlePlay = usePlayChannel()

  const handleContextMenu = useCallback((e: React.MouseEvent, ch: any) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, channel: ch })
  }, [])

  const copyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).catch(() => {})
  }, [])

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
          className={`channel-card w-full flex items-center gap-2.5 px-3 py-1.5 text-tv-sm text-left transition-colors ${
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

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: t('channel.play'), onClick: () => handlePlay(ctxMenu.channel), icon: <PlayIcon /> },
            { label: t('channel.copyUrl'), onClick: () => copyUrl(ctxMenu.channel.url), icon: <CopyIcon /> },
            { separator: true, label: '', onClick: () => {} },
            {
              label: t('channel.unfavorite'),
              onClick: () => toggleFavorite(ctxMenu.channel.id),
              danger: true,
              icon: <StarOffIcon />,
            },
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

function StarOffIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7.5 1.5l2 4.5h4.5l-3.5 3 1.5 4.5-3.5-2.5-3.5 2.5 1.5-4.5-3.5-3h4.5z" />
    </svg>
  )
}
