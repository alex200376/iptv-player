const BUILTIN_GROUPS: Record<string, string> = {
  '未分组': 'channel.ungrouped',
  '直接播放': 'channel.directStream',
  'Ungrouped': 'channel.ungrouped',
  'Direct Stream': 'channel.directStream',
}

export function getGroupDisplayName(name: string, t: (key: string) => string): string {
  const key = BUILTIN_GROUPS[name]
  return key ? t(key) : name
}
