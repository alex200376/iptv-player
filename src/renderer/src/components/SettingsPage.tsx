import { useState, useCallback } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import { themes, applyTheme, type ThemeId } from '../themes'
import { useSettingsStore } from '../stores/settingsStore'
import { useStore } from '../stores/useStore'
import UpdateDialog from './UpdateDialog'

export default function SettingsPage({ variant = 'page', onClose }: { variant?: 'page' | 'overlay'; onClose?: () => void }) {
  const { settings, updateSettings } = useSettingsStore()
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)

  const handleClose = () => {
    onClose?.()
  }

  const content = (
    <div className={`flex flex-col h-full bg-tv-bg-surface ${variant === 'overlay' ? 'border border-tv-border rounded-tv-md shadow-2xl' : ''}`}>
      <div className="flex items-center justify-between px-8 py-5 border-b border-tv-border">
        <h2 className="text-tv-lg font-bold text-tv-text-primary">设置</h2>
        <button onClick={handleClose} className="text-tv-text-secondary hover:text-tv-text-primary p-2 rounded-tv-sm">
          <svg className="w-6 h-6" viewBox="0 0 15 15" fill="none"><path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
        <Tabs.Root defaultValue="playback" className="flex-1 flex flex-col overflow-hidden">
          <Tabs.List className="flex gap-1 px-8 pt-4 border-b border-tv-border">
            {[
              { value: 'playback', label: '播放' },
              { value: 'appearance', label: '外观' },
              { value: 'playlists', label: '播放列表' },
              { value: 'epg', label: 'EPG' },
              { value: 'about', label: '关于' },
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
              <label className="block text-tv-sm font-medium text-tv-text-primary">硬件加速</label>
              <select
                value={settings.hardwareAcceleration}
                onChange={async (e) => {
                  await updateSettings({ hardwareAcceleration: e.target.value })
                  window.electronAPI.applyHwAccel()
                }}
                className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
              >
                <option value="d3d11va">Direct3D11 VA (推荐)</option>
                <option value="dxva2">DXVA2</option>
                <option value="vaapi">VAAPI</option>
                <option value="vda">VDA</option>
                <option value="videotoolbox">VideoToolbox</option>
                <option value="none">关闭</option>
              </select>
              <p className="text-tv-sm text-tv-text-secondary">切换 HW 后需要重新播放才能生效</p>
            </div>
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">网络缓存</label>
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
                解码兼容模式
              </label>
              <span className="text-tv-xs text-tv-text-secondary">（get_buffer failed / 花屏时开启，软件解码）</span>
            </div>
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">H.264 解码线程数</label>
              <select
                value={settings.h264Threads}
                onChange={(e) => updateSettings({ h264Threads: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
              >
                <option value={0}>自动（默认）</option>
                <option value={1}>1 线程</option>
                <option value={2}>2 线程</option>
                <option value={4}>4 线程</option>
                <option value={8}>8 线程</option>
              </select>
              <p className="text-tv-sm text-tv-text-secondary">增加线程数可提升解码性能，过高可能导致不稳定</p>
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
                禁用 avcodec 硬件解码
              </label>
              <span className="text-tv-xs text-tv-text-secondary">（花屏/绿屏时开启，强制软件解码）</span>
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
                  播失败自动重连
                </label>
              </div>
              {settings.autoReconnect && (
                <div className="flex items-center gap-4 pl-7">
                  <span className="text-tv-sm text-tv-text-secondary">重连间隔</span>
                  <select
                    value={settings.reconnectInterval}
                    onChange={(e) => updateSettings({ reconnectInterval: parseInt(e.target.value) })}
                    className="px-3 py-1.5 bg-tv-bg border border-tv-border rounded-tv-sm text-tv-sm text-tv-text-primary"
                  >
                    <option value={1000}>1 秒</option>
                    <option value={2000}>2 秒</option>
                    <option value={3000}>3 秒</option>
                    <option value={5000}>5 秒</option>
                    <option value={10000}>10 秒</option>
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
                串流转发代理
              </label>
              <span className="text-tv-xs text-tv-text-secondary">（RTMP/RTSP/UDP 转 HTTP-FLV，需系统安装 ffmpeg）</span>
            </div>
            {settings.streamProxy && (
              <div className="space-y-3 pl-7">
                <label className="block text-tv-sm font-medium text-tv-text-primary">自动缩放分辨率</label>
                <select
                  value={settings.proxyResolution}
                  onChange={(e) => updateSettings({ proxyResolution: e.target.value })}
                  className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
                >
                  <option value="original">原始分辨率（直接复制，不重新编码）</option>
                  <option value="2160p">4K (2160p)</option>
                  <option value="1440p">2K (1440p)</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="540p">540p</option>
                  <option value="480p">480p</option>
                  <option value="360p">360p</option>
                </select>
                <p className="text-tv-xs text-tv-text-secondary">缩放需重新编码，CPU 占用较高；建议 720p 平衡画质与性能</p>
              </div>
            )}
            <div className="space-y-3 pt-2 border-t border-tv-border">
              <label className="block text-tv-sm font-medium text-tv-text-primary">播放列表自动刷新</label>
              <select
                value={settings.playlistRefreshInterval}
                onChange={(e) => updateSettings({ playlistRefreshInterval: parseInt(e.target.value) })}
                className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary"
              >
                <option value={0}>关闭</option>
                <option value={15}>每 15 分钟</option>
                <option value={30}>每 30 分钟</option>
                <option value={60}>每 1 小时</option>
                <option value={360}>每 6 小时</option>
                <option value={1440}>每天</option>
              </select>
              <p className="text-tv-sm text-tv-text-secondary">重新拉取 URL 播放列表并更新频道信息</p>
            </div>
          </Tabs.Content>

          <Tabs.Content value="appearance" className="flex-1 overflow-y-auto p-8 space-y-6">
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">主题</label>
              <div className="grid grid-cols-2 gap-3">
                {themes.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      updateSettings({ theme: t.id as ThemeId })
                      applyTheme(t.id as ThemeId)
                    }}
                    className={`flex items-center gap-3 px-4 py-4 rounded-tv-md border-2 text-tv-sm transition-colors ${
                      settings.theme === t.id
                        ? 'border-tv-accent bg-tv-accent/10 text-tv-text-primary'
                        : 'border-tv-border bg-tv-bg text-tv-text-secondary hover:border-tv-text-secondary'
                    }`}
                    style={{
                      '--demo-bg': t.variables['--tv-bg'],
                      '--demo-text': t.variables['--tv-text-primary'],
                      '--demo-accent': t.variables['--tv-accent'],
                    } as React.CSSProperties}
                  >
                    <span className="w-8 h-8 rounded-tv-md" style={{ background: 'var(--demo-bg)', border: '2px solid var(--demo-accent)' }} />
                    <div className="text-left">
                      <div className="font-medium">{t.label}</div>
                      <div className="text-xs opacity-60" style={{ color: 'var(--demo-text)' }}>{t.id}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <label className="block text-tv-sm font-medium text-tv-text-primary">字号</label>
              <div className="flex gap-3">
                {[
                  { value: 'small', label: '小' },
                  { value: 'normal', label: '标准' },
                  { value: 'large', label: '大' },
                  { value: 'xlarge', label: '超大' },
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
          </Tabs.Content>

          <Tabs.Content value="playlists" className="flex-1 overflow-y-auto p-8 space-y-4">
            <p className="text-tv-sm text-tv-text-secondary">已导入的播放列表</p>
            <PlaylistSettingsList />
          </Tabs.Content>

          <Tabs.Content value="epg" className="flex-1 overflow-y-auto p-8 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-tv-sm text-tv-text-secondary">已导入的 EPG 数据源</p>
            </div>
            <EpgSourceSettings />
          </Tabs.Content>

          <Tabs.Content value="about" className="flex-1 overflow-y-auto p-8 space-y-4">
            <div className="space-y-2 text-tv-sm text-tv-text-primary">
              <p><strong>IPTV Player</strong></p>
              <p className="text-tv-text-secondary">基于 Electron + React + libVLC 构建</p>
              <p className="text-tv-text-secondary">支持 RTMP / RTSP / HLS / M3U / UDP</p>
            </div>
            <div className="pt-4 border-t border-tv-border space-y-4">
              <p className="text-tv-sm text-tv-text-secondary">VLC 版本: 3.0.23</p>
              <div className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  id="auto-download-updates"
                  checked={settings.autoDownloadUpdates}
                  onChange={(e) => updateSettings({ autoDownloadUpdates: e.target.checked })}
                  className="w-4 h-4 accent-tv-accent"
                />
                <label htmlFor="auto-download-updates" className="text-tv-sm text-tv-text-primary cursor-pointer select-none">
                  背景自动下载更新
                </label>
                <span className="text-tv-xs text-tv-text-secondary">（发现新版后自动下载，不打扰）</span>
              </div>
              <button
                onClick={() => setShowUpdateDialog(true)}
                className="w-full py-2.5 bg-tv-accent text-white text-tv-sm rounded-tv-md hover:bg-tv-accent-hover transition-colors"
              >
                检查更新
              </button>
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

function PlaylistSettingsList() {
  const playlists = useStore((s) => s.playlists)
  const removePlaylist = useStore((s) => s.removePlaylist)
  const setActivePlaylistId = useStore((s) => s.setActivePlaylistId)
  const activePlaylistId = useStore((s) => s.activePlaylistId)
  const setNavTab = useStore((s) => s.setNavTab)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  if (playlists.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 border-2 border-dashed border-tv-border rounded-tv-md text-tv-sm text-tv-text-secondary">
        暂无播放列表
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
              {pl.channelCount} 频道 · {pl.source === 'file' ? '本地文件' : '在线地址'}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={() => { setActivePlaylistId(pl.id); setNavTab('channels') }}
              className={`px-3 py-1 rounded-tv-sm text-tv-xs font-medium transition-colors ${
                activePlaylistId === pl.id
                  ? 'bg-tv-accent/20 text-tv-accent'
                  : 'bg-tv-bg-surface text-tv-text-secondary hover:text-tv-text-primary'
              }`}
            >
              {activePlaylistId === pl.id ? '查看中' : '查看'}
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
              {confirmDelete === pl.id ? '确认删除' : '删除'}
            </button>
            {confirmDelete === pl.id && (
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1 rounded-tv-sm text-tv-xs bg-tv-bg-surface text-tv-text-secondary hover:text-tv-text-primary transition-colors"
              >
                取消
              </button>
            )}
          </div>
        </div>
      ))}
      <button
        onClick={() => { setActivePlaylistId(null); setNavTab('channels') }}
        className="w-full py-2 text-tv-xs text-tv-accent hover:text-tv-accent-hover transition-colors text-center"
      >
        显示全部频道
      </button>
    </div>
  )
}

function EpgSourceSettings() {
  const epgSources = useStore((s) => s.epgSources)
  const importEpgFromUrl = useStore((s) => s.importEpgFromUrl)
  const removeEpgSource = useStore((s) => s.removeEpgSource)
  const [url, setUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleImport = async () => {
    const trimmed = url.trim()
    if (!trimmed) return
    setImporting(true)
    setMsg(null)
    const result = await importEpgFromUrl(trimmed)
    setImporting(false)
    if (result.success) {
      setMsg({ ok: true, text: `导入成功: ${result.count} 条节目数据` })
      setUrl('')
    } else {
      setMsg({ ok: false, text: result.error || '导入失败' })
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
          placeholder="输入 EPG (XMLTV) 链接..."
          disabled={importing}
          className="flex-1 px-3 py-2 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary placeholder-tv-text-secondary"
        />
        <button
          onClick={handleImport}
          disabled={importing}
          className="px-4 py-2 bg-tv-accent text-white text-tv-sm rounded-tv-md hover:bg-tv-accent-hover transition-colors disabled:opacity-50"
        >
          {importing ? '导入中...' : '导入'}
        </button>
      </div>
      {msg && (
        <p className={`text-tv-xs ${msg.ok ? 'text-green-500' : 'text-red-400'}`}>{msg.text}</p>
      )}

      {epgSources.length === 0 ? (
        <div className="flex items-center justify-center h-24 border-2 border-dashed border-tv-border rounded-tv-md text-tv-sm text-tv-text-secondary">
          暂无 EPG 数据源
        </div>
      ) : (
        <div className="space-y-2">
          {epgSources.map((es) => (
            <div key={es.url} className="flex items-center justify-between px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md">
              <div className="flex-1 min-w-0">
                <div className="text-tv-sm text-tv-text-primary truncate">{es.url}</div>
                <div className="text-tv-xs text-tv-text-secondary">
                  {es.programCount} 条节目数据 · {es.tvgIds.length} 个频道
                </div>
              </div>
              <button
                onClick={() => removeEpgSource(es.url)}
                className="ml-4 px-3 py-1 rounded-tv-sm text-tv-xs bg-tv-bg-surface text-tv-text-secondary hover:text-red-400 transition-colors"
              >
                删除
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
