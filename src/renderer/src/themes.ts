export type ThemeId = 'dark' | 'midnight' | 'light' | 'oled' | 'forest' | 'ocean' | 'sunset' | 'coffee' | 'dracula' | 'nord' | 'custom'

export interface Theme {
  id: ThemeId
  label: string
  labelKey: string
  variables: Record<string, string>
}

export type ThemeVariables = Record<string, string>

export const CUSTOM_THEME_ID = 'custom'

export const themes: Theme[] = [
  {
    id: 'dark',
    label: '深邃暗色',
    labelKey: 'theme.dark',
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
      '--background': '220 12% 9%',
      '--foreground': '210 17% 94%',
      '--card': '220 12% 13%',
      '--primary': '24 100% 62%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '220 8% 18%',
      '--muted-foreground': '220 6% 52%',
      '--border': '220 6% 22%',
    },
  },
  {
    id: 'midnight',
    label: '午夜暗蓝',
    labelKey: 'theme.midnight',
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
      '--background': '218 27% 9%',
      '--foreground': '210 25% 92%',
      '--card': '218 23% 15%',
      '--primary': '24 100% 62%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '218 16% 18%',
      '--muted-foreground': '218 10% 52%',
      '--border': '218 12% 22%',
    },
  },
  {
    id: 'light',
    label: '明亮',
    labelKey: 'theme.light',
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
      '--background': '210 17% 96%',
      '--foreground': '220 12% 11%',
      '--card': '0 0% 100%',
      '--primary': '22 100% 59%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '210 10% 86%',
      '--muted-foreground': '218 6% 44%',
      '--border': '210 10% 82%',
    },
  },
  {
    id: 'oled',
    label: 'OLED 纯黑',
    labelKey: 'theme.oled',
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
      '--background': '0 0% 0%',
      '--foreground': '0 0% 93%',
      '--card': '0 0% 4%',
      '--primary': '24 100% 62%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '0 0% 7%',
      '--muted-foreground': '0 0% 40%',
      '--border': '0 0% 11%',
    },
  },
  {
    id: 'forest',
    label: '森林绿',
    labelKey: 'theme.forest',
    variables: {
      '--tv-bg': '#121812',
      '--tv-bg-secondary': '#1a221a',
      '--tv-bg-surface': '#1e2a1e',
      '--tv-text-primary': '#e6ede6',
      '--tv-text-secondary': '#8a9a8a',
      '--tv-accent': '#4ade80',
      '--tv-accent-hover': '#22c55e',
      '--tv-border': '#2a3a2a',
      '--tv-focus-ring': '#4ade80',
      '--background': '120 14% 8%',
      '--foreground': '120 20% 91%',
      '--card': '120 15% 13%',
      '--primary': '140 71% 55%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '120 10% 18%',
      '--muted-foreground': '120 8% 50%',
      '--border': '120 12% 24%',
    },
  },
  {
    id: 'ocean',
    label: '海洋蓝',
    labelKey: 'theme.ocean',
    variables: {
      '--tv-bg': '#0e1419',
      '--tv-bg-secondary': '#141e26',
      '--tv-bg-surface': '#1a2833',
      '--tv-text-primary': '#dce8f0',
      '--tv-text-secondary': '#7a929e',
      '--tv-accent': '#38bdf8',
      '--tv-accent-hover': '#0ea5e9',
      '--tv-border': '#243642',
      '--tv-focus-ring': '#38bdf8',
      '--background': '200 22% 8%',
      '--foreground': '200 35% 90%',
      '--card': '200 22% 14%',
      '--primary': '198 93% 60%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '200 15% 19%',
      '--muted-foreground': '200 10% 50%',
      '--border': '200 18% 26%',
    },
  },
  {
    id: 'sunset',
    label: '日落暖橙',
    labelKey: 'theme.sunset',
    variables: {
      '--tv-bg': '#1a1414',
      '--tv-bg-secondary': '#241c1a',
      '--tv-bg-surface': '#2e2420',
      '--tv-text-primary': '#f0e6e0',
      '--tv-text-secondary': '#a09088',
      '--tv-accent': '#fb923c',
      '--tv-accent-hover': '#f97316',
      '--tv-border': '#3a3028',
      '--tv-focus-ring': '#fb923c',
      '--background': '10 15% 9%',
      '--foreground': '20 30% 91%',
      '--card': '15 13% 15%',
      '--primary': '24 96% 61%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '15 12% 20%',
      '--muted-foreground': '15 8% 52%',
      '--border': '24 12% 26%',
    },
  },
  {
    id: 'coffee',
    label: '咖啡棕',
    labelKey: 'theme.coffee',
    variables: {
      '--tv-bg': '#171312',
      '--tv-bg-secondary': '#221d1a',
      '--tv-bg-surface': '#2d2622',
      '--tv-text-primary': '#ede5dd',
      '--tv-text-secondary': '#948a82',
      '--tv-accent': '#d4a574',
      '--tv-accent-hover': '#c49464',
      '--tv-border': '#352e28',
      '--tv-focus-ring': '#d4a574',
      '--background': '15 12% 8%',
      '--foreground': '30 25% 89%',
      '--card': '15 14% 13%',
      '--primary': '30 52% 64%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '15 10% 19%',
      '--muted-foreground': '30 8% 50%',
      '--border': '25 12% 23%',
    },
  },
  {
    id: 'dracula',
    label: '德古拉紫',
    labelKey: 'theme.dracula',
    variables: {
      '--tv-bg': '#1e1e2e',
      '--tv-bg-secondary': '#282840',
      '--tv-bg-surface': '#302850',
      '--tv-text-primary': '#e8e0f0',
      '--tv-text-secondary': '#9888b0',
      '--tv-accent': '#bd93f9',
      '--tv-accent-hover': '#a87ef0',
      '--tv-border': '#3a3a5a',
      '--tv-focus-ring': '#bd93f9',
      '--background': '240 21% 15%',
      '--foreground': '260 33% 91%',
      '--card': '240 18% 20%',
      '--primary': '265 89% 78%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '240 15% 24%',
      '--muted-foreground': '260 12% 56%',
      '--border': '240 20% 30%',
    },
  },
  {
    id: 'nord',
    label: '北极蓝',
    labelKey: 'theme.nord',
    variables: {
      '--tv-bg': '#2e3440',
      '--tv-bg-secondary': '#3b4252',
      '--tv-bg-surface': '#434c5e',
      '--tv-text-primary': '#eceff4',
      '--tv-text-secondary': '#9aa5b8',
      '--tv-accent': '#88c0d0',
      '--tv-accent-hover': '#6fa8c0',
      '--tv-border': '#4c566a',
      '--tv-focus-ring': '#88c0d0',
      '--background': '222 16% 22%',
      '--foreground': '218 20% 94%',
      '--card': '220 16% 26%',
      '--primary': '193 43% 67%',
      '--primary-foreground': '0 0% 100%',
      '--muted': '218 14% 31%',
      '--muted-foreground': '218 14% 60%',
      '--border': '220 14% 36%',
    },
  },
]

// Custom theme entry — appears in the theme picker; its variables act as a
// preview fallback until the user customizes colors.
themes.push({
  id: CUSTOM_THEME_ID,
  label: '自定义',
  labelKey: 'theme.custom',
  variables: { ...themes[0].variables },
})

// ── Custom theme helpers ──────────────────────────────────────────────
// The editor exposes the 6 "core" colors; every other variable is derived
// from them so a custom theme always produces a complete, coherent set.

const CUSTOM_CORE_KEYS = [
  '--tv-bg',
  '--tv-bg-surface',
  '--tv-text-primary',
  '--tv-text-secondary',
  '--tv-accent',
  '--tv-border',
] as const

/** Returns the core colors for a custom theme, falling back to the dark theme. */
export function getCustomCore(custom?: ThemeVariables | null): ThemeVariables {
  const dark = themes.find((t) => t.id === 'dark')!
  const core: ThemeVariables = {}
  for (const key of CUSTOM_CORE_KEYS) {
    core[key] = custom?.[key] || dark.variables[key]
  }
  return core
}

/** Expands the 6 core colors into the full CSS-variable set used by the app. */
export function buildCustomThemeVariables(core: ThemeVariables): ThemeVariables {
  const bg = core['--tv-bg'] || '#14161a'
  const surface = core['--tv-bg-surface'] || '#1c1f24'
  const text = core['--tv-text-primary'] || '#eef0f2'
  const textSecondary = core['--tv-text-secondary'] || '#8a8f98'
  const accent = core['--tv-accent'] || '#ff8a3d'
  const border = core['--tv-border'] || '#2a2d33'

  return {
    '--tv-bg': bg,
    '--tv-bg-secondary': mixHex(bg, surface, 0.55),
    '--tv-bg-surface': surface,
    '--tv-text-primary': text,
    '--tv-text-secondary': textSecondary,
    '--tv-accent': accent,
    '--tv-accent-hover': shadeHex(accent, -12),
    '--tv-border': border,
    '--tv-focus-ring': accent,
    '--background': hexToHsl(bg),
    '--foreground': hexToHsl(text),
    '--card': hexToHsl(surface),
    '--primary': hexToHsl(accent),
    '--primary-foreground': '0 0% 100%',
    '--muted': hexToHsl(mixHex(bg, surface, 0.6)),
    '--muted-foreground': hexToHsl(textSecondary),
    '--border': hexToHsl(border),
  }
}

// ── Color math (hex → hex / hsl) ─────────────────────────────────────
function parseHex(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6) return { r: 0, g: 0, b: 0 }
  const n = parseInt(h, 16)
  if (Number.isNaN(n)) return { r: 0, g: 0, b: 0 }
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.round(Math.min(255, Math.max(0, v)))
  const ch = (v: number) => clamp(v).toString(16).padStart(2, '0')
  return `#${ch(r)}${ch(g)}${ch(b)}`
}

function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a)
  const cb = parseHex(b)
  return toHex(
    ca.r + (cb.r - ca.r) * t,
    ca.g + (cb.g - ca.g) * t,
    ca.b + (cb.b - ca.b) * t,
  )
}

function shadeHex(hex: string, percent: number): string {
  const c = parseHex(hex)
  const f = 1 + percent / 100
  return toHex(c.r * f, c.g * f, c.b * f)
}

function hexToHsl(hex: string): string {
  const { r, g, b } = parseHex(hex)
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return `0 0% ${Math.round(l * 100)}%`
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h = 0
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  h *= 60
  return `${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function applyTheme(themeId: ThemeId, custom?: ThemeVariables | null) {
  const root = document.documentElement
  if (themeId === CUSTOM_THEME_ID) {
    const vars = buildCustomThemeVariables(getCustomCore(custom))
    Object.entries(vars).forEach(([key, value]) => {
      root.style.setProperty(key, value)
    })
    root.setAttribute('data-theme', CUSTOM_THEME_ID)
    return
  }
  const theme = themes.find((t) => t.id === themeId)
  if (!theme) return
  Object.entries(theme.variables).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.setAttribute('data-theme', themeId)
}
