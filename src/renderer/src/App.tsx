import { useState, useEffect, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import PlayerContainer from './components/PlayerContainer'
import TopBar from './components/TopBar'
import SettingsPage from './components/SettingsPage'
import EpgPage from './components/EpgPage'
import Onboarding from './components/Onboarding'
import UpdateDialog from './components/UpdateDialog'
import { useStore } from './stores/useStore'
import { useSettingsStore } from './stores/settingsStore'
import { applyTheme } from './themes'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [epgPageOpen, setEpgPageOpen] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('iptv-player-onboarded')
  })
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const currentChannel = useStore((s) => s.currentChannel)
  const setChannels = useStore((s) => s.setChannels)
  const settingsOpen = useStore((s) => s.settingsOpen)
  const setSettingsOpen = useStore((s) => s.setSettingsOpen)
  const loadUserData = useStore((s) => s.loadUserData)
  const epgSources = useStore((s) => s.epgSources)
  const loadEpg = useStore((s) => s.loadEpg)
  const { loadSettings, settings } = useSettingsStore()

  useEffect(() => {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width < 860) setSidebarOpen(false)
      }
    })
    const root = document.getElementById('root')
    if (root) ro.observe(root)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { loadSettings() }, [loadSettings])

  useEffect(() => {
    if (settings.theme) applyTheme(settings.theme as import('./themes').ThemeId)
    document.documentElement.setAttribute('data-font-size', settings.fontSize)
  }, [settings.theme, settings.fontSize])

  // BUG FIX: onPlaylistsRefreshed / onChannelsCheckDone registered ipcRenderer.on()
  // listeners with no removeListener — accumulated on every StrictMode remount.
  // Now using the unsubscribe-returning wrappers exposed from preload.
  useEffect(() => {
    window.electronAPI.loadChannels().then((channels) => {
      if (channels.length > 0) setChannels(channels)
    })
    window.electronAPI.loadUserData().then((data) => {
      loadUserData(data)
    })

    const offRefreshed = window.electronAPI.onPlaylistsRefreshed((channels) => {
      if (channels.length > 0) setChannels(channels as any)
    })
    const offCheckDone = window.electronAPI.onChannelsCheckDone((channels) => {
      if (channels.length > 0) setChannels(channels as any)
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
  }, [setChannels, loadUserData])

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

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), [])

  useEffect(() => {
    const timer = setTimeout(() => window.electronAPI.notifyLayoutChange(), 100)
    return () => clearTimeout(timer)
  }, [sidebarOpen])

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
          case 'b':
            e.preventDefault()
            toggleSidebar()
            break
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
  }, [toggleSidebar, settingsOpen, openSettings, closeSettings])

  const handleOnboardingDone = useCallback(() => {
    localStorage.setItem('iptv-player-onboarded', '1')
    setShowOnboarding(false)
  }, [])

  return (
    <div className="flex flex-col w-full h-full font-body">
      <TopBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        onOpenSettings={openSettings}
        onOpenEpg={() => setEpgPageOpen(true)}
        onOpenUpdate={() => setShowUpdateDialog(true)}
      />
      <div className="flex-1 flex overflow-hidden">
        <div
          className="flex-shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
          style={{ width: sidebarOpen ? 220 : 56 }}
        >
          <Sidebar collapsed={!sidebarOpen} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 border-l border-tv-border">
          {settingsOpen ? (
            <SettingsPage variant="page" onClose={closeSettings} />
          ) : epgPageOpen ? (
            <EpgPage onClose={() => setEpgPageOpen(false)} />
          ) : (
            <>
              <PlayerContainer />
              <StatusBar />
            </>
          )}
        </div>
      </div>
      {showOnboarding && <Onboarding onDone={handleOnboardingDone} />}
      {showUpdateDialog && <UpdateDialog onClose={() => setShowUpdateDialog(false)} />}
    </div>
  )
}

function StatusBar() {
  const currentChannel = useStore((s) => s.currentChannel)
  const groups = useStore((s) => s.groups)
  const totalChannels = groups.reduce((sum, g) => sum + g.channels.length, 0)
  const [pipActive, setPipActive] = useState(false)
  const { settings } = useSettingsStore()

  // BUG FIX: onPipStateChange had no cleanup — listener accumulated on remounts.
  useEffect(() => {
    const off = window.electronAPI.onPipStateChange((active) => setPipActive(active))
    return () => off?.()
  }, [])

  const isProxied =
    settings.streamProxy &&
    (currentChannel?.url?.startsWith('rtmp') ||
      currentChannel?.url?.startsWith('rtsp') ||
      currentChannel?.url?.startsWith('udp:'))

  return (
    <div className="status-bar">
      {currentChannel ? (
        <>
          <span className="flex items-center gap-1.5">
            <span className="live-dot" />
            正在播放 {currentChannel.name}
          </span>
          {pipActive && <span className="text-xs text-tv-accent ml-1">[画中画]</span>}
          {isProxied && <span className="text-xs text-tv-accent ml-1">[代理]</span>}
          <span className="text-tv-text-secondary">|</span>
        </>
      ) : (
        <span>未在播放</span>
      )}
      <span>共 {totalChannels} 个频道</span>
      <span className="ml-auto">
        {currentChannel?.url?.startsWith('rtmp') && 'RTMP'}
        {currentChannel?.url?.startsWith('rtsp') && 'RTSP'}
        {currentChannel?.url?.endsWith('.m3u8') && 'HLS'}
        {currentChannel?.url?.startsWith('udp:') && 'UDP'}
        {!currentChannel && '就绪'}
      </span>
    </div>
  )
}
