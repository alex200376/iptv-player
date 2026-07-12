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
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
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

  // Group drag handlers
  const handleGroupDragStart = useCallback(
    (e: React.DragEvent, groupName: string) => {
      e.stopPropagation()
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('application/x-group', groupName)
      setDragGroupName(groupName)
    },
    [],
  )

  const handleGroupDragOver = useCallback(
    (e: React.DragEvent, groupName: string) => {
      if (!e.dataTransfer.types.includes('application/x-group')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      setDropTargetGroupName(groupName)
      setDropGroupPos(e.clientY < midY ? 'before' : 'after')
    },
    [],
  )

  const handleGroupDrop = useCallback(
    (e: React.DragEvent, targetGroupName: string) => {
      e.preventDefault()
      const sourceGroupName = e.dataTransfer.getData('application/x-group')
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const position: 'before' | 'after' = e.clientY < midY ? 'before' : 'after'
      if (sourceGroupName && sourceGroupName !== targetGroupName) {
        reorderGroup(sourceGroupName, targetGroupName, position)
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
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs p-4 text-center">
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
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground border-b border-border flex-shrink-0">
        <span>{t('channel.count', { count: totalChannels })}</span>
        &nbsp;
        {offlineCount > 0 && (
          <button
            onClick={handleRemoveOffline}
            className="ml-auto text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            {removing ? t('channel.deleting') : t('channel.deleteOffline', { count: offlineCount })}
          </button>
        )}
      </div>

      <Accordion.Root type="multiple" className="flex-1 overflow-y-auto">
        {filteredGroups.map((group: ChannelGroup, i: number) => {
          const showTopIndicator = dropTargetGroupName === group.name && dropGroupPos === 'before'
          const showBottomIndicator = dropTargetGroupName === group.name && dropGroupPos === 'after'
          return (
            <Accordion.Item key={group.name} value={group.name}>
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
                  <Accordion.Trigger
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center w-full gap-2 px-2 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors group"
                  >
                    <span className="cursor-grab active:cursor-grabbing" onMouseDown={(e) => e.stopPropagation()}>
                      <GripIcon />
                    </span>
                    <span className="flex-1 text-left truncate">
                      {getGroupDisplayName(group.name, t)}
                    </span>
                    <span className="text-muted-foreground/60">{group.channels.length}</span>
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

  // Fix Bug 3: ensure draggable is set on each row and handlers work correctly
  const handleChDragStart = useCallback((e: React.DragEvent, chId: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-channel', chId)
    setDragChId(chId)
  }, [])

  const handleChDragOver = useCallback((e: React.DragEvent, chId: string) => {
    if (!e.dataTransfer.types.includes('application/x-channel')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    setDropTargetId(chId)
    setDropPosition(e.clientY < midY ? 'before' : 'after')
  }, [])

  const handleChDrop = useCallback(
    (e: React.DragEvent, targetChId: string) => {
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
      <div>
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
    <div
      ref={parentRef}
      className="overflow-y-auto"
      style={{ height: Math.min(channels.length * CHANNEL_ROW_HEIGHT, 400) }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
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
  onDragStart: (e: React.DragEvent, chId: string) => void
  onDragOver: (e: React.DragEvent, chId: string) => void
  onDrop: (e: React.DragEvent, chId: string) => void
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
      onDragOver={(e) => onDragOver(e, ch.id)}
      onDrop={(e) => onDrop(e, ch.id)}
      onDragEnd={onDragEnd}
      className={`relative flex items-center h-[48px] overflow-hidden select-none transition-all duration-150 ${
        isDragging ? 'opacity-40 scale-[0.98]' : 'opacity-100'
      }`}
    >
      {showTopIndicator && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-primary z-10 rounded-full" />
      )}

      {/* Grip handle is the ONLY draggable handle so it doesn't conflict with click-to-play */}
      <div
        draggable
        onDragStart={(e) => onDragStart(e, ch.id)}
        className="flex-shrink-0 w-5 flex items-center justify-center px-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors rounded-sm hover:bg-muted/50"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <GripIcon />
      </div>

      <button
        ref={isActive ? activeRef : undefined}
        onClick={() => onPlay(ch)}
        onContextMenu={(e) => onContextMenu(e, ch)}
        className={`flex-1 flex items-center gap-1 py-1.5 text-sm text-left transition-all duration-150 group overflow-hidden h-full border-l-2 ${
          isActive
            ? 'border-primary bg-primary/10'
            : ch.status === 'offline'
              ? 'border-transparent opacity-50 text-muted-foreground'
              : 'border-transparent hover:bg-muted/60 text-foreground'
        }`}
      >
        <span className="text-[11px] text-muted-foreground/50 w-4 shrink-0 text-center tabular-nums font-medium">
          {ch.tvgChno || ''}
        </span>
        {ch.logo ? (
          <img
            src={logoUrl}
            alt={ch.name}
            className="h-5 w-8 object-contain shrink-0"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="h-5 w-8 shrink-0 flex items-center justify-center">
            <div className="w-4 h-4 rounded bg-muted/50" />
          </div>
        )}
        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <div className="overflow-hidden whitespace-nowrap min-w-0 w-full text-xs font-semibold truncate">
            <MarqueeText className={isActive ? 'text-primary' : 'text-foreground'}>{ch.name}</MarqueeText>
          </div>
          {currentEpg && (
            <span className="text-[10px] text-muted-foreground/80 truncate leading-tight">
              {currentEpg.title}
            </span>
          )}
        </div>
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation()
          onToggleFav(ch.id)
        }}
        className={`p-1.5 rounded-md transition-all flex-shrink-0 ${
          isFav
            ? 'text-yellow-500 opacity-100'
            : 'text-muted-foreground/50 opacity-70 group-hover:opacity-100 hover:opacity-100 hover:bg-muted/50'
        }`}
        title={isFav ? t('channel.unfavoriteTitle') : t('channel.favoriteTitle')}
      >
        <StarIcon filled={isFav} />
      </button>

      {showBottomIndicator && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary z-10 rounded-full" />
      )}
    </div>
  )
})

export default memo(ChannelList)

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
