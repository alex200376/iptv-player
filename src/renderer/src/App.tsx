import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import PlayerContainer from './components/PlayerContainer'
import NavBar from './components/NavBar'
import TitleBar from './components/TitleBar'
import SettingsPage from './components/SettingsPage'
import EpgPage from './components/EpgPage'
import Onboarding from './components/Onboarding'
import UpdateDialog from './components/UpdateDialog'
import ImportDialog from './components/ImportDialog'
import OpenStreamDialog from './components/OpenStreamDialog'
import { useStore } from './stores/useStore'
import { useSettingsStore } from './stores/settingsStore'
import { applyTheme } from './themes'
import type { Channel } from './types'

export default function App() {
  const [epgPageOpen, setEpgPageOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('iptv-player-onboarded')
  })
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [streamOpen, setStreamOpen] = useState(false)
  const [isDraggingFile, setIsDraggingFile] = useState(false)
  const currentChannel = useStore((s) => s.currentChannel)
  const setChannels = useStore((s) => s.setChannels)
  const groups = useStore((s) => s.groups)
  const addPlaylist = useStore((s) => s.addPlaylist)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const epgSources = useStore((s) => s.epgSources)
  const loadEpg = useStore((s) => s.loadEpg)
  const { loadSettings, settings } = useSettingsStore()

  useEffect(() => { loadSettings() }, [loadSettings])

  useEffect(() => {
    if (settings.theme) applyTheme(settings.theme as import('./themes').ThemeId)
    document.documentElement.setAttribute('data-font-size', settings.fontSize)
  }, [settings.theme, settings.fontSize])

  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated())
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true))
    return unsub
  }, [])

  useEffect(() => {
    if (!hydrated) return

    const offRefreshed = window.electronAPI.onPlaylistsRefreshed((channels) => {
      if (channels.length > 0) setChannels(channels as Channel[])
    })
    const offCheckDone = window.electronAPI.onChannelsCheckDone((channels) => {
      if (channels.length > 0) setChannels(channels as Channel[])
      useStore.setState({ checkRunning: false })
    })
    const offCheckLog = window.electronAPI.onChannelsCheckLog((log) => {
      useStore.getState().appendCheckLog(log)
    })

    return () => {
      offRefreshed?.()
      offCheckDone?.()
      offCheckLog?.()
    }
  }, [hydrated, setChannels])

  useEffect(() => {
    document.title = currentChannel
      ? `${currentChannel.name} - IPTV Player`
      : 'IPTV Player'
  }, [currentChannel])

  useEffect(() => {
    for (const source of epgSources) {
      loadEpg(source.url)
    }
  }, [epgSources, loadEpg])

  useEffect(() => {
    const interval = setInterval(() => {
      for (const source of epgSources) {
        loadEpg(source.url)
      }
    }, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [epgSources, loadEpg])

  useEffect(() => {
    const off = window.electronAPI.onMenuAction((action) => {
      switch (action) {
        case 'import-m3u':
          setImportOpen(true)
          break
        case 'open-stream':
          setStreamOpen(true)
          break
        case 'open-settings':
          setSettingsOpen(true)
          break
        case 'open-epg':
          window.electronAPI.hidePlayer()
          setEpgPageOpen(true)
          break
        case 'check-update':
          setShowUpdateDialog(true)
          break
      }
    })
    return off
  }, [setSettingsOpen])

  const openSettings = useCallback(async () => {
    await window.electronAPI.hidePlayer()
    setSettingsOpen(true)
  }, [])

  const closeSettings = useCallback(() => {
    setSettingsOpen(false)
    const state = useStore.getState()
    if (state.currentChannel) {
      requestAnimationFrame(() => {
        window.electronAPI.switchChannel(state.currentChannel!.url)
      })
    }
  }, [])

  const openEpgPage = useCallback(async () => {
    await window.electronAPI.hidePlayer()
    setEpgPageOpen(true)
  }, [])

  const closeEpgPage = useCallback(() => {
    setEpgPageOpen(false)
    const state = useStore.getState()
    if (state.currentChannel) {
      window.electronAPI.switchChannel(state.currentChannel!.url)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      switch (e.key) {
        case ' ':
          e.preventDefault()
          window.electronAPI.togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          window.electronAPI.skipTime(-10)
          break
        case 'ArrowRight':
          e.preventDefault()
          window.electronAPI.skipTime(10)
          break
        case 'ArrowUp':
          e.preventDefault()
          window.electronAPI.setVolume(
            Math.min(100, parseInt(localStorage.getItem('volume') || '80') + 5),
          )
          break
        case 'ArrowDown':
          e.preventDefault()
          window.electronAPI.setVolume(
            Math.max(0, parseInt(localStorage.getItem('volume') || '80') - 5),
          )
          break
        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            window.electronAPI.toggleFullscreen()
          }
          break
        case 'm':
        case 'M':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            window.electronAPI.toggleMute()
          }
          break
        case 'p':
        case 'P':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            window.electronAPI.togglePip()
          }
          break
        case 'Escape':
          if (settingsOpen) {
            closeSettings()
            return
          }
          window.electronAPI.exitFullscreen()
          break
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case ',':
            e.preventDefault()
            if (settingsOpen) closeSettings()
            else openSettings()
            break
          case 'i':
            e.preventDefault()
            setShowOnboarding(true)
            break
        }
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [settingsOpen, openSettings, closeSettings])

  const handleOnboardingDone = useCallback(() => {
    localStorage.setItem('iptv-player-onboarded', '1')
    setShowOnboarding(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types
    if (!types || Array.prototype.indexOf.call(types, 'Files') === -1) return
    e.preventDefault()
    setIsDraggingFile(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDraggingFile(false)
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith('.m3u') || f.name.endsWith('.m3u8'),
    )
    if (files.length === 0) return
    for (const file of files) {
      const result = await window.electronAPI.importM3UFromFile(file.path)
      if (result.channels && result.channels.length > 0) {
        const allChannels = [...groups.flatMap((g) => g.channels), ...result.channels]
        setChannels(allChannels)
        await window.electronAPI.saveChannels(allChannels as unknown[])
        addPlaylist({
          id: result.playlistId,
          name: result.playlistName,
          source: 'file',
          path: result.filePath,
          importedAt: Date.now(),
          channelCount: result.channels.length,
        })
        const channels = await window.electronAPI.loadChannels()
        setChannels(channels)
      }
    }
  }, [groups, setChannels, addPlaylist])

  return (
    <div
      className="flex flex-col w-full h-full bg-background text-foreground"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="px-10 py-8 bg-card border-2 border-dashed border-primary rounded-xl text-center">
            <svg className="w-12 h-12 mx-auto mb-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-lg font-semibold text-foreground">放開以匯入 M3U 播放列表</p>
          </div>
        </div>
      )}
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        <NavBar onOpenSettings={openSettings} onImport={() => setImportOpen(true)} onOpenStream={() => setStreamOpen(true)} />
        <div className="flex-shrink-0 w-[220px] overflow-hidden border-r border-border">
          <Sidebar />
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          {settingsOpen ? (
            <SettingsPage variant="page" onClose={closeSettings} />
          ) : epgPageOpen ? (
            <EpgPage onClose={closeEpgPage} />
          ) : (
            <PlayerContainer />
          )}
        </div>
      </div>
      {showOnboarding && <Onboarding onDone={handleOnboardingDone} />}
      {showUpdateDialog && <UpdateDialog onClose={() => setShowUpdateDialog(false)} />}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
      {streamOpen && <OpenStreamDialog onClose={() => { setStreamOpen(false); window.electronAPI.showPlayerWindow() }} />}
    </div>
  )
}
