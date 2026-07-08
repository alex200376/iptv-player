import { useState, useEffect } from 'react'

export default function UpdateBadge({ onShowDialog }: { onShowDialog: () => void }) {
  const [available, setAvailable] = useState<{ version: string } | null>(null)

  useEffect(() => {
    window.electronAPI.onUpdateAvailable((info) => {
      setAvailable(info)
    })
    window.electronAPI.onUpdateDownloaded(() => {
      setAvailable(null)
    })
  }, [])

  if (!available) return null

  return (
    <button
      onClick={onShowDialog}
      className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-tv-accent/15 text-tv-accent text-tv-xs hover:bg-tv-accent/25 transition-colors"
      title={`新版本 v${available.version} 可用`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-tv-accent animate-pulse" />
      v{available.version}
    </button>
  )
}
