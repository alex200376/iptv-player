import { create } from 'zustand'
import i18n from '../i18n'
import type { Channel, ChannelGroup, PlaylistMeta, HistoryEntry, EpgProgram, EpgSource, UserData } from '../types'

let directIdCounter = 0
let saveTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSave(channels: Channel[]) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    window.electronAPI.saveChannels(channels)
    saveTimer = null
  }, 500)
}

let userDataTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSaveUserData(data: { favoriteIds: string[]; historyEntries: HistoryEntry[]; playlists: PlaylistMeta[]; epgSources?: EpgSource[] }) {
  if (userDataTimer) clearTimeout(userDataTimer)
  userDataTimer = setTimeout(() => {
    window.electronAPI.saveUserData(data)
    userDataTimer = null
  }, 500)
}

interface PlayerStore {
  groups: ChannelGroup[]
  currentChannel: Channel | null
  isPlaying: boolean
  searchQuery: string
  navTab: string
  directStreams: Channel[]
  settingsOpen: boolean
  activePlaylistId: string | null

  favoriteIds: string[]
  historyEntries: HistoryEntry[]
  playlists: PlaylistMeta[]
  epgSources: EpgSource[]

  setChannels: (channels: Channel[]) => void
  reorderGroup: (groupId: string, targetGroupId: string) => void
  reorderChannel: (channelId: string, targetChannelId: string) => void
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

  epgCache: Record<string, EpgProgram[]>
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

export function groupChannels(channels: Channel[]): ChannelGroup[] {
  const map = new Map<string, Channel[]>()
  for (const ch of channels) {
    const g = ch.group || i18n.t('group.ungrouped')
    if (!map.has(g)) map.set(g, [])
    map.get(g)!.push(ch)
  }
  return Array.from(map.entries()).map(([name, channels]) => ({ name, channels }))
}

export const useStore = create<PlayerStore>((set) => ({
  groups: [],
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

  setChannels: (channels) => set({ groups: groupChannels(channels) }),

  reorderGroup: (groupId: string, targetGroupId: string) => set((s) => {
    const groups = [...s.groups]
    const fromIdx = groups.findIndex((g) => g.name === groupId)
    let toIdx = groups.findIndex((g) => g.name === targetGroupId)
    if (fromIdx === -1 || toIdx === -1) return s
    const [moved] = groups.splice(fromIdx, 1)
    if (fromIdx < toIdx) toIdx--
    groups.splice(toIdx, 0, moved)
    const allChannels = groups.flatMap((g) => g.channels)
    debouncedSave(allChannels)
    return { groups }
  }),

  reorderChannel: (channelId: string, targetChannelId: string) => set((s) => {
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
      const adjust = targetIdx > sourceIdx ? targetIdx - 1 : targetIdx
      sourceChs.splice(adjust, 0, moved)
    } else {
      groups[targetGroupIdx].channels.splice(targetIdx, 0, moved)
      if (sourceChs.length === 0) {
        groups.splice(sourceGroupIdx, 1)
      }
    }
    const allChannels = groups.flatMap((g) => g.channels)
    debouncedSave(allChannels)
    return { groups }
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
      const allChannels = [...s.groups.flatMap((g) => g.channels), ch]
      debouncedSave(allChannels)
      return { directStreams: [...s.directStreams, ch], groups: groupChannels(allChannels) }
    })
    return ch
  },

  removeChannel: (id: string) => set((s) => {
    const allChannels = s.groups.flatMap((g) => g.channels)
    const filtered = allChannels.filter((ch) => ch.id !== id)
    const directStreams = s.directStreams.filter((ch) => ch.id !== id)
    const favoriteIds = s.favoriteIds.filter((fid) => fid !== id)
    debouncedSave(filtered)
    debouncedSaveUserData({ favoriteIds, historyEntries: s.historyEntries, playlists: s.playlists })
    return {
      groups: groupChannels(filtered),
      directStreams,
      currentChannel: s.currentChannel?.id === id ? null : s.currentChannel,
      favoriteIds,
    }
  }),

  toggleFavorite: (id) => set((s) => {
    const exists = s.favoriteIds.includes(id)
    const favoriteIds = exists
      ? s.favoriteIds.filter((fid) => fid !== id)
      : [...s.favoriteIds, id]
    debouncedSaveUserData({ favoriteIds, historyEntries: s.historyEntries, playlists: s.playlists, epgSources: s.epgSources })
    return { favoriteIds }
  }),

  addHistoryEntry: (channel) => set((s) => {
    const filtered = s.historyEntries.filter((e) => e.channel.id !== channel.id)
    const historyEntries = [{ channel, watchedAt: Date.now() }, ...filtered].slice(0, 100)
    debouncedSaveUserData({ favoriteIds: s.favoriteIds, historyEntries, playlists: s.playlists, epgSources: s.epgSources })
    return { historyEntries }
  }),

  clearHistory: () => set((s) => {
    debouncedSaveUserData({ favoriteIds: s.favoriteIds, historyEntries: [], playlists: s.playlists, epgSources: s.epgSources })
    return { historyEntries: [] }
  }),

  addPlaylist: (meta) => set((s) => {
    const playlists = [meta, ...s.playlists.filter((p) => p.id !== meta.id)]
    debouncedSaveUserData({ favoriteIds: s.favoriteIds, historyEntries: s.historyEntries, playlists, epgSources: s.epgSources })
    return { playlists }
  }),

  removePlaylist: (id) => set((s) => {
    const playlists = s.playlists.filter((p) => p.id !== id)
    const allChannels = s.groups.flatMap((g) => g.channels)
    const filtered = allChannels.filter((ch) => ch.playlistId !== id)
    debouncedSave(filtered)
    debouncedSaveUserData({ favoriteIds: s.favoriteIds, historyEntries: s.historyEntries, playlists, epgSources: s.epgSources })
    return {
      playlists,
      groups: groupChannels(filtered),
      activePlaylistId: s.activePlaylistId === id ? null : s.activePlaylistId,
      currentChannel: filtered.some((ch) => ch.id === s.currentChannel?.id) ? s.currentChannel : null,
    }
  }),

  loadUserData: (data) => set({
    favoriteIds: data.favoriteIds || [],
    historyEntries: data.historyEntries || [],
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
          ? s.epgSources.map((es) => es.url === url ? newSource : es)
          : [...s.epgSources, newSource]
        debouncedSaveUserData({ favoriteIds: s.favoriteIds, historyEntries: s.historyEntries, playlists: s.playlists, epgSources })
        return { epgSources, epgCache: { ...s.epgCache, [url]: programs as EpgProgram[] } }
      })
    }
    return result
  },

  removeEpgSource: (url) => set((s) => {
    const epgSources = s.epgSources.filter((es) => es.url !== url)
    const { [url]: _, ...epgCache } = s.epgCache
    debouncedSaveUserData({ favoriteIds: s.favoriteIds, historyEntries: s.historyEntries, playlists: s.playlists, epgSources })
    return { epgSources, epgCache }
  }),

  appendCheckLog: (log) => set((s) => ({ checkLogs: [...s.checkLogs, log], checkTotal: log.total })),
  setCheckRunning: (v) => set({ checkRunning: v }),
  resetCheck: () => set({ checkLogs: [], checkRunning: false, checkTotal: 0 }),

  updateChannelStatus: (id, status, lastCheckedAt) => set((s) => {
    const groups = s.groups.map((g) => ({
      ...g,
      channels: g.channels.map((ch) =>
        ch.id === id ? { ...ch, status, lastCheckedAt } : ch,
      ),
    }))
    const allChannels = groups.flatMap((g) => g.channels)
    debouncedSave(allChannels)
    return { groups }
  }),
}))
