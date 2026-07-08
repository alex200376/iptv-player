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
      '--tv-bg': '#14161a',
      '--tv-bg-secondary': '#1c1f24',
      '--tv-bg-surface': '#1c1f24',
      '--tv-text-primary': '#eef0f2',
      '--tv-text-secondary': '#8a8f98',
      '--tv-accent': '#ff8a3d',
      '--tv-accent-hover': '#e67a2e',
      '--tv-border': '#2a2d33',
      '--tv-focus-ring': '#ff8a3d',
    },
  },
  {
    id: 'midnight',
    label: '午夜暗蓝',
    variables: {
      '--tv-bg': '#10141c',
      '--tv-bg-secondary': '#171c26',
      '--tv-bg-surface': '#1e2430',
      '--tv-text-primary': '#e8ecf0',
      '--tv-text-secondary': '#8a929e',
      '--tv-accent': '#ff8a3d',
      '--tv-accent-hover': '#e67a2e',
      '--tv-border': '#262d38',
      '--tv-focus-ring': '#ff8a3d',
    },
  },
  {
    id: 'light',
    label: '明亮',
    variables: {
      '--tv-bg': '#f2f4f6',
      '--tv-bg-secondary': '#ffffff',
      '--tv-bg-surface': '#e8eaed',
      '--tv-text-primary': '#1a1c20',
      '--tv-text-secondary': '#6c7278',
      '--tv-accent': '#ff7a2e',
      '--tv-accent-hover': '#e66a1e',
      '--tv-border': '#d0d4d8',
      '--tv-focus-ring': '#ff7a2e',
    },
  },
  {
    id: 'oled',
    label: 'OLED 纯黑',
    variables: {
      '--tv-bg': '#000000',
      '--tv-bg-secondary': '#0a0a0a',
      '--tv-bg-surface': '#121212',
      '--tv-text-primary': '#eef0f2',
      '--tv-text-secondary': '#6a6e74',
      '--tv-accent': '#ff8a3d',
      '--tv-accent-hover': '#e67a2e',
      '--tv-border': '#1a1c1e',
      '--tv-focus-ring': '#ff8a3d',
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
