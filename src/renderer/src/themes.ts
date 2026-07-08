export type ThemeId = 'dark' | 'midnight' | 'light' | 'oled'

export interface Theme {
  id: ThemeId
  label: string
  variables: Record<string, string>
}

export const themes: Theme[] = [
  {
    id: 'dark',
    label: '深邃暗色',
    variables: {
      '--tv-bg': '#0f0f1a',
      '--tv-bg-secondary': '#1a1a2e',
      '--tv-bg-surface': '#252542',
      '--tv-text-primary': '#f0f0f0',
      '--tv-text-secondary': '#a0a0b0',
      '--tv-accent': '#3b82f6',
      '--tv-accent-hover': '#2563eb',
      '--tv-border': '#2a2a3e',
      '--tv-focus-ring': '#60a5fa',
    },
  },
  {
    id: 'midnight',
    label: '午夜紫',
    variables: {
      '--tv-bg': '#0a0a14',
      '--tv-bg-secondary': '#12121e',
      '--tv-bg-surface': '#1c1c30',
      '--tv-text-primary': '#e8e0f0',
      '--tv-text-secondary': '#9080a8',
      '--tv-accent': '#8b5cf6',
      '--tv-accent-hover': '#7c3aed',
      '--tv-border': '#1e1e32',
      '--tv-focus-ring': '#a78bfa',
    },
  },
  {
    id: 'light',
    label: '明亮',
    variables: {
      '--tv-bg': '#f8f9fa',
      '--tv-bg-secondary': '#ffffff',
      '--tv-bg-surface': '#e9ecef',
      '--tv-text-primary': '#1a1a2e',
      '--tv-text-secondary': '#6c757d',
      '--tv-accent': '#2563eb',
      '--tv-accent-hover': '#1d4ed8',
      '--tv-border': '#dee2e6',
      '--tv-focus-ring': '#3b82f6',
    },
  },
  {
    id: 'oled',
    label: 'OLED 纯黑',
    variables: {
      '--tv-bg': '#000000',
      '--tv-bg-secondary': '#0a0a0a',
      '--tv-bg-surface': '#141414',
      '--tv-text-primary': '#f0f0f0',
      '--tv-text-secondary': '#707070',
      '--tv-accent': '#22d3ee',
      '--tv-accent-hover': '#06b6d4',
      '--tv-border': '#1a1a1a',
      '--tv-focus-ring': '#22d3ee',
    },
  },
]

export function applyTheme(themeId: ThemeId) {
  const theme = themes.find((t) => t.id === themeId)
  if (!theme) return
  const root = document.documentElement
  Object.entries(theme.variables).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.setAttribute('data-theme', themeId)
}
