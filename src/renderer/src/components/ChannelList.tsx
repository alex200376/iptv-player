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
  return programs.find((p) =>
    (!channelTvgId || p.channelTvgId === channelTvgId) &&
    new Date(p.start).getTime() <= now &&
    new Date(p.stop).getTime() > now
  ) || null
}

function GripIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill="currentColor" opacity="0.3">
      <circle cx="5" cy="3" r="1" /><circle cx="10" cy="3" r="1" />
      <circle cx="5" cy="7.5" r="1" /><circle cx="10" cy="7.5" r="1" />
      <circle cx="5" cy="12" r="1" /><circle cx="10" cy="12" r="1" />
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
    (id: string) => { removeChannel(id) },
    [removeChannel],
  )

  const handleToggleFav = useCallback(
    (id: string) => { toggleFavorite(id) },
    [toggleFavorite],
  )

  const handleGroupDragStart = useCallback((e: React.DragEvent, groupName: string) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-group', groupName)
    setDragGroupName(groupName)
  }, [])

  const handleGroupDragOver = useCallback((e: React.DragEvent, groupName: string) => {
    if (!e.dataTransfer.types.includes('application/x-group')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTargetGroupName(groupName)
    setDropGroupPos('before')
  }, [])

  const handleGroupDrop = useCallback((e: React.DragEvent, targetGroupName: string) => {
    e.preventDefault()
    const sourceGroupName = e.dataTransfer.getData('application/x-group')
    if (sourceGroupName && sourceGroupName !== targetGroupName) {
      reorderGroup(sourceGroupName, targetGroupName)
    }
    setDragGroupName(null)
    setDropTargetGroupName(null)
  }, [reorderGroup])

  const handleGroupDragEnd = useCallback(() => {
    setDragGroupName(null)
    setDropTargetGroupName(null)
  }, [])

  if (filteredGroups.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-xs text-muted-foreground">
        {useStore.getState().searchQuery
          ? t('channel.emptySearch')
          : useStore.getState().activePlaylistId
            ? t('channel.emptyPlaylist')
            : t('channel.emptyGeneral')}
      </div>
    )
  }

  const totalChannels = filteredGroups.reduce((s: number, g: ChannelGroup) => s + g.channels.length, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border gap-1 flex-shrink-0">
        <span className="text-xs text-muted-foreground shrink-0">{t('channel.count', { count: totalChannels })}</span>
        <div className="flex items-center gap-2 ml-auto">
          {offlineCount > 0 && (
            <button
              onClick={handleRemoveOffline}
              disabled={removing}
              className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-40 whitespace-nowrap"
              title={t('channel.deleteOfflineTitle', { count: offlineCount })}
            >
              {removing ? t('channel.deleting') : t('channel.deleteOffline', { count: offlineCount })}
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        <Accordion.Root type="multiple" className="flex flex-col" defaultValue={[]}>
          {filteredGroups.map((group: ChannelGroup, i: number) => {
            const showTopIndicator =
              dropTargetGroupName === group.name && dropGroupPos === 'before'
            const showBottomIndicator =
              dropTargetGroupName === group.name && dropGroupPos === 'after'
            return (
              <div key={i} className="relative">
                {showTopIndicator && (
                  <div className="absolute top-0 left-2 right-2 h-0.5 bg-primary z-10 rounded-full" />
                )}
                <Accordion.Item
                  value={`group-${i}`}
                  onDragOver={(e) => handleGroupDragOver(e, group.name)}
                  onDrop={(e) => handleGroupDrop(e, group.name)}
                  onDragEnd={handleGroupDragEnd}
                  className={dragGroupName === group.name ? 'opacity-40' : ''}
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors group">
                      <span
                        draggable
                        className="cursor-grab active:cursor-grabbing"
                        onDragStart={(e) => handleGroupDragStart(e, group.name)}
                      >
                        <GripIcon />
                      </span>
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
                      <span className="font-medium text-foreground truncate text-sm">
                        {getGroupDisplayName(group.name, t)}
                      </span>
                      <span className="ml-auto text-xs">{group.channels.length}</span>
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-x-hidden data-[state=open]:animate-[slideDown_150ms_ease-out] data-[state=closed]:animate-[slideUp_150ms_ease-out]">
                    <ChannelGroupChannels
                      channels={group.channels}
                      currentChannel={currentChannel}
                      favoriteIds={favoriteIds}
                      ctxMenu={ctxMenu}
                      activeRef={activeRef}
                      onPlay={handlePlay}
                      onContextMenu={handleContextMenu}
                      onToggleFav={handleToggleFav}
                      epgCache={epgCache}
                    />
                  </Accordion.Content>
                </Accordion.Item>
                {showBottomIndicator && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary z-10 rounded-full" />
                )}
              </div>
            )
          })}
        </Accordion.Root>
      </div>

      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          items={[
            { label: t('channel.play'), onClick: () => handlePlay(ctxMenu.channel), icon: <PlayIcon /> },
            {
              label: favoriteIds.includes(ctxMenu.channel.id) ? t('channel.unfavorite') : t('channel.favorite'),
              onClick: () => toggleFavorite(ctxMenu.channel.id),
              icon: <StarIcon filled={favoriteIds.includes(ctxMenu.channel.id)} />,
            },
            { label: t('channel.copyUrl'), onClick: () => copyUrl(ctxMenu.channel.url), icon: <CopyIcon /> },
            { label: t('channel.checkLink'), onClick: () => handleCheck(ctxMenu.channel), icon: <CheckIcon /> },
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

  const handleChDragStart = useCallback((e: React.DragEvent, chId: string) => {
    e.stopPropagation()
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

  const handleChDrop = useCallback((e: React.DragEvent, targetChId: string) => {
    e.preventDefault()
    const sourceChId = e.dataTransfer.getData('application/x-channel')
    if (sourceChId && sourceChId !== targetChId) {
      reorderChannel(sourceChId, targetChId)
    }
    setDragChId(null)
    setDropTargetId(null)
  }, [reorderChannel])

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
      <div className="overflow-x-hidden">
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
            activeRef={activeRef}
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
      className="overflow-y-auto overflow-x-hidden relative"
      style={{ height: `${Math.min(channels.length, 12) * CHANNEL_ROW_HEIGHT}px` }}
    >
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
              <ChannelRowWrapper
                ch={ch}
                idx={virtualRow.index}
                dragChId={dragChId}
                dropTargetId={dropTargetId}
                dropPosition={dropPosition}
                currentChannel={currentChannel}
                favoriteIds={favoriteIds}
                activeRef={activeRef}
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
    <div className="relative" style={{ height: `${CHANNEL_ROW_HEIGHT}px` }}>
      {showTopIndicator && (
        <div className="absolute top-0 left-8 right-2 h-0.5 bg-primary z-10 rounded-full" />
      )}
      <div
        className={`flex items-center w-full h-full min-w-0 overflow-hidden ${isDragging ? 'opacity-40' : ''}`}
        draggable
        onDragStart={(e) => onDragStart(e, ch.id)}
        onDragOver={(e) => onDragOver(e, ch.id)}
        onDrop={(e) => onDrop(e, ch.id)}
        onDragEnd={onDragEnd}
      >
        <span className="pl-1 pr-0.5 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground flex-shrink-0">
          <GripIcon />
        </span>
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
          <span className="text-xs text-muted-foreground w-5 text-right flex-shrink-0 font-mono">
            {ch.tvgChno || ''}
          </span>
          {ch.logo ? (
            <img
              src={logoUrl}
              alt=""
              loading="lazy"
              className="w-7 h-7 rounded-full object-contain flex-shrink-0 ml-0.5"
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <span className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-muted ml-0.5">
              <svg className="w-4 h-4 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8M12 17v4" />
              </svg>
            </span>
          )}
          <div className="flex-1 min-w-0 text-left overflow-hidden px-0.5">
            <MarqueeText className={`font-medium ${isActive ? 'text-primary' : 'text-foreground'}`}>
              {ch.name}
            </MarqueeText>
            {currentEpg && (
              <div className="text-xs text-muted-foreground truncate mt-0.5">
                {currentEpg.title}
              </div>
            )}
          </div>
          <div className="flex-shrink-0 w-7 flex items-center justify-center ml-1">
            <span
              onClick={(e) => {
                e.stopPropagation()
                onToggleFav(ch.id)
              }}
              className={`p-1 rounded-md transition-all ${
                isFav
                  ? 'text-yellow-400 opacity-100'
                  : 'text-muted-foreground opacity-60 group-hover:opacity-100 hover:opacity-100'
              }`}
              title={isFav ? t('channel.unfavoriteTitle') : t('channel.favoriteTitle')}
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
          </div>
        </button>
      </div>
      {showBottomIndicator && (
        <div className="absolute bottom-0 left-8 right-2 h-0.5 bg-primary z-10 rounded-full" />
      )}
    </div>
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
    <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h11M5 4V2.5A.5.5 0 015.5 2h4a.5.5 0 01.5.5V4M6.5 7v3M8.5 7v3M3.5 4l.5 8.5a1 1 0 001 .9h5a1 1 0 001-.9L11.5 4" />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5">
      <path d="M7.5 1.5l2 4.5h4.5l-3.5 3 1.5 4.5-3.5-2.5-3.5 2.5 1.5-4.5-3.5-3h4.5z" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8l3 3.5L12 4" />
    </svg>
  )
}
