import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react'
import * as Accordion from '@radix-ui/react-accordion'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useStore, groupChannels } from '../stores/useStore'
import ContextMenu from './ContextMenu'
import { usePlayChannel } from '../hooks/usePlayChannel'
import { useLogoUrl } from '../hooks/useLogoUrl'
import type { Channel, ChannelGroup, EpgProgram } from '../types'
import { useTranslation } from 'react-i18next'
import { getGroupDisplayName } from '../utils/groupLabels'
import MarqueeText from './MarqueeText'

const CHANNEL_ROW_HEIGHT = 48

function getCurrentProgram(programs: EpgProgram[], channelTvgId?: string): EpgProgram | null {
  const now = Date.now()
  return (
    programs.find(
      (p) =>
        (!channelTvgId || p.channelTvgId === channelTvgId) &&
        new Date(p.start).getTime() <= now &&
        new Date(p.stop).getTime() > now,
    ) || null
  )
}

function GripIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <circle cx="4.5" cy="3.5" r="1.2" />
      <circle cx="9.5" cy="3.5" r="1.2" />
      <circle cx="4.5" cy="7" r="1.2" />
      <circle cx="9.5" cy="7" r="1.2" />
      <circle cx="4.5" cy="10.5" r="1.2" />
      <circle cx="9.5" cy="10.5" r="1.2" />
    </svg>
  )
}

type ChannelWithGroup = Channel & { _groupName: string }

function ChannelList({ categoryFilter }: { categoryFilter?: string | null }) {
  const { t } = useTranslation()
  const groups = useStore((s) => s.groups)
  const currentChannel = useStore((s) => s.currentChannel)
  const searchQuery = useStore((s) => s.searchQuery)
  const favoriteIds = useStore((s) => s.favoriteIds)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const activePlaylistId = useStore((s) => s.activePlaylistId)
  const epgCache = useStore((s) => s.epgCache)
  const reorderGroup = useStore((s) => s.reorderGroup)

  const [dragGroupName, setDragGroupName] = useState<string | null>(null)
  const [dropTargetGroupName, setDropTargetGroupName] = useState<string | null>(null)
  const [dropGroupPos, setDropGroupPos] = useState<'before' | 'after'>('before')

  const filteredGroups = useMemo(() => {
    let channels: ChannelWithGroup[] = groups.flatMap((g) => {
      const chs = g.channels.map((ch: Channel) => ({ ...ch, _groupName: g.name }))
      return chs
    })
    if (activePlaylistId) {
      channels = channels.filter((ch) => ch.playlistId === activePlaylistId)
    }
    if (categoryFilter) {
      channels = channels.filter((ch) => ch._groupName === categoryFilter)
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      channels = channels.filter((ch) => ch.name.toLowerCase().includes(q))
    }
    return groupChannels(channels)
  }, [groups, searchQuery, activePlaylistId, categoryFilter])

  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; channel: Channel } | null>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const setChannels = useStore((s) => s.setChannels)

  const offlineCount = useMemo(
    () => groups.flatMap((g) => g.channels).filter((ch: Channel) => ch.status === 'offline').length,
    [groups],
  )

  const [removing, setRemoving] = useState(false)
  const handleRemoveOffline = useCallback(async () => {
    if (removing || offlineCount === 0) return
    setRemoving(true)
    try {
      const result = await window.electronAPI.removeOfflineChannels()
      if (result.channels.length >= 0) {
        setChannels(result.channels as Channel[])
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
  const handleContextMenu = useCallback((e: React.MouseEvent, ch: Channel) => {
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, channel: ch })
  }, [])

  const removeChannel = useStore((s) => s.removeChannel)
  const updateChannelStatus = useStore((s) => s.updateChannelStatus)

  const copyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).catch((e) => console.error('[clipboard] copy failed:', e))
  }, [])

  const handleCheck = useCallback(
    async (ch: Channel) => {
      const result = await window.electronAPI.checkChannelUrl(ch.url)
      updateChannelStatus(ch.id, result.online ? 'online' : 'offline', result.lastCheckedAt)
    },
    [updateChannelStatus],
  )

  const handleDelete = useCallback(
    (id: string) => {
      removeChannel(id)
    },
    [removeChannel],
  )

  const handleToggleFav = useCallback(
    (id: string) => {
      toggleFavorite(id)
    },
    [toggleFavorite],
  )

  // ── Group drag handlers ────────────────────────────────────────────────────
  const handleGroupDragStart = useCallback(
    (e: React.DragEvent<HTMLDivElement>, groupName: string) => {
      e.stopPropagation()
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('application/x-group', groupName)
      setDragGroupName(groupName)
    },
    [],
  )

  const handleGroupDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>, groupName: string) => {
      if (!e.dataTransfer.types.includes('application/x-group')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      // Determine before/after based on mouse position
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      setDropTargetGroupName(groupName)
      setDropGroupPos(e.clientY < midY ? 'before' : 'after')
    },
    [],
  )

  const handleGroupDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetGroupName: string) => {
      e.preventDefault()
      const sourceGroupName = e.dataTransfer.getData('application/x-group')
      if (sourceGroupName && sourceGroupName !== targetGroupName) {
        reorderGroup(sourceGroupName, targetGroupName)
      }
      setDragGroupName(null)
      setDropTargetGroupName(null)
    },
    [reorderGroup],
  )

  const handleGroupDragEnd = useCallback(() => {
    setDragGroupName(null)
    setDropTargetGroupName(null)
  }, [])

  if (filteredGroups.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4 text-center">
        {useStore.getState().searchQuery
          ? t('channel.emptySearch')
          : useStore.getState().activePlaylistId
            ? t('channel.emptyPlaylist')
            : t('channel.emptyGeneral')}
      </div>
    )
  }

  const totalChannels = filteredGroups.reduce(
    (s: number, g: ChannelGroup) => s + g.channels.length,
    0,
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {t('channel.count', { count: totalChannels })}
        </span>
        {offlineCount > 0 && (
          <button
            onClick={handleRemoveOffline}
            disabled={removing}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            {removing
              ? t('channel.deleting')
              : t('channel.deleteOffline', { count: offlineCount })}
          </button>
        )}
      </div>

      <Accordion.Root type="multiple" className="flex-1 overflow-y-auto overflow-x-hidden">
        {filteredGroups.map((group: ChannelGroup, i: number) => {
          const showTopIndicator =
            dropTargetGroupName === group.name && dropGroupPos === 'before'
          const showBottomIndicator =
            dropTargetGroupName === group.name && dropGroupPos === 'after'
          return (
            <Accordion.Item
              key={group.name}
              value={group.name}
              className="border-b border-border/50 last:border-0"
            >
              {showTopIndicator && (
                <div className="h-0.5 bg-primary mx-2 rounded-full" />
              )}
              <div
                draggable
                onDragStart={(e) => handleGroupDragStart(e, group.name)}
                onDragOver={(e) => handleGroupDragOver(e, group.name)}
                onDrop={(e) => handleGroupDrop(e, group.name)}
                onDragEnd={handleGroupDragEnd}
                className={dragGroupName === group.name ? 'opacity-40' : ''}
              >
                <Accordion.Header>
                  <Accordion.Trigger className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium hover:bg-muted/60 transition-colors group">
                    <span
                      className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <GripIcon />
                    </span>
                    <span className="flex-1 text-left truncate">
                      {getGroupDisplayName(group.name, t)}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {group.channels.length}
                    </span>
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  <ChannelGroupChannels
                    channels={group.channels}
                    currentChannel={currentChannel}
                    favoriteIds={favoriteIds}
                    activeRef={activeRef}
                    onPlay={handlePlay}
                    onContextMenu={handleContextMenu}
                    onToggleFav={handleToggleFav}
                    epgCache={epgCache}
                  />
                </Accordion.Content>
              </div>
              {showBottomIndicator && (
                <div className="h-0.5 bg-primary mx-2 rounded-full" />
              )}
            </Accordion.Item>
          )
        })}
      </Accordion.Root>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            {
              label: t('channel.play'),
              onClick: () => handlePlay(ctxMenu.channel),
              icon: <PlayIcon />,
            },
            {
              label: favoriteIds.includes(ctxMenu.channel.id)
                ? t('channel.unfavorite')
                : t('channel.favorite'),
              onClick: () => toggleFavorite(ctxMenu.channel.id),
              icon: <StarIcon filled={favoriteIds.includes(ctxMenu.channel.id)} />,
            },
            {
              label: t('channel.copyUrl'),
              onClick: () => copyUrl(ctxMenu.channel.url),
              icon: <CopyIcon />,
            },
            {
              label: t('channel.checkLink'),
              onClick: () => handleCheck(ctxMenu.channel),
              icon: <CheckIcon />,
            },
            { separator: true, label: '', onClick: () => {} },
            {
              label: t('channel.deleteChannel'),
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

function ChannelGroupChannels({
  channels,
  currentChannel,
  favoriteIds,
  activeRef,
  onPlay,
  onContextMenu,
  onToggleFav,
  epgCache,
}: {
  channels: Channel[]
  currentChannel: Channel | null
  favoriteIds: string[]
  activeRef: React.Ref<HTMLButtonElement>
  onPlay: (ch: Channel, retry?: number) => void
  onContextMenu: (e: React.MouseEvent, ch: Channel) => void
  onToggleFav: (id: string) => void
  epgCache: Record<string, EpgProgram[]>
}) {
  const parentRef = useRef<HTMLDivElement>(null)
  const reorderChannel = useStore((s) => s.reorderChannel)

  const [dragChId, setDragChId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)
  const [dropPosition, setDropPosition] = useState<'before' | 'after'>('before')

  const handleChDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, chId: string) => {
    // Allow the drag to start from the row itself, not just the grip
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-channel', chId)
    setDragChId(chId)
  }, [])

  const handleChDragOver = useCallback((e: React.DragEvent<HTMLDivElement>, chId: string) => {
    if (!e.dataTransfer.types.includes('application/x-channel')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDropTargetId(chId)
    setDropPosition(e.clientY < midY ? 'before' : 'after')
  }, [])

  const handleChDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>, targetChId: string) => {
      e.preventDefault()
      const sourceChId = e.dataTransfer.getData('application/x-channel')
      if (sourceChId && sourceChId !== targetChId) {
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
        const midY = rect.top + rect.height / 2
        const position = e.clientY < midY ? 'before' : 'after'
        reorderChannel(sourceChId, targetChId, position)
      }
      setDragChId(null)
      setDropTargetId(null)
    },
    [reorderChannel],
  )

  const handleChDragEnd = useCallback(() => {
    setDragChId(null)
    setDropTargetId(null)
  }, [])

  const virtualizer = useVirtualizer({
    count: channels.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => CHANNEL_ROW_HEIGHT,
    overscan: 5,
  })

  const needsVirtual = channels.length > 30

  if (!needsVirtual) {
    return (
      <div className="">
        {channels.map((ch, idx) => (
          <ChannelRowWrapper
            key={ch.id}
            ch={ch}
            idx={idx}
            dragChId={dragChId}
            dropTargetId={dropTargetId}
            dropPosition={dropPosition}
            currentChannel={currentChannel}
            favoriteIds={favoriteIds}
            activeRef={activeRef as React.RefObject<HTMLButtonElement>}
            onPlay={onPlay}
            onContextMenu={onContextMenu}
            onToggleFav={onToggleFav}
            epgCache={epgCache}
            onDragStart={handleChDragStart}
            onDragOver={handleChDragOver}
            onDrop={handleChDrop}
            onDragEnd={handleChDragEnd}
          />
        ))}
      </div>
    )
  }

  return (
    <div ref={parentRef} className="overflow-auto" style={{ height: `${Math.min(channels.length, 10) * CHANNEL_ROW_HEIGHT}px` }}>
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
                transform: `translateY(${virtualRow.start}px)`,
                height: `${CHANNEL_ROW_HEIGHT}px`,
              }}
            >
              <ChannelRowWrapper
                ch={ch}
                idx={virtualRow.index}
                dragChId={dragChId}
                dropTargetId={dropTargetId}
                dropPosition={dropPosition}
                currentChannel={currentChannel}
                favoriteIds={favoriteIds}
                activeRef={activeRef as React.RefObject<HTMLButtonElement>}
                onPlay={onPlay}
                onContextMenu={onContextMenu}
                onToggleFav={onToggleFav}
                epgCache={epgCache}
                onDragStart={handleChDragStart}
                onDragOver={handleChDragOver}
                onDrop={handleChDrop}
                onDragEnd={handleChDragEnd}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

const ChannelRowWrapper = memo(function ChannelRowWrapper({
  ch,
  idx,
  dragChId,
  dropTargetId,
  dropPosition,
  currentChannel,
  favoriteIds,
  activeRef,
  onPlay,
  onContextMenu,
  onToggleFav,
  epgCache,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  ch: Channel
  idx: number
  dragChId: string | null
  dropTargetId: string | null
  dropPosition: 'before' | 'after'
  currentChannel: Channel | null
  favoriteIds: string[]
  activeRef: React.RefObject<HTMLButtonElement>
  onPlay: (ch: Channel) => void
  onContextMenu: (e: React.MouseEvent, ch: Channel) => void
  onToggleFav: (id: string) => void
  epgCache: Record<string, EpgProgram[]>
  onDragStart: (e: React.DragEvent<HTMLDivElement>, chId: string) => void
  onDragOver: (e: React.DragEvent<HTMLDivElement>, chId: string) => void
  onDrop: (e: React.DragEvent<HTMLDivElement>, chId: string) => void
  onDragEnd: () => void
}) {
  const { t } = useTranslation()
  const showTopIndicator = dropTargetId === ch.id && dropPosition === 'before'
  const showBottomIndicator = dropTargetId === ch.id && dropPosition === 'after'
  const isFav = favoriteIds.includes(ch.id)
  const isActive = currentChannel?.id === ch.id
  const logoUrl = useLogoUrl(ch.logo)
  const isDragging = dragChId === ch.id

  const currentEpg = useMemo(() => {
    if (!ch.tvgUrl) return null
    const cached = epgCache[ch.tvgUrl]
    if (!cached || cached.length === 0) return null
    return getCurrentProgram(cached, ch.tvgId)
  }, [ch.tvgUrl, ch.tvgId, epgCache])

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, ch.id)}
      onDragOver={(e) => onDragOver(e, ch.id)}
      onDrop={(e) => onDrop(e, ch.id)}
      onDragEnd={onDragEnd}
      className={`relative flex items-center h-[48px] overflow-hidden select-none ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {showTopIndicator && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary z-10" />
      )}

      {/* Grip handle */}
      <div
        className="pl-1 pr-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripIcon />
      </div>

      <button
        ref={isActive ? activeRef : undefined}
        onClick={() => onPlay(ch)}
        onContextMenu={(e) => onContextMenu(e, ch)}
        className={`flex-1 flex items-center py-1 text-sm text-left transition-colors hover:bg-muted group overflow-hidden h-full ${
          isActive
            ? 'border-l-2 border-primary bg-primary/5'
            : ch.status === 'offline'
              ? 'opacity-50 text-muted-foreground'
              : 'text-foreground'
        }`}
      >
        <span className="w-6 text-center text-xs text-muted-foreground flex-shrink-0">
          {ch.tvgChno || ''}
        </span>
        {ch.logo ? (
          <img
            src={logoUrl}
            alt={ch.name}
            className="w-6 h-6 rounded object-contain flex-shrink-0 mr-1.5"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-6 h-6 rounded bg-muted flex-shrink-0 mr-1.5" />
        )}
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm leading-tight">{ch.name}</div>
          {currentEpg && (
            <div className="truncate text-xs text-muted-foreground leading-tight">
              {currentEpg.title}
            </div>
          )}
        </div>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleFav(ch.id)
        }}
        className={`p-1 rounded-md transition-all flex-shrink-0 ${
          isFav
            ? 'text-yellow-400 opacity-100'
            : 'text-muted-foreground opacity-60 group-hover:opacity-100 hover:opacity-100'
        }`}
        title={isFav ? t('channel.unfavoriteTitle') : t('channel.favoriteTitle')}
      >
        <StarIcon filled={isFav} />
      </button>

      {showBottomIndicator && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary z-10" />
      )}
    </div>
  )
})

export default memo(ChannelList)

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3,6 5,6 21,6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  )
}
