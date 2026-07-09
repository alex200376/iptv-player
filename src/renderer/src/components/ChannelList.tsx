import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore, groupChannels } from '../stores/useStore'
import ContextMenu from './ContextMenu'
import { usePlayChannel } from '../hooks/usePlayChannel'

function ChannelList() {
  const groups = useStore((s) => s.groups)
  const currentChannel = useStore((s) => s.currentChannel)
  const searchQuery = useStore((s) => s.searchQuery)
  const favoriteIds = useStore((s) => s.favoriteIds)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const activePlaylistId = useStore((s) => s.activePlaylistId)

  const filteredGroups = useMemo(() => {
    let channels = groups.flatMap((g) => g.channels)
    if (activePlaylistId) {
      channels = channels.filter((ch) => ch.playlistId === activePlaylistId)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      channels = channels.filter((ch) => ch.name.toLowerCase().includes(q))
    }
    return groupChannels(channels)
  }, [groups, searchQuery, activePlaylistId])

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channel: any } | null>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const checkingAll = useStore((s) => s.checkingAll)
  const checkAllChannels = useStore((s) => s.checkAllChannels)
  const setChannels = useStore((s) => s.setChannels)

  const offlineCount = useMemo(
    () => groups.flatMap((g) => g.channels).filter((ch) => ch.status === 'offline').length,
    [groups],
  )

  const [removing, setRemoving] = useState(false)
  const handleRemoveOffline = useCallback(async () => {
    if (removing || offlineCount === 0) return
    setRemoving(true)
    try {
      const result = await window.electronAPI.removeOfflineChannels()
      if (result.channels.length >= 0) {
        setChannels(result.channels as any)
      }
    } finally {
      setRemoving(false)
    }
  }, [removing, offlineCount, setChannels])

  useEffect(() => {
    if (activeRef.current && ctxMenu === null) {
      activeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [currentChannel, ctxMenu])

  const handlePlay = usePlayChannel()

  const handleContextMenu = useCallback((e: React.MouseEvent, ch: any) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, channel: ch })
  }, [])

  const removeChannel = useStore((s) => s.removeChannel)
  const updateChannelStatus = useStore((s) => s.updateChannelStatus)

  const copyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).catch(() => {})
  }, [])

  const handleCheck = useCallback(
    async (ch: any) => {
      const result = await window.electronAPI.checkChannelUrl(ch.url)
      updateChannelStatus(ch.id, result.online ? 'online' : 'offline', result.lastCheckedAt)
    },
    [updateChannelStatus],
  )

  const handleDelete = useCallback(
    (id: string) => { removeChannel(id) },
    [removeChannel],
  )

  const handleToggleFav = useCallback(
    (id: string) => { toggleFavorite(id) },
    [toggleFavorite],
  )

  if (filteredGroups.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-tv-xs text-tv-text-secondary">
        {useStore.getState().searchQuery
          ? '未找到匹配频道'
          : useStore.getState().activePlaylistId
            ? '该播放列表暂无频道'
            : '暂无频道，请先导入 M3U 文件'}
      </div>
    )
  }

  const totalChannels = filteredGroups.reduce((s, g) => s + g.channels.length, 0)

  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1 border-b border-tv-border gap-1">
        <span className="text-tv-xs text-tv-text-secondary shrink-0">{totalChannels} 频道</span>
        <div className="flex items-center gap-2 ml-auto">
          {offlineCount > 0 && !checkingAll && (
            <button
              onClick={handleRemoveOffline}
              disabled={removing}
              className="text-tv-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 whitespace-nowrap"
              title={`删除 ${offlineCount} 个不可用频道`}
            >
              {removing ? '删除中...' : `删除 ${offlineCount} 个离线`}
            </button>
          )}
          <button
            onClick={checkAllChannels}
            disabled={checkingAll}
            className="text-tv-xs text-tv-text-secondary hover:text-tv-accent transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {checkingAll ? '检测中...' : '检测全部'}
          </button>
        </div>
      </div>
      <Accordion.Root type="multiple" className="flex flex-col" defaultValue={[]}>
        {filteredGroups.map((group, i) => (
          <Accordion.Item key={i} value={`group-${i}`}>
            <Accordion.Header>
              <Accordion.Trigger className="flex items-center gap-2 w-full px-3 py-1.5 text-tv-xs text-tv-text-secondary hover:bg-tv-bg-surface transition-colors group">
                <svg
                  className="w-3 h-3 transition-transform duration-150 group-data-[state=closed]:-rotate-90 flex-shrink-0"
                  viewBox="0 0 15 15"
                  fill="none"
                >
                  <path
                    d="M4 6l3.5 3.5L11 6"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="font-medium text-tv-text-primary truncate text-tv-sm">
                  {group.name}
                </span>
                <span className="ml-auto text-tv-xs">{group.channels.length}</span>
              </Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Content className="data-[state=open]:animate-[slideDown_150ms_ease-out] data-[state=closed]:animate-[slideUp_150ms_ease-out]">
              <ChannelGroupChannels
                channels={group.channels}
                currentChannel={currentChannel}
                favoriteIds={favoriteIds}
                ctxMenu={ctxMenu}
                activeRef={activeRef}
                onPlay={handlePlay}
                onContextMenu={handleContextMenu}
                onToggleFav={handleToggleFav}
              />
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: '播放', onClick: () => handlePlay(ctxMenu.channel), icon: <PlayIcon /> },
            {
              label: favoriteIds.includes(ctxMenu.channel.id) ? '取消收藏' : '收藏',
              onClick: () => toggleFavorite(ctxMenu.channel.id),
              icon: <StarIcon filled={favoriteIds.includes(ctxMenu.channel.id)} />,
            },
            { label: '复制 URL', onClick: () => copyUrl(ctxMenu.channel.url), icon: <CopyIcon /> },
            { label: '检测链接', onClick: () => handleCheck(ctxMenu.channel), icon: <CheckIcon /> },
            { separator: true, label: '', onClick: () => {} },
            {
              label: '删除频道',
              onClick: () => handleDelete(ctxMenu.channel.id),
              danger: true,
              icon: <TrashIcon />,
            },
          ]}
        />
      )}
    </div>
  )
}

// BUG FIX (virtual list re-render): ctxMenu was passed into ChannelGroupChannels
// and forwarded to every ChannelRow. Any right-click change caused ALL virtualised
// rows (potentially 1 000+) to re-render because ctxMenu object identity changed.
// Fix: drop ctxMenu from ChannelGroupChannels/ChannelRow props entirely — the row
// only needs to highlight when it IS the ctx-menu target, which is handled by the
// ContextMenu overlay itself, not by each row.
function ChannelGroupChannels({
  channels,
  currentChannel,
  favoriteIds,
  activeRef,
  onPlay,
  onContextMenu,
  onToggleFav,
}: {
  channels: any[]
  currentChannel: any
  favoriteIds: string[]
  activeRef: React.RefObject<HTMLButtonElement>
  onPlay: (ch: any, retry?: number) => void
  onContextMenu: (e: React.MouseEvent, ch: any) => void
  onToggleFav: (id: string) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 5,
  })

  const needsVirtual = channels.length > 80

  if (!needsVirtual) {
    return (
      <div>
        {channels.map((ch) => (
          <ChannelRow
            key={ch.id}
            ch={ch}
            currentChannel={currentChannel}
            favoriteIds={favoriteIds}
            activeRef={activeRef}
            onPlay={onPlay}
            onContextMenu={onContextMenu}
            onToggleFav={onToggleFav}
          />
        ))}
      </div>
    )
  }

  return (
    <div ref={parentRef} className="overflow-y-auto" style={{ maxHeight: '55vh' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const ch = channels[virtualRow.index]
          return (
            <div
              key={ch.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <ChannelRow
                ch={ch}
                currentChannel={currentChannel}
                favoriteIds={favoriteIds}
                activeRef={activeRef}
                onPlay={onPlay}
                onContextMenu={onContextMenu}
                onToggleFav={onToggleFav}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status?: string }) {
  const colors: Record<string, string> = {
    online: 'bg-green-500',
    offline: 'bg-red-500',
    unknown: 'bg-gray-500',
  }
  return (
    <span
      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
        colors[status || 'unknown'] || colors.unknown
      }`}
    />
  )
}

const ChannelRow = memo(function ChannelRow({
  ch,
  currentChannel,
  favoriteIds,
  activeRef,
  onPlay,
  onContextMenu,
  onToggleFav,
}: {
  ch: any
  currentChannel: any
  favoriteIds: string[]
  activeRef: React.RefObject<HTMLButtonElement>
  onPlay: (ch: any) => void
  onContextMenu: (e: React.MouseEvent, ch: any) => void
  onToggleFav: (id: string) => void
}) {
  const isFav = favoriteIds.includes(ch.id)
  const isActive = currentChannel?.id === ch.id
  return (
    <button
      ref={isActive ? activeRef : undefined}
      onClick={() => onPlay(ch)}
      onContextMenu={(e) => onContextMenu(e, ch)}
      className={`channel-card w-full flex items-center gap-2.5 px-3 py-1.5 text-tv-sm text-left transition-colors ${
        isActive
          ? 'active'
          : ch.status === 'offline'
            ? 'opacity-50 text-tv-text-secondary hover:text-tv-text-primary'
            : 'text-tv-text-secondary hover:text-tv-text-primary'
      }`}
    >
      <StatusDot status={ch.status} />
      {ch.logo ? (
        <img
          src={ch.logo}
          alt=""
          loading="lazy"
          className="w-5 h-5 rounded-tv-sm object-contain flex-shrink-0"
          onError={(e) => {
            ;(e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      ) : (
        <span className="w-5 h-5 rounded-tv-sm flex items-center justify-center flex-shrink-0">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </span>
      )}
      <span className="flex-1 truncate">{ch.name}</span>
      <span
        onClick={(e) => {
          e.stopPropagation()
          onToggleFav(ch.id)
        }}
        className={`flex-shrink-0 p-1.5 rounded-tv-sm transition-colors ${
          isFav ? 'text-yellow-400' : 'text-tv-text-secondary opacity-40 hover:opacity-100'
        }`}
        title={isFav ? '取消收藏' : '收藏'}
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 15 15"
          fill={isFav ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M7.5 1.5l2 4.5h4.5l-3.5 3 1.5 4.5-3.5-2.5-3.5 2.5 1.5-4.5-3.5-3h4.5z" />
        </svg>
      </span>
    </button>
  )
})

export default memo(ChannelList)

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
      <rect x="5.5" y="1.5" width="7" height="9" rx="1" />
      <path d="M1.5 5.5v7a1 1 0 001 1h7" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M2 4h11M5 4V2.5A.5.5 0 015.5 2h4a.5.5 0 01.5.5V4M6.5 7v3M8.5 7v3M3.5 4l.5 8.5a1 1 0 001 .9h5a1 1 0 001-.9L11.5 4" />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 15 15"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M7.5 1.5l2 4.5h4.5l-3.5 3 1.5 4.5-3.5-2.5-3.5 2.5 1.5-4.5-3.5-3h4.5z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="w-3.5 h-3.5"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8l3 3.5L12 4" />
    </svg>
  )
}
