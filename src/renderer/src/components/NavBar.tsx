import { Film, List, Heart, Clock, Play, Download, Settings } from 'lucide-react'
import { useStore } from '../stores/useStore'
import { useTranslation } from 'react-i18next'

export default function NavBar({
  onOpenSettings,
  onImport,
  onOpenStream,
}: {
  onOpenSettings: () => void
  onImport: () => void
  onOpenStream: () => void
}) {
  const { t } = useTranslation()
  const navTab = useStore((s) => s.navTab)
  const setNavTab = useStore((s) => s.setNavTab)

  const navItems = [
    { id: 'channels', label: t('nav.channels'), icon: List },
    { id: 'playlists', label: t('nav.playlists'), icon: Film },
    { id: 'favorites', label: t('nav.favorites'), icon: Heart },
    { id: 'history', label: t('nav.history'), icon: Clock },
    { id: 'streams', label: t('sidebar.openStream'), icon: Play },
    { id: 'import', label: t('sidebar.importM3UShort'), icon: Download },
  ]

  return (
    <nav className="w-16 flex flex-col items-center py-2 gap-0.5 bg-card border-r border-border flex-shrink-0 z-30">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = navTab === item.id
        return (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'streams') {
                window.electronAPI.hidePlayerWindow()
                onOpenStream()
              } else if (item.id === 'import') {
                onImport()
              } else {
                setNavTab(item.id as 'channels' | 'playlists' | 'favorites' | 'history')
              }
            }}
            className={`flex flex-col items-center gap-0.5 w-full py-1.5 rounded-lg transition-colors ${
              active
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[9px] leading-tight text-center max-w-full px-0.5 truncate">
              {item.label}
            </span>
          </button>
        )
      })}
      <div className="flex-1" />
      <button
        onClick={onOpenSettings}
        className={`flex flex-col items-center gap-0.5 w-full py-1.5 rounded-lg transition-colors ${
          navTab === 'settings'
            ? 'text-primary bg-primary/10'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        <Settings className="w-5 h-5" />
        <span className="text-[9px] leading-tight text-center">{t('nav.settings')}</span>
      </button>
    </nav>
  )
}
