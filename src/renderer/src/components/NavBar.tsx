import * as Tooltip from '@radix-ui/react-tooltip'
import { Film, List, Heart, Clock, Play, Download, Settings } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '../stores/useStore'
import { useTranslation } from 'react-i18next'
import ImportDialog from './ImportDialog'
import OpenStreamDialog from './OpenStreamDialog'

export default function NavBar({
  onOpenSettings,
}: {
  onOpenSettings: () => void
}) {
  const { t } = useTranslation()
  const navTab = useStore((s) => s.navTab)
  const setNavTab = useStore((s) => s.setNavTab)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [streamDialogOpen, setStreamDialogOpen] = useState(false)

  const navItems = [
    { id: 'channels', label: t('nav.channels'), icon: List },
    { id: 'playlists', label: t('nav.playlists'), icon: Film },
    { id: 'favorites', label: t('nav.favorites'), icon: Heart },
    { id: 'history', label: t('nav.history'), icon: Clock },
    { id: 'streams', label: t('sidebar.openStream'), icon: Play },
    { id: 'import', label: t('sidebar.importM3UShort'), icon: Download },
  ]

  return (
    <Tooltip.Provider delayDuration={300}>
      <nav className="w-14 flex flex-col items-center py-3 gap-1 bg-card border-r border-border flex-shrink-0 z-30">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = navTab === item.id
          return (
            <Tooltip.Root key={item.id}>
              <Tooltip.Trigger asChild>
                <button
                  onClick={() => {
                    if (item.id === 'streams') {
                      window.electronAPI.hidePlayerWindow()
                      setStreamDialogOpen(true)
                    } else if (item.id === 'import') {
                      setDialogOpen(true)
                    } else {
                      setNavTab(item.id as 'channels' | 'playlists' | 'favorites' | 'history')
                    }
                  }}
                  className={`p-2.5 rounded-lg transition-colors ${
                    active
                      ? 'text-primary bg-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              </Tooltip.Trigger>
              <Tooltip.Portal>
                <Tooltip.Content
                  side="right"
                  sideOffset={8}
                  className="bg-card text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border shadow-md"
                >
                  {item.label}
                  <Tooltip.Arrow className="fill-card" />
                </Tooltip.Content>
              </Tooltip.Portal>
            </Tooltip.Root>
          )
        })}
        <div className="flex-1" />
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <button
              onClick={onOpenSettings}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="right"
              sideOffset={8}
              className="bg-card text-foreground text-xs px-2.5 py-1.5 rounded-md border border-border shadow-md"
            >
              {t('nav.settings')}
              <Tooltip.Arrow className="fill-card" />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </nav>
      <ImportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      {streamDialogOpen && <OpenStreamDialog onClose={() => { setStreamDialogOpen(false); window.electronAPI.showPlayerWindow() }} />}
    </Tooltip.Provider>
  )
}
