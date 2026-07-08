import { useState } from 'react'
import ChannelList from './ChannelList'
import ImportDialog from './ImportDialog'
import FavoriteList from './FavoriteList'
import HistoryList from './HistoryList'
import PlaylistList from './PlaylistList'
import { useStore } from '../stores/useStore'

const navItems = [
  { id: 'channels', label: '频道', icon: 'tv' },
  { id: 'playlists', label: '播放列表', icon: 'list' },
  { id: 'favorites', label: '收藏', icon: 'star' },
  { id: 'history', label: '历史', icon: 'clock' },
]

function NavIcon({ icon }: { icon: string }) {
  const paths: Record<string, string> = {
    tv: 'M2 4h20v14H2zM8 21h8M12 17v4',

    list: 'M2 4h20M2 10h20M2 16h20',
    star: 'M7.5 1.5l2 4.5h4.5l-3.5 3 1.5 4.5-3.5-2.5-3.5 2.5 1.5-4.5-3.5-3h4.5z',
    clock: 'M7.5 1.5v6l4 2M7.5 1.5A6 6 0 1013.5 7.5 6 6 0 007.5 1.5z',
  }
  return (
    <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[icon] || paths.tv} />
    </svg>
  )
}

export default function Sidebar({ collapsed }: { collapsed?: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const navTab = useStore((s) => s.navTab)
  const setNavTab = useStore((s) => s.setNavTab)

  if (collapsed) {
    return (
      <>
        <aside className="w-full h-full bg-tv-bg-secondary flex flex-col items-center py-2 gap-1 border-r border-tv-border">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setNavTab(item.id as 'channels' | 'playlists' | 'favorites' | 'history')}
              className={`p-2 rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring ${
                navTab === item.id ? 'text-tv-accent bg-tv-accent/10' : 'text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-bg-surface'
              }`}
              title={item.label}
            >
              <NavIcon icon={item.icon} />
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setDialogOpen(true)}
            className="p-2 rounded-md text-tv-text-secondary hover:text-tv-accent hover:bg-tv-accent/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
            title="导入 M3U (Ctrl+I)"
          >
            <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2v4h4M8 6l4-4M4 8h7M4 11h7" />
            </svg>
          </button>
        </aside>
        <ImportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      </>
    )
  }

  return (
    <>
      <aside className="w-full h-full bg-tv-bg-secondary flex flex-col border-r border-tv-border">
        <nav className="flex flex-col py-1 gap-0.5 px-1.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setNavTab(item.id as 'channels' | 'playlists' | 'favorites' | 'history')}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-tv-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring ${
                navTab === item.id ? 'text-tv-accent bg-tv-accent/10 font-medium' : 'text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-bg-surface'
              }`}
            >
              <NavIcon icon={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-2 py-1.5 border-t border-tv-border mt-1">
          <button
            onClick={() => setDialogOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-tv-sm text-tv-text-secondary hover:text-tv-accent hover:bg-tv-accent/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
          >
            <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2v4h4M8 6l4-4M4 8h7M4 11h7" />
            </svg>
            <span>导入 M3U</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {navTab === 'channels' && <ChannelList />}
          {navTab === 'playlists' && <PlaylistList />}
          {navTab === 'favorites' && <FavoriteList />}
          {navTab === 'history' && <HistoryList />}
        </div>
      </aside>
      <ImportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
