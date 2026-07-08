/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/src/**/*.{ts,tsx}', './src/renderer/index.html'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'tv-xs': ['var(--tv-font-xs)', { lineHeight: '1.5' }],
        'tv-sm': ['var(--tv-font-sm)', { lineHeight: '1.5' }],
        'tv-base': ['var(--tv-font-base)', { lineHeight: '1.5' }],
        'tv-lg': ['var(--tv-font-lg)', { lineHeight: '1.5' }],
        'tv-xl': ['var(--tv-font-xl)', { lineHeight: '1.5' }],
      },
      colors: {
        tv: {
          bg: 'var(--tv-bg)',
          'bg-secondary': 'var(--tv-bg-secondary)',
          'bg-surface': 'var(--tv-bg-surface)',
          'text-primary': 'var(--tv-text-primary)',
          'text-secondary': 'var(--tv-text-secondary)',
          accent: 'var(--tv-accent)',
          'accent-hover': 'var(--tv-accent-hover)',
          border: 'var(--tv-border)',
          'focus-ring': 'var(--tv-focus-ring)',
        },
      },
    },
  },
  plugins: [],
}
