import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ChannelList from './ChannelList'
import ImportDialog from './ImportDialog'
import FavoriteList from './FavoriteList'
import HistoryList from './HistoryList'
import PlaylistList from './PlaylistList'
import { useStore } from '../stores/useStore'
import { Search, X } from 'lucide-react'

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
  const [localSearch, setLocalSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const navTab = useStore((s) => s.navTab)
  const setNavTab = useStore((s) => s.setNavTab)
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const groups = useStore((s) => s.groups)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const pillsRef = useRef<HTMLDivElement>(null)
  const dragState = useRef<{ isDragging: boolean; startX: number; scrollLeft: number; moved: boolean } | null>(null)

  const handlePillMouseDown = useCallback((e: React.MouseEvent) => {
    const el = pillsRef.current
    if (!el) return
    dragState.current = { isDragging: true, startX: e.pageX - el.offsetLeft, scrollLeft: el.scrollLeft, moved: false }
  }, [])

  const handlePillMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragState.current) return
    e.preventDefault()
    const el = pillsRef.current
    if (!el) return
    const x = e.pageX - el.offsetLeft
    const walk = (x - dragState.current.startX) * 2
    if (Math.abs(walk) > 5) dragState.current.moved = true
    el.scrollLeft = dragState.current.scrollLeft - walk
  }, [])

  const handlePillMouseUp = useCallback(() => {
    dragState.current = null
  }, [])

  const handlePillMouseLeave = useCallback(() => {
    dragState.current = null
  }, [])

  const allCategories = useMemo(() => {
    const nameCounts = new Map<string, number>()
    for (const g of groups) {
      if (g.name) {
        nameCounts.set(g.name, (nameCounts.get(g.name) || 0) + g.channels.length)
      }
    }
    return Array.from(nameCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([name]) => name)
  }, [groups])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearchQuery(val), 250)
  }, [setSearchQuery])

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  if (collapsed) {
    return (
      <>
        <aside className="w-full h-full bg-card flex flex-col items-center py-2 gap-1 border-r border-border">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setNavTab(item.id as 'channels' | 'playlists' | 'favorites' | 'history')}
              className={`p-2 rounded-lg transition-colors ${
                navTab === item.id ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title={item.label}
            >
              <NavIcon icon={item.icon} />
            </button>
          ))}
          <div className="flex-1" />
          <button
            onClick={() => setDialogOpen(true)}
            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
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
      <aside className="w-full h-full bg-card flex flex-col border-r border-border">
        <div className="px-2 py-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={localSearch}
              onChange={handleSearchChange}
              placeholder="搜索频道..."
              className="w-full pl-8 pr-7 py-1.5 bg-background border border-border rounded-md text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary"
            />
            {localSearch && (
              <button
                onClick={() => { setLocalSearch(''); setSearchQuery(''); setCategoryFilter(null) }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {allCategories.length > 0 && (
          <div
            ref={pillsRef}
            onMouseDown={handlePillMouseDown}
            onMouseMove={handlePillMouseMove}
            onMouseUp={handlePillMouseUp}
            onMouseLeave={handlePillMouseLeave}
            className="px-2 pb-2 overflow-x-auto flex-nowrap flex gap-2 scrollbar-none cursor-grab active:cursor-grabbing select-none"
          >
            <button
              onClick={() => setCategoryFilter(null)}
              className={`text-sm px-3 py-1 rounded-full whitespace-nowrap transition-colors shrink-0 ${
                !categoryFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              全部
            </button>
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`text-sm px-3 py-1 rounded-full whitespace-nowrap transition-colors shrink-0 ${
                  categoryFilter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {navTab === 'channels' && <ChannelList categoryFilter={categoryFilter} />}
          {navTab === 'playlists' && <PlaylistList />}
          {navTab === 'favorites' && <FavoriteList />}
          {navTab === 'history' && <HistoryList />}
        </div>

        <div className="px-2 py-1.5 border-t border-border">
          <button
            onClick={() => setDialogOpen(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M8 2v4h4M8 6l4-4M4 8h7M4 11h7" />
            </svg>
            <span>导入 M3U</span>
          </button>
        </div>
      </aside>
      <ImportDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
