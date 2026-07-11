import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function UpdateBadge({ onShowDialog }: { onShowDialog: () => void }) {
  const { t } = useTranslation()
  const [available, setAvailable] = useState<{ version: string } | null>(null)

  // BUG FIX: both listeners had no removeListener. TopBar (and therefore
  // UpdateBadge) is always mounted, so with StrictMode double-mount these
  // accumulated once per dev session reload.
  useEffect(() => {
    const offAvailable = window.electronAPI.onUpdateAvailable((info) => {
      setAvailable(info)
    })
    const offDownloaded = window.electronAPI.onUpdateDownloaded(() => {
      setAvailable(null)
    })
    return () => {
      offAvailable?.()
      offDownloaded?.()
    }
  }, [])

  if (!available) return null

  return (
    <button
      onClick={onShowDialog}
      className="relative flex items-center gap-1.5 px-2.5 py-1 rounded-tv-sm bg-tv-accent/15 text-tv-accent text-tv-xs hover:bg-tv-accent/25 transition-colors"
      title={t('updateBadge.newVersion', { version: available.version })}
    >
      <span className="w-1.5 h-1.5 rounded-tv-sm bg-tv-accent animate-pulse-dot" />
      v{available.version}
    </button>
  )
}
