import { readSettings } from './settingsStore'

const translations: Record<string, Record<string, string>> = {
  'zh-CN': {
    'group.ungrouped': '未分组',
    'group.directPlay': '直接播放',
    'epg.unknownTitle': '未知节目',
    'channel.unknown': '未知频道',
    'error.missingVlc': '缺少 VLC',
    'error.missingVlcDesc': '未找到 VLC Media Player，请先安装 VLC 3.0 或更高版本',
    'pip.playPause': '播放/暂停',
    'pip.mute': '静音',
    'pip.close': '关闭画中画',
    'window.settingsTitle': '设置 - IPTV Player',
    'update.downloading': '正在背景下载更新...',
    'update.error': '更新錯誤: {{message}}',
    'epg.emptyUrl': 'URL 不能为空',
  },
  'en-US': {
    'group.ungrouped': 'Ungrouped',
    'group.directPlay': 'Direct Play',
    'epg.unknownTitle': 'Unknown Program',
    'channel.unknown': 'Unknown Channel',
    'error.missingVlc': 'Missing VLC',
    'error.missingVlcDesc': 'VLC Media Player not found. Please install VLC 3.0 or later.',
    'pip.playPause': 'Play/Pause',
    'pip.mute': 'Mute',
    'pip.close': 'Close Picture-in-Picture',
    'window.settingsTitle': 'Settings - IPTV Player',
    'update.downloading': 'Downloading update in background...',
    'update.error': 'Update error: {{message}}',
    'epg.emptyUrl': 'URL cannot be empty',
  },
}

export function t(key: string): string {
  const lang = readSettings().language
  return translations[lang]?.[key] || translations['zh-CN']?.[key] || key
}
