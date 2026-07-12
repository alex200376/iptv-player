import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ChannelList from './ChannelList'
import FavoriteList from './FavoriteList'
import HistoryList from './HistoryList'
import PlaylistList from './PlaylistList'
import { useStore } from '../stores/useStore'
import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getGroupDisplayName } from '../utils/groupLabels'

export default function Sidebar() {
  const { t } = useTranslation()
  const [localSearch, setLocalSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const navTab = useStore((s) => s.navTab)
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

  return (
    <aside className="w-full h-full bg-card flex flex-col border-r border-border">
      <div className="px-2 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            placeholder={t('sidebar.search')}
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
             {t('sidebar.all')}
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`text-sm px-3 py-1 rounded-full whitespace-nowrap transition-colors shrink-0 ${
                categoryFilter === cat ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {getGroupDisplayName(cat, t)}
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
    </aside>
  )
}
