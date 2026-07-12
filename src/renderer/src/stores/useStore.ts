import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import i18n from '../i18n'
import type { Channel, ChannelGroup, PlaylistMeta, HistoryEntry, EpgProgram, EpgSource, UserData } from '../types'

let directIdCounter = 0

export function groupChannels(channels: Channel[]): ChannelGroup[] {
  const map = new Map<string, Channel[]>()
  for (const ch of channels) {
    const g = ch.group || i18n.t('group.ungrouped')
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(ch)
  }
  return Array.from(map.entries()).map(([name, channels]) => ({ name, channels }))
}

interface PersistedChannelData {
  channels: Channel[]
  directStreams: Channel[]
  activePlaylistId: string | null
  favoriteIds: string[]
  historyEntries: HistoryEntry[]
  playlists: PlaylistMeta[]
  epgSources: EpgSource[]
}

interface PlayerStore extends PersistedChannelData {
  groups: ChannelGroup[]
  currentChannel: Channel | null
  isPlaying: boolean
  searchQuery: string
  navTab: string
  settingsOpen: boolean
  epgCache: Record<string, EpgProgram[]>
  setChannels: (channels: Channel[]) => void
  reorderGroup: (groupId: string, targetGroupId: string, position?: 'before' | 'after') => void
  reorderChannel: (channelId: string, targetChannelId: string, position?: 'before' | 'after') => void
  setCurrentChannel: (channel: Channel) => void
  setIsPlaying: (playing: boolean) => void
  setSearchQuery: (q: string) => void
  setNavTab: (tab: string) => void
  addDirectStream: (url: string) => Channel
  removeChannel: (id: string) => void
  setSettingsOpen: (open: boolean) => void
  setActivePlaylistId: (id: string | null) => void
  toggleFavorite: (id: string) => void
  addHistoryEntry: (channel: Channel) => void
  clearHistory: () => void
  addPlaylist: (meta: PlaylistMeta) => void
  removePlaylist: (id: string) => void
  loadUserData: (data: { favoriteIds: string[]; historyEntries: HistoryEntry[]; playlists: PlaylistMeta[] }) => void
  loadEpg: (tvgUrl: string) => Promise<void>
  importEpgFromUrl: (url: string) => Promise<{ success: boolean; count: number; error?: string }>
  removeEpgSource: (url: string) => void
  checkLogs: Array<{ name: string; url: string; protocol: string; result: string; checked: number; total: number }>
  checkRunning: boolean
  checkTotal: number
  appendCheckLog: (log: { name: string; url: string; protocol: string; result: string; checked: number; total: number }) => void
  setCheckRunning: (v: boolean) => void
  resetCheck: () => void
  updateChannelStatus: (id: string, status: 'online' | 'offline', lastCheckedAt: number) => void
}

const ipcStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (name === 'iptv-player-store') {
        const [channels, userData] = await Promise.all([
          window.electronAPI.loadChannels(),
          window.electronAPI.loadUserData(),
        ])
        const persisted: PersistedChannelData = {
          channels: channels || [],
          directStreams: (channels || []).filter((ch: Channel) => ch.id.startsWith('direct-')),
          activePlaylistId: (userData as any)?.activePlaylistId ?? null,
          favoriteIds: (userData as UserData)?.favoriteIds || [],
          historyEntries: (userData as UserData)?.historyEntries || [],
          playlists: (userData as UserData)?.playlists || [],
          epgSources: (userData as UserData)?.epgSources || [],
        }
        return JSON.stringify({ state: persisted, version: 0 })
      }
      return null
    } catch {
      return null
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (name === 'iptv-player-store') {
      const parsed = JSON.parse(value)
      const state = parsed?.state ?? parsed
      await Promise.all([
        window.electronAPI.saveChannels(state.channels ?? []),
        window.electronAPI.saveUserData({
          favoriteIds: state.favoriteIds ?? [],
          historyEntries: state.historyEntries ?? [],
          playlists: state.playlists ?? [],
          epgSources: state.epgSources ?? [],
          activePlaylistId: state.activePlaylistId ?? null,
        }),
      ])
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (name === 'iptv-player-store') {
      await Promise.all([
        window.electronAPI.saveChannels([]),
        window.electronAPI.saveUserData({ favoriteIds: [], historyEntries: [], playlists: [] }),
      ])
    }
  },
}

const PARTIALIZE_KEYS: (keyof PersistedChannelData)[] = [
  'channels',
  'directStreams',
  'activePlaylistId',
  'favoriteIds',
  'historyEntries',
  'playlists',
  'epgSources',
]

export const useStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      groups: [],
      channels: [],
      currentChannel: null,
      isPlaying: false,
      searchQuery: '',
      navTab: 'channels',
      directStreams: [],
      settingsOpen: false,
      activePlaylistId: null,
      favoriteIds: [],
      historyEntries: [],
      playlists: [],
      epgSources: [],
      checkLogs: [],
      checkRunning: false,
      checkTotal: 0,

      setChannels: (channels) => set({ groups: groupChannels(channels), channels }),

      // Fix: accept position so drop-after works correctly for groups
      reorderGroup: (groupId: string, targetGroupId: string, position: 'before' | 'after' = 'before') =>
        set((s) => {
          const groups = [...s.groups]
          const fromIdx = groups.findIndex((g) => g.name === groupId)
          if (fromIdx === -1) return s
          const [moved] = groups.splice(fromIdx, 1)
          // Recalculate toIdx after splice
          const toIdx = groups.findIndex((g) => g.name === targetGroupId)
          if (toIdx === -1) return s
          const insertIdx = position === 'after' ? toIdx + 1 : toIdx
          groups.splice(insertIdx, 0, moved)
          const allChannels = groups.flatMap((g) => g.channels)
          return { groups, channels: allChannels }
        }),

      reorderChannel: (channelId: string, targetChannelId: string, position?: 'before' | 'after') =>
        set((s) => {
          const groups = s.groups.map((g) => ({ ...g, channels: [...g.channels] }))
          let sourceGroupIdx = -1, sourceIdx = -1
          let targetGroupIdx = -1, targetIdx = -1
          for (let gi = 0; gi < groups.length; gi++) {
            const ci = groups[gi].channels.findIndex((c) => c.id === channelId)
            if (ci !== -1) { sourceGroupIdx = gi; sourceIdx = ci }
            const tj = groups[gi].channels.findIndex((c) => c.id === targetChannelId)
            if (tj !== -1) { targetGroupIdx = gi; targetIdx = tj }
          }
          if (sourceGroupIdx === -1 || targetGroupIdx === -1) return s
          const sourceChs = groups[sourceGroupIdx].channels
          const [moved] = sourceChs.splice(sourceIdx, 1)
          if (sourceGroupIdx === targetGroupIdx) {
            // Recalculate targetIdx after splice from same array
            const newTargetIdx = sourceChs.findIndex((c) => c.id === targetChannelId)
            if (newTargetIdx === -1) {
              sourceChs.push(moved)
            } else {
              const insertIdx = position === 'after' ? newTargetIdx + 1 : newTargetIdx
              sourceChs.splice(insertIdx, 0, moved)
            }
          } else {
            const insertIdx = position === 'after' ? targetIdx + 1 : targetIdx
            groups[targetGroupIdx].channels.splice(insertIdx, 0, moved)
            if (sourceChs.length === 0) {
              groups.splice(sourceGroupIdx, 1)
            }
          }
          const allChannels = groups.flatMap((g) => g.channels)
          return { groups, channels: allChannels }
        }),

      setCurrentChannel: (channel) => set({ currentChannel: channel }),
      setIsPlaying: (playing) => set({ isPlaying: playing }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setNavTab: (tab) => set({ navTab: tab }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setActivePlaylistId: (id) => set({ activePlaylistId: id }),

      addDirectStream: (url: string) => {
        const id = `direct-${++directIdCounter}`
        const label = url.length > 50 ? url.slice(0, 47) + '...' : url
        const ch: Channel = { id, name: label, url, group: i18n.t('group.directPlay') }
        set((s) => {
          const allChannels = [...s.channels, ch]
          return {
            directStreams: [...s.directStreams, ch],
            groups: groupChannels(allChannels),
            channels: allChannels,
          }
        })
        return ch
      },

      removeChannel: (id: string) =>
        set((s) => {
          const filtered = s.channels.filter((ch) => ch.id !== id)
          const directStreams = s.directStreams.filter((ch) => ch.id !== id)
          const favoriteIds = s.favoriteIds.filter((fid) => fid !== id)
          return {
            groups: groupChannels(filtered),
            channels: filtered,
            directStreams,
            currentChannel: s.currentChannel?.id === id ? null : s.currentChannel,
            favoriteIds,
          }
        }),

      toggleFavorite: (id) =>
        set((s) => {
          const exists = s.favoriteIds.includes(id)
          const favoriteIds = exists
            ? s.favoriteIds.filter((fid) => fid !== id)
            : [...s.favoriteIds, id]
          return { favoriteIds }
        }),

      addHistoryEntry: (channel) =>
        set((s) => {
          const { _groupName: _unused, ...cleanChannel } = channel as Channel & { _groupName?: string }
          const filtered = s.historyEntries.filter((e) => e.channel.id !== cleanChannel.id)
          const historyEntries = [{ channel: cleanChannel, watchedAt: Date.now() }, ...filtered].slice(0, 100)
          return { historyEntries }
        }),

      clearHistory: () => set({ historyEntries: [] }),

      addPlaylist: (meta) =>
        set((s) => {
          const playlists = [meta, ...s.playlists.filter((p) => p.id !== meta.id)]
          return { playlists }
        }),

      removePlaylist: (id) =>
        set((s) => {
          const playlists = s.playlists.filter((p) => p.id !== id)
          const filtered = s.channels.filter((ch) => ch.playlistId !== id)
          return {
            playlists,
            groups: groupChannels(filtered),
            channels: filtered,
            activePlaylistId: s.activePlaylistId === id ? null : s.activePlaylistId,
            currentChannel: filtered.some((ch) => ch.id === s.currentChannel?.id)
              ? s.currentChannel
              : null,
          }
        }),

      loadUserData: (data) =>
        set({
          favoriteIds: data.favoriteIds || [],
          historyEntries: (data.historyEntries || []).map((entry) => {
            const { _groupName: _unused, ...cleanChannel } = (entry.channel as Channel & { _groupName?: string })
            return { ...entry, channel: cleanChannel as Channel }
          }),
          playlists: data.playlists || [],
          epgSources: (data as UserData).epgSources || [],
        }),

      epgCache: {},

      loadEpg: async (tvgUrl) => {
        if (!tvgUrl) return
        const programs = await window.electronAPI.fetchEpg(tvgUrl)
        if (programs.length > 0) {
          set((s) => ({ epgCache: { ...s.epgCache, [tvgUrl]: programs as EpgProgram[] } }))
        }
      },

      importEpgFromUrl: async (url) => {
        const result = await window.electronAPI.importEpgFromUrl(url)
        if (result.success) {
          const programs = await window.electronAPI.fetchEpg(url)
          set((s) => {
            const exists = s.epgSources.find((es) => es.url === url)
            const newSource: EpgSource = { url, importedAt: Date.now(), programCount: result.count, tvgIds: result.tvgIds }
            const epgSources = exists
              ? s.epgSources.map((es) => (es.url === url ? newSource : es))
              : [...s.epgSources, newSource]
            return { epgSources, epgCache: { ...s.epgCache, [url]: programs as EpgProgram[] } }
          })
        }
        return result
      },

      removeEpgSource: (url) =>
        set((s) => {
          const epgSources = s.epgSources.filter((es) => es.url !== url)
          const { [url]: _, ...epgCache } = s.epgCache
          return { epgSources, epgCache }
        }),

      appendCheckLog: (log) =>
        set((s) => ({ checkLogs: [...s.checkLogs, log], checkTotal: log.total })),
      setCheckRunning: (v) => set({ checkRunning: v }),
      resetCheck: () => set({ checkLogs: [], checkRunning: false, checkTotal: 0 }),

      updateChannelStatus: (id, status, lastCheckedAt) =>
        set((s) => {
          const groups = s.groups.map((g) => ({
            ...g,
            channels: g.channels.map((ch) =>
              ch.id === id ? { ...ch, status, lastCheckedAt } : ch,
            ),
          }))
          const allChannels = groups.flatMap((g) => g.channels)
          return { groups, channels: allChannels }
        }),
    }),
    {
      name: 'iptv-player-store',
      storage: createJSONStorage(() => ipcStorage),
      partialize: (state) => {
        const partial: Record<string, unknown> = {}
        for (const key of PARTIALIZE_KEYS) {
          partial[key] = state[key]
        }
        return partial as PersistedChannelData
      },
      merge: (persistedState, currentState) => {
        const data = persistedState as Partial<PersistedChannelData>
        const channels = data.channels || []
        return {
          ...currentState,
          ...data,
          groups: groupChannels(channels),
          channels,
        }
      },
    },
  ),
)
