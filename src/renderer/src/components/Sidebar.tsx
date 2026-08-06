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
      <div className="px-3 py-2">
        <div className="sidebar-search-wrap">
          <Search className="sidebar-search-icon" />
          <input
            ref={inputRef}
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            placeholder={t('sidebar.search')}
            className="sidebar-search-input"
          />
          {localSearch ? (
            <button
              onClick={() => { setLocalSearch(''); setSearchQuery(''); setCategoryFilter(null) }}
              className="sidebar-search-clear"
            >
              <X className="w-3 h-3" />
            </button>
          ) : (
            <kbd className="sidebar-search-kbd">Ctrl F</kbd>
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
          className="sidebar-pills"
        >
          <button
            onClick={() => setCategoryFilter(null)}
            className={`sidebar-pill ${!categoryFilter ? 'sidebar-pill-active' : ''}`}
          >
             {t('sidebar.all')}
          </button>
          {allCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`sidebar-pill ${categoryFilter === cat ? 'sidebar-pill-active' : ''}`}
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
