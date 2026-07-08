import { useRef, useEffect, useState, useCallback } from 'react'
import { useStore } from '../stores/useStore'
import OpenStreamDialog from './OpenStreamDialog'
import UpdateBadge from './UpdateBadge'

export default function TopBar({
  sidebarOpen,
  onToggleSidebar,
  onOpenSettings,
  onOpenEpg,
  onOpenUpdate,
}: {
  sidebarOpen: boolean
  onToggleSidebar: () => void
  onOpenSettings: () => void
  onOpenEpg: () => void
  onOpenUpdate: () => void
}) {
  const [streamDialogOpen, setStreamDialogOpen] = useState(false)
  const [localSearch, setLocalSearch] = useState('')
  const setSearchQuery = useStore((s) => s.setSearchQuery)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearchQuery(val), 250)
  }, [setSearchQuery])

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
    <header className="h-11 flex items-center justify-between px-3 bg-tv-bg-secondary border-b border-tv-border flex-shrink-0 z-30 select-none">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-bg-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
          title={sidebarOpen ? '折叠侧栏 (Ctrl+B)' : '展开侧栏 (Ctrl+B)'}
        >
          <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none">
            <path d="M2 4h11M2 7.5h11M2 11h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <h1 className="text-tv-sm font-semibold text-tv-text-primary select-none">IPTV Player</h1>
      </div>

      <div className="flex items-center gap-3 flex-1 max-w-[min(400px,35vw)] mx-2 sm:mx-4">
        <div className="relative w-full">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tv-text-secondary pointer-events-none" viewBox="0 0 15 15" fill="none">
            <circle cx="6.5" cy="6.5" r="4" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9.5 9.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={localSearch}
            onChange={handleSearchChange}
            placeholder="搜索频道 (Ctrl+F)..."
            className="w-full pl-8 pr-3 py-1.5 bg-tv-bg border border-tv-border rounded-md text-tv-sm text-tv-text-primary placeholder-tv-text-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
          />
          {localSearch && (
            <button
              onClick={() => { setLocalSearch(''); setSearchQuery('') }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-tv-text-secondary hover:text-tv-text-primary"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill="none">
                <path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={async () => {
            await window.electronAPI.hidePlayerWindow()
            setStreamDialogOpen(true)
          }}
          className="p-1.5 rounded-md text-tv-text-secondary hover:text-tv-accent hover:bg-tv-accent/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
          title="打开网络流"
        >
          <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="7.5" cy="7.5" r="5.5" /><path d="M5.5 7.5l4-2.5v5z" />
          </svg>
        </button>
        <button
          onClick={onOpenEpg}
          className="p-1.5 rounded-md text-tv-text-secondary hover:text-tv-accent hover:bg-tv-accent/10 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
          title="节目指南"
        >
          <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M2 2h11v11H2zM2 6h11M6 2v11" />
          </svg>
        </button>
        <UpdateBadge onShowDialog={onOpenUpdate} />
        <button
          onClick={onOpenSettings}
          className="p-1.5 rounded-md text-tv-text-secondary hover:text-tv-text-primary hover:bg-tv-bg-surface transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
          title="设置 (Ctrl+,)"
        >
          <svg className="w-4 h-4" viewBox="0 0 15 15" fill="none">
            <path d="M7.5 1.5v1.5M7.5 12v1.5M1.5 7.5H3M12 7.5h1.5M3.3 3.3l1.06 1.06M10.64 10.64l1.06 1.06M3.3 11.7l1.06-1.06M10.64 4.36l1.06-1.06" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="7.5" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
      {streamDialogOpen && <OpenStreamDialog onClose={() => { setStreamDialogOpen(false); window.electronAPI.showPlayerWindow() }} />}
    </header>
  )
}
