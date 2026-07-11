import { useState, useCallback, useEffect, useRef } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { themes, applyTheme, type ThemeId } from '../themes'
import { useSettingsStore } from '../stores/settingsStore'
import { useStore, groupChannels } from '../stores/useStore'
import type { Channel } from '../types'
import UpdateDialog from './UpdateDialog'
import { useTranslation } from 'react-i18next'

export default function SettingsPage({ variant = 'page', onClose }: { variant?: 'page' | 'overlay'; onClose?: () => void }) {
  const { t, i18n } = useTranslation()
  const { settings, updateSettings } = useSettingsStore()
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [vlcVersion, setVlcVersion] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI.getVlcVersion().then(setVlcVersion).catch(() => setVlcVersion('3.0.23'))
  }, [])

  const handleClose = () => {
    onClose?.()
  }

  const content = (
    <div className={`flex flex-col h-full bg-tv-bg-surface ${variant === 'overlay' ? 'border border-tv-border rounded-tv-md shadow-2xl' : ''}`}>
      <div className="flex items-center justify-between px-8 py-5 border-b border-tv-border">
        <h2 className="text-tv-lg font-bold text-tv-text-primary">{t('settings.title')}</h2>
        <button onClick={handleClose} className="text-tv-text-secondary hover:text-tv-text-primary p-2 rounded-tv-sm">
          <svg className="w-6 h-6" viewBox="0 0 15 15" fill="none"><path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
        <Tabs.Root defaultValue="playback" className="flex-1 flex flex-col overflow-hidden">
          <Tabs.List className="flex gap-1 px-8 pt-4 border-b border-tv-border overflow-x-auto flex-nowrap">
            {[
              { value: 'playback', label: t('settings.playback') },
              { value: 'appearance', label: t('settings.appearance') },
              { value: 'playlists', label: t('settings.playlists') },
              { value: 'verify', label: t('settings.verify') },
              { value: 'epg', label: t('settings.epg') },
              { value: 'about', label: t('settings.about') },
            ].map((tab) => (
              <Tabs.Trigger
                key={tab.value}
                value={tab.value}
                className="px-5 py-3 text-tv-sm text-tv-text-secondary data-[state=active]:text-tv-accent data-[state=active]:border-b-2 data-[state=active]:border-tv-accent transition-colors rounded-tv-sm"
              >
                {tab.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>

          <Tabs.Content value="playback" className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">{t('settings.hardwareAccel')}</label>
              <select
                value={settings.hardwareAcceleration}
                onChange={async (e) => {
                  await updateSettings({ hardwareAcceleration: e.target.value })
                  window.electronAPI.applyHwAccel()
                }}
                className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
              >
                <option value="d3d11va">{t('settings.hardwareAccel.d3d11va')}</option>
                <option value="dxva2">{t('settings.hardwareAccel.dxva2')}</option>
                <option value="vaapi">{t('settings.hardwareAccel.vaapi')}</option>
                <option value="vda">{t('settings.hardwareAccel.vda')}</option>
                <option value="videotoolbox">{t('settings.hardwareAccel.videotoolbox')}</option>
                <option value="none">{t('settings.hardwareAccel.none')}</option>
              </select>
              <p className="text-tv-sm text-tv-text-secondary">{t('settings.hardwareAccelDesc')}</p>
            </div>
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">{t('settings.networkCache')}</label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={500}
                  max={10000}
                  step={100}
                  value={settings.networkCache}
                  onChange={(e) => updateSettings({ networkCache: parseInt(e.target.value) })}
                  className="flex-1 accent-tv-accent h-2"
                />
                <span className="text-tv-sm text-tv-text-primary w-20 text-right">{settings.networkCache}ms</span>
              </div>
            </div>
            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                id="compat-mode"
                checked={settings.compatibilityMode}
                onChange={(e) => updateSettings({ compatibilityMode: e.target.checked })}
                className="w-4 h-4 accent-tv-accent"
              />
              <label htmlFor="compat-mode" className="text-tv-sm text-tv-text-primary cursor-pointer select-none">
                {t('settings.compatMode')}
              </label>
              <span className="text-tv-xs text-tv-text-secondary">{t('settings.compatModeDesc')}</span>
            </div>
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">{t('settings.h264Threads')}</label>
              <select
                value={settings.h264Threads}
                onChange={(e) => updateSettings({ h264Threads: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
              >
                <option value={0}>{t('settings.h264Threads.auto')}</option>
                <option value={1}>{t('settings.h264Threads.count', { count: 1 })}</option>
                <option value={2}>{t('settings.h264Threads.count', { count: 2 })}</option>
                <option value={4}>{t('settings.h264Threads.count', { count: 4 })}</option>
                <option value={8}>{t('settings.h264Threads.count', { count: 8 })}</option>
              </select>
              <p className="text-tv-sm text-tv-text-secondary">{t('settings.h264ThreadsDesc')}</p>
            </div>
            <div className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                id="avcodec-hw"
                checked={settings.avcodecHwDisabled}
                onChange={(e) => updateSettings({ avcodecHwDisabled: e.target.checked })}
                className="w-4 h-4 accent-tv-accent"
              />
              <label htmlFor="avcodec-hw" className="text-tv-sm text-tv-text-primary cursor-pointer select-none">
                {t('settings.disableAvcodecHw')}
              </label>
              <span className="text-tv-xs text-tv-text-secondary">{t('settings.disableAvcodecHwDesc')}</span>
            </div>
            <div className="space-y-3 pt-2 border-t border-tv-border">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="auto-reconnect"
                  checked={settings.autoReconnect}
                  onChange={(e) => updateSettings({ autoReconnect: e.target.checked })}
                  className="w-4 h-4 accent-tv-accent"
                />
                <label htmlFor="auto-reconnect" className="text-tv-sm text-tv-text-primary cursor-pointer select-none">
                  {t('settings.autoReconnect')}
                </label>
              </div>
              {settings.autoReconnect && (
                <div className="flex items-center gap-4 pl-7">
                  <span className="text-tv-sm text-tv-text-secondary">{t('settings.reconnectInterval')}</span>
                  <select
                    value={settings.reconnectInterval}
                    onChange={(e) => updateSettings({ reconnectInterval: parseInt(e.target.value) })}
                    className="px-3 py-1.5 bg-tv-bg border border-tv-border rounded-tv-sm text-tv-sm text-tv-text-primary"
                  >
                    <option value={1000}>{t('settings.reconnectSec', { count: 1 })}</option>
                    <option value={2000}>{t('settings.reconnectSec', { count: 2 })}</option>
                    <option value={3000}>{t('settings.reconnectSec', { count: 3 })}</option>
                    <option value={5000}>{t('settings.reconnectSec', { count: 5 })}</option>
                    <option value={10000}>{t('settings.reconnectSec', { count: 10 })}</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3 py-2 border-t border-tv-border pt-4">
              <input
                type="checkbox"
                id="stream-proxy"
                checked={settings.streamProxy}
                onChange={(e) => updateSettings({ streamProxy: e.target.checked })}
                className="w-4 h-4 accent-tv-accent"
              />
              <label htmlFor="stream-proxy" className="text-tv-sm text-tv-text-primary cursor-pointer select-none">
                {t('settings.streamProxy')}
              </label>
              <span className="text-tv-xs text-tv-text-secondary">{t('settings.streamProxyDesc')}</span>
            </div>
            {settings.streamProxy && (
              <div className="space-y-3 pl-7">
                <label className="block text-tv-sm font-medium text-tv-text-primary">{t('settings.proxyResolution')}</label>
                <select
                  value={settings.proxyResolution}
                  onChange={(e) => updateSettings({ proxyResolution: e.target.value })}
                  className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
                >
                  <option value="original">{t('settings.proxyResolution.original')}</option>
                  <option value="2160p">{t('settings.proxyResolution.2160p')}</option>
                  <option value="1440p">{t('settings.proxyResolution.1440p')}</option>
                  <option value="1080p">{t('settings.proxyResolution.1080p')}</option>
                  <option value="720p">{t('settings.proxyResolution.720p')}</option>
                  <option value="540p">{t('settings.proxyResolution.540p')}</option>
                  <option value="480p">{t('settings.proxyResolution.480p')}</option>
                  <option value="360p">{t('settings.proxyResolution.360p')}</option>
                </select>
                <p className="text-tv-xs text-tv-text-secondary">{t('settings.proxyResolutionDesc')}</p>
              </div>
            )}
            <div className="space-y-3 pt-2 border-t border-tv-border">
              <label className="block text-tv-sm font-medium text-tv-text-primary">{t('settings.playlistAutoRefresh')}</label>
              <select
                value={settings.playlistRefreshInterval}
                onChange={(e) => updateSettings({ playlistRefreshInterval: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
              >
                <option value={0}>{t('settings.playlistAutoRefresh.off')}</option>
                <option value={15}>{t('settings.playlistAutoRefresh.15min')}</option>
                <option value={30}>{t('settings.playlistAutoRefresh.30min')}</option>
                <option value={60}>{t('settings.playlistAutoRefresh.1hour')}</option>
                <option value={360}>{t('settings.playlistAutoRefresh.6hours')}</option>
                <option value={1440}>{t('settings.playlistAutoRefresh.daily')}</option>
              </select>
              <p className="text-tv-sm text-tv-text-secondary">{t('settings.playlistAutoRefreshDesc')}</p>
            </div>
          </Tabs.Content>

          <Tabs.Content value="appearance" className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">{t('settings.theme')}</label>
              <select
                value={settings.theme}
                onChange={(e) => {
                  updateSettings({ theme: e.target.value as ThemeId })
                  applyTheme(e.target.value as ThemeId)
                }}
                className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
              >
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>{t(theme.labelKey)}</option>
                ))}
              </select>
              {(() => {
                const th = themes.find((th) => th.id === settings.theme) || themes[0]
                const bg = th.variables['--tv-bg']
                const secondary = th.variables['--tv-bg-secondary']
                const card = th.variables['--tv-bg-surface']
                const text = th.variables['--tv-text-primary']
                const muted = th.variables['--tv-text-secondary']
                const accent = th.variables['--tv-accent']
                const border = th.variables['--tv-border']
                return (
                  <div
                    className="mt-3 rounded-tv-md border overflow-hidden"
                    style={{ background: bg, borderColor: border, color: text }}
                  >
                    <div className="px-4 py-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{t(th.labelKey)} Theme</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: accent, color: '#fff' }}>Preview</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: accent, color: '#fff' }}>A</div>
                        <div className="text-xs" style={{ color: text }}>Display Name</div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold" style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>Live</span>
                      </div>
                      <div className="h-1.5 rounded-full" style={{ background: muted }} />
                      <div className="text-xs leading-relaxed" style={{ color: muted }}>
                        Current program title with a longer description that shows how the text appears in this theme.
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="px-2 py-1 rounded" style={{ background: accent, color: '#fff' }}>{t('player.epgButton')}</span>
                        <span className="px-2 py-1 rounded" style={{ background: card, border: `1px solid ${border}`, color: muted }}>Sub button</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 px-4 py-2.5" style={{ background: secondary, borderTop: `1px solid ${border}` }}>
                      <div className="flex gap-1.5">
                        {[bg, card, accent, text, border].map((c, i) => (
                          <div key={i} className="w-5 h-5 rounded" style={{ background: c, border: i === 4 ? `1px solid ${muted}` : undefined }} title={c} />
                        ))}
                      </div>
                      <div className="text-[10px]" style={{ color: muted }}>BG · CARD · ACCENT · TEXT · BORDER</div>
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">{t('settings.fontSize')}</label>
              <div className="flex gap-3">
                {[
                  { value: 'small', label: t('settings.fontSize.small') },
                  { value: 'normal', label: t('settings.fontSize.normal') },
                  { value: 'large', label: t('settings.fontSize.large') },
                  { value: 'xlarge', label: t('settings.fontSize.xlarge') },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateSettings({ fontSize: opt.value as 'small' | 'normal' | 'large' | 'xlarge' })}
                    className={`flex-1 py-3 px-4 rounded-tv-md border-2 text-tv-sm transition-colors ${
                      settings.fontSize === opt.value
                        ? 'border-tv-accent bg-tv-accent/10 text-tv-text-primary'
                        : 'border-tv-border bg-tv-bg text-tv-text-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">{t('settings.language')}</label>
              <select
                value={settings.language}
                onChange={async (e) => {
                  const lang = e.target.value as 'zh-CN' | 'en-US'
                  await updateSettings({ language: lang })
                  i18n.changeLanguage(lang)
                  document.documentElement.lang = lang
                }}
                className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
              >
                <option value="zh-CN">{t('language.zhCN')}</option>
                <option value="en-US">{t('language.enUS')}</option>
              </select>
            </div>
          </Tabs.Content>

          <Tabs.Content value="playlists" className="flex-1 overflow-y-auto p-8 space-y-4">
            <p className="text-tv-sm text-tv-text-secondary">{t('settings.playlistSettings')}</p>
            <PlaylistSettingsList />
          </Tabs.Content>

          <Tabs.Content value="verify" className="flex-1 overflow-y-auto p-8 space-y-4">
            <ChannelVerifier />
          </Tabs.Content>

          <Tabs.Content value="epg" className="flex-1 overflow-y-auto p-8 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-tv-sm text-tv-text-secondary">{t('settings.epgSettings')}</p>
            </div>
            <EpgSourceSettings />
          </Tabs.Content>

          <Tabs.Content value="about" className="flex-1 overflow-y-auto p-8 space-y-4">
            <div className="space-y-2 text-tv-sm text-tv-text-primary">
              <p><strong>IPTV Player</strong></p>
              <p className="text-tv-text-secondary">{t('settings.aboutDesc')}</p>
              <p className="text-tv-text-secondary">{t('settings.aboutFormats')}</p>
            </div>
            <div className="pt-4 border-t border-tv-border space-y-4">
              <p className="text-tv-sm text-tv-text-secondary">{t('settings.vlcVersion')}: {vlcVersion || '3.0.23'}</p>
              <div className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  id="auto-download-updates"
                  checked={settings.autoDownloadUpdates}
                  onChange={(e) => updateSettings({ autoDownloadUpdates: e.target.checked })}
                  className="w-4 h-4 accent-tv-accent"
                />
                <label htmlFor="auto-download-updates" className="text-tv-sm text-tv-text-primary cursor-pointer select-none">
                {t('settings.autoDownloadUpdates')}
              </label>
              <span className="text-tv-xs text-tv-text-secondary">{t('settings.autoDownloadUpdatesDesc')}</span>
              </div>
              <button
                onClick={() => setShowUpdateDialog(true)}
                className="w-full py-2.5 bg-tv-accent text-white text-tv-sm rounded-tv-md hover:bg-tv-accent-hover transition-colors"
              >
                {t('settings.checkUpdate')}
              </button>
              <div className="pt-4 border-t border-tv-border space-y-3">
                <p className="text-tv-sm font-medium text-tv-text-primary">{t('settings.backup')}</p>
                <p className="text-tv-xs text-tv-text-secondary">{t('settings.backupDesc')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      const result = await window.electronAPI.backupData()
                      if (result.success) {
                        alert(t('settings.backupSuccess'))
                      } else if (result.error) {
                        alert(result.error)
                      }
                    }}
                    className="flex-1 py-2 bg-tv-bg border border-tv-border text-tv-text-primary text-tv-sm rounded-tv-md hover:bg-tv-bg-surface transition-colors"
                  >
                    {t('settings.backup')}
                  </button>
                   <button
                     onClick={async () => {
                       const result = await window.electronAPI.restoreData()
                       if (result.success) {
                         const channels = await window.electronAPI.loadChannels()
                         const userData = await window.electronAPI.loadUserData()
                         useStore.setState({
                           groups: groupChannels(channels as Channel[]),
                           currentChannel: null,
                           isPlaying: false,
                           searchQuery: '',
                           navTab: 'channels',
                           directStreams: [],
                           settingsOpen: false,
                           activePlaylistId: null,
                           favoriteIds: userData.favoriteIds || [],
                           historyEntries: userData.historyEntries || [],
                           playlists: userData.playlists || [],
                           epgSources: userData.epgSources || [],
                           checkLogs: [],
                           checkRunning: false,
                           checkTotal: 0,
                         })
                         await useSettingsStore.getState().loadSettings()
                         const newSettings = useSettingsStore.getState().settings
                         i18n.changeLanguage(newSettings.language)
                         document.documentElement.lang = newSettings.language
                         alert(t('settings.restoreSuccess', { channels: info.channels, playlists: info.playlists }))
                         onClose?.()
                       } else if (result.error) {
                         alert(result.error)
                       }
                     }}
                     className="flex-1 py-2 bg-tv-bg border border-tv-border text-tv-text-primary text-tv-sm rounded-tv-md hover:bg-tv-bg-surface transition-colors"
                   >
                     {t('settings.restore')}
                   </button>
                </div>
              </div>
              <div className="pt-4 border-t border-tv-border space-y-3">
                <p className="text-tv-sm font-medium text-red-400">{t('settings.clearAllData')}</p>
                <p className="text-tv-xs text-tv-text-secondary">{t('settings.clearAllDataDesc')}</p>
                {!confirmClear ? (
                  <button
                    onClick={() => setConfirmClear(true)}
                    className="w-full py-2.5 bg-red-900/40 text-red-400 text-tv-sm rounded-tv-md hover:bg-red-900/60 transition-colors border border-red-800"
                  >
                    {t('settings.clearAllData')}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-tv-xs text-red-400">{t('settings.clearAllDataConfirm')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const result = await window.electronAPI.clearAllData()
                          if (result.success) {
                            useStore.setState({
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
                            })
                            await useSettingsStore.getState().loadSettings()
                            const newSettings = useSettingsStore.getState().settings
                            i18n.changeLanguage(newSettings.language)
                            document.documentElement.lang = newSettings.language
                            onClose?.()
                          } else {
                            console.error('[clearAllData]', result.error)
                          }
                          setConfirmClear(false)
                        }}
                        className="flex-1 py-2 bg-red-700 text-white text-tv-sm rounded-tv-md hover:bg-red-600 transition-colors"
                      >
                        {t('settings.confirmClear')}
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        className="flex-1 py-2 bg-tv-bg border border-tv-border text-tv-text-secondary text-tv-sm rounded-tv-md hover:bg-tv-bg-surface transition-colors"
                      >
                        {t('playlist.cancel')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {showUpdateDialog && <UpdateDialog onClose={() => setShowUpdateDialog(false)} />}
          </Tabs.Content>
        </Tabs.Root>
      </div>
  )

  if (variant === 'overlay') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-[fadeIn_200ms_ease]">
        <div className="w-[90vw] max-w-[700px] max-h-[85vh] overflow-hidden">
          {content}
        </div>
      </div>
    )
  }

  return <div className="w-full h-full overflow-hidden">{content}</div>
}

function ChannelVerifier() {
  const { t } = useTranslation()
  const logs = useStore((s) => s.checkLogs)
  const running = useStore((s) => s.checkRunning)
  const totalCh = useStore((s) => s.checkTotal)
  const resetCheck = useStore((s) => s.resetCheck)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const onlineCount = logs.filter((l) => l.result === 'online').length
  const offlineCount = logs.filter((l) => l.result === 'offline').length
  const skippedCount = logs.filter((l) => l.result === 'skipped').length
  const remaining = totalCh - logs.length

  const handleStart = async () => {
    resetCheck()
    useStore.setState({ checkRunning: true })
    await window.electronAPI.checkAllChannels()
  }

  const handleCancel = () => {
    window.electronAPI.cancelCheckAll()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        {!running ? (
          <button
            onClick={handleStart}
            className="px-5 py-2 bg-tv-accent text-white text-tv-sm rounded-tv-md hover:bg-tv-accent-hover transition-colors"
          >
             {t('verify.start')}
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="px-5 py-2 bg-red-700 text-white text-tv-sm rounded-tv-md hover:bg-red-600 transition-colors"
            >
              {t('verify.cancel')}
            </button>
          )}
          {logs.length > 0 && running && (
            <span className="text-tv-xs text-tv-text-secondary ml-1">
              {t('verify.checking', { done: logs.length, total: totalCh })}
            </span>
          )}
        </div>

        {logs.length > 0 && (
          <div className="flex items-center gap-4 text-tv-xs">
            <span className="text-green-500">{t('verify.online', { count: onlineCount })}</span>
            <span className="text-red-500">{t('verify.offline', { count: offlineCount })}</span>
            {skippedCount > 0 && <span className="text-gray-500">{t('verify.skipped', { count: skippedCount })}</span>}
            {remaining > 0 && <span className="text-gray-500">{t('verify.remaining', { count: remaining })}</span>}
            <span className="text-tv-text-secondary">{t('verify.total', { count: totalCh })}</span>
            <span className="ml-auto text-tv-text-secondary">
              {running ? t('verify.autoUpdate') : t('verify.done')}
            </span>
        </div>
      )}

      <div
        ref={logRef}
        className="h-80 overflow-y-auto bg-[#0d0e12] border border-tv-border rounded-tv-md font-mono text-tv-xs leading-relaxed"
      >
        {logs.length === 0 && !running && (
          <div className="flex items-center justify-center h-full text-tv-text-secondary">
            {t('verify.emptyHint')}
          </div>
        )}
        {logs.length === 0 && running && (
          <div className="flex items-center justify-center h-full text-tv-text-secondary">
            {t('verify.checkingHint')}
          </div>
        )}
        {logs.map((log, i) => {
          let color = ''
          let icon = ''
          if (log.result === 'online') { color = 'text-green-400'; icon = 'OK' }
          else if (log.result === 'offline') { color = 'text-red-400'; icon = 'XX' }
          else if (log.result === 'skipped') { color = 'text-gray-500'; icon = '--' }
          else { color = 'text-gray-500'; icon = '??' }

          const protoColor =
            log.protocol === 'hls' ? 'text-blue-400' :
            log.protocol === 'http' ? 'text-cyan-400' :
            log.protocol === 'ts' ? 'text-emerald-400' :
            log.protocol === 'rtmp' ? 'text-yellow-400' :
            log.protocol === 'rtsp' ? 'text-purple-400' :
            log.protocol === 'm3u' ? 'text-orange-400' :
            log.protocol === 'udp' ? 'text-gray-600' : 'text-gray-500'

          return (
            <div key={i} className={`flex items-center gap-2 px-3 py-0.5 ${i % 2 === 0 ? 'bg-black/20' : ''}`}>
              <span className={`w-6 text-center font-bold flex-shrink-0 ${color}`}>{icon}</span>
              <span className={`w-12 flex-shrink-0 ${protoColor}`}>{log.protocol.toUpperCase()}</span>
              <span className="truncate flex-1 text-tv-text-primary">{log.name}</span>
              <span className="text-tv-text-secondary flex-shrink-0 w-16 text-right">{log.checked}/{log.total}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function PlaylistSettingsList() {
  const { t } = useTranslation()
  const playlists = useStore((s) => s.playlists)
  const removePlaylist = useStore((s) => s.removePlaylist)
  const setActivePlaylistId = useStore((s) => s.setActivePlaylistId)
  const activePlaylistId = useStore((s) => s.activePlaylistId)
  const setNavTab = useStore((s) => s.setNavTab)
  const setChannels = useStore((s) => s.setChannels)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [refreshingUrl, setRefreshingUrl] = useState<string | null>(null)

  const handleRefreshUrl = async (url: string) => {
    setRefreshingUrl(url)
    const result = await window.electronAPI.refreshPlaylistUrl(url)
    setRefreshingUrl(null)
    if (result.error) {
      console.error('[refresh]', url, result.error)
    }
    const channels = await window.electronAPI.loadChannels()
    setChannels(channels)
  }

  if (playlists.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 border-2 border-dashed border-tv-border rounded-tv-md text-tv-sm text-tv-text-secondary">
        {t('playlist.empty')}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {playlists.map((pl) => (
        <div key={pl.id} className="flex items-center justify-between px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md">
          <div className="flex-1 min-w-0">
            <div className="text-tv-sm text-tv-text-primary truncate">{pl.name}</div>
            <div className="text-tv-xs text-tv-text-secondary">
              {t('playlist.channelCount', { count: pl.channelCount, source: pl.source === 'file' ? t('playlist.localFile') : t('playlist.onlineUrl') })}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {pl.source === 'url' && pl.url && (
              <button
                onClick={() => handleRefreshUrl(pl.url!)}
                disabled={refreshingUrl === pl.url}
                className="px-3 py-1 rounded-tv-sm text-tv-xs bg-tv-bg-surface text-tv-text-secondary hover:text-tv-accent transition-colors disabled:opacity-40"
              >
                {refreshingUrl === pl.url ? t('playlist.updating') : t('playlist.update')}
              </button>
            )}
            <button
              onClick={() => { setActivePlaylistId(pl.id); setNavTab('channels') }}
              className={`px-3 py-1 rounded-tv-sm text-tv-xs font-medium transition-colors ${
                activePlaylistId === pl.id
                  ? 'bg-tv-accent/20 text-tv-accent'
                  : 'bg-tv-bg-surface text-tv-text-secondary hover:text-tv-text-primary'
              }`}
            >
              {activePlaylistId === pl.id ? t('playlist.viewing') : t('playlist.view')}
            </button>
            <button
              onClick={() => {
                if (confirmDelete === pl.id) {
                  removePlaylist(pl.id)
                  setConfirmDelete(null)
                } else {
                  setConfirmDelete(pl.id)
                }
              }}
              className={`px-3 py-1 rounded-tv-sm text-tv-xs transition-colors ${
                confirmDelete === pl.id
                  ? 'bg-red-900/40 text-red-400 font-medium'
                  : 'bg-tv-bg-surface text-tv-text-secondary hover:text-red-400'
              }`}
            >
              {confirmDelete === pl.id ? t('playlist.confirmDelete') : t('playlist.delete')}
            </button>
            {confirmDelete === pl.id && (
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1 rounded-tv-sm text-tv-xs bg-tv-bg-surface text-tv-text-secondary hover:text-tv-text-primary transition-colors"
              >
                {t('playlist.cancel')}
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        onClick={() => { setActivePlaylistId(null); setNavTab('channels') }}
        className="w-full py-2 text-tv-xs text-tv-accent hover:text-tv-accent-hover transition-colors text-center"
      >
        {t('playlist.showAll')}
      </button>
    </div>
  )
}

function EpgSourceSettings() {
  const { t } = useTranslation()
  const epgSources = useStore((s) => s.epgSources)
  const importEpgFromUrl = useStore((s) => s.importEpgFromUrl)
  const removeEpgSource = useStore((s) => s.removeEpgSource)
  const loadEpg = useStore((s) => s.loadEpg)
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [refreshingEpgUrl, setRefreshingEpgUrl] = useState<string | null>(null)

  const handleRefreshEpg = async (epgUrl: string) => {
    setRefreshingEpgUrl(epgUrl)
    await loadEpg(epgUrl)
    setRefreshingEpgUrl(null)
  }

  const handleImport = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setImporting(true)
    setMsg(null)
    const result = await importEpgFromUrl(trimmed)
    setImporting(false)
    if (result.success) {
      setMsg({ ok: true, text: t('epg.importSuccess', { count: result.count }) })
      setUrl('')
    } else {
      setMsg({ ok: false, text: result.error || t('epg.importFailed') })
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleImport()}
          placeholder={t('epg.importPlaceholder')}
          disabled={importing}
          className="flex-1 px-3 py-2 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary placeholder-tv-text-secondary"
        />
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-4 py-2 bg-tv-accent text-white text-tv-sm rounded-tv-md hover:bg-tv-accent-hover transition-colors disabled:opacity-50"
        >
          {importing ? t('epg.importing') : t('epg.import')}
        </button>
      </div>
      {msg && (
        <p className={`text-tv-xs ${msg.ok ? 'text-green-500' : 'text-red-400'}`}>{msg.text}</p>
      )}

      {epgSources.length === 0 ? (
        <div className="flex items-center justify-center h-24 border-2 border-dashed border-tv-border rounded-tv-md text-tv-sm text-tv-text-secondary">
          {t('epg.noEpgData')}
        </div>
      ) : (
        <div className="space-y-2">
          {epgSources.map((es) => (
            <div key={es.url} className="flex items-center justify-between px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md">
              <div className="flex-1 min-w-0">
                <div className="text-tv-sm text-tv-text-primary truncate">{es.url}</div>
                <div className="text-tv-xs text-tv-text-secondary">
                  {t('epg.programCount', { count: es.programCount, channels: es.tvgIds.length })}
                </div>
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => handleRefreshEpg(es.url)}
                  disabled={refreshingEpgUrl === es.url}
                  className="px-3 py-1 rounded-tv-sm text-tv-xs bg-tv-bg-surface text-tv-text-secondary hover:text-tv-accent transition-colors disabled:opacity-40"
                >
                  {refreshingEpgUrl === es.url ? t('playlist.updating') : t('playlist.update')}
                </button>
                <button
                  onClick={() => removeEpgSource(es.url)}
                  className="px-3 py-1 rounded-tv-sm text-tv-xs bg-tv-bg-surface text-tv-text-secondary hover:text-red-400 transition-colors"
                >
                  {t('playlist.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
