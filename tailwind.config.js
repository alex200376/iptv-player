/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{ts,tsx}', './src/renderer/index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--tv-font-body)', 'Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
        display: ['var(--tv-font-display)', 'Rajdhani', 'Barlow Condensed', 'Noto Sans SC', 'sans-serif'],
        body: ['var(--tv-font-body)', 'Inter', 'Noto Sans SC', 'sans-serif'],
        mono: ['var(--tv-font-mono)', 'JetBrains Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        'tv-xs': ['var(--tv-font-xs)', { lineHeight: '1.5' }],
        'tv-sm': ['var(--tv-font-sm)', { lineHeight: '1.5' }],
        'tv-base': ['var(--tv-font-base)', { lineHeight: '1.5' }],
        'tv-lg': ['var(--tv-font-lg)', { lineHeight: '1.5' }],
        'tv-xl': ['var(--tv-font-xl)', { lineHeight: '1.5' }],
      },
      borderRadius: {
        'tv-sm': 'var(--tv-radius-sm, 2px)',
        'tv-md': 'var(--tv-radius-md, 4px)',
        'tv-none': 'var(--tv-radius-none, 0px)',
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        border: 'hsl(var(--border))',
        tv: {
          bg: 'var(--tv-bg)',
          'bg-secondary': 'var(--tv-bg-secondary)',
          'bg-surface': 'var(--tv-bg-surface)',
          'bg-elevated': 'var(--tv-bg-elevated)',
          'bg-inset': 'var(--tv-bg-inset)',
          'text-primary': 'var(--tv-text-primary)',
          'text-secondary': 'var(--tv-text-secondary)',
          'text-tertiary': 'var(--tv-text-tertiary)',
          accent: 'var(--tv-accent)',
          'accent-hover': 'var(--tv-accent-hover)',
          'accent-dim': 'var(--tv-accent-dim)',
          'accent-glow': 'var(--tv-accent-glow)',
          border: 'var(--tv-border)',
          divider: 'var(--tv-divider)',
          'focus-ring': 'var(--tv-focus-ring)',
          live: 'var(--tv-live)',
          rec: 'var(--tv-rec)',
          offline: 'var(--tv-offline)',
        },
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
