import { useMemo, useState } from 'react'
import { useStore } from '../stores/useStore'
import { useTranslation } from 'react-i18next'
import { useLogoUrl } from '../hooks/useLogoUrl'
import { getGroupDisplayName } from '../utils/groupLabels'
import type { Channel } from '../types'

interface EditChannelPageProps {
  channel: Channel
  onClose: () => void
}

export default function EditChannelPage({ channel, onClose }: EditChannelPageProps) {
  const { t } = useTranslation()
  const groups = useStore((s) => s.groups)
  const updateChannel = useStore((s) => s.updateChannel)

  const [name, setName] = useState(channel.name)
  const [group, setGroup] = useState(channel.group || '')
  const [logo, setLogo] = useState(channel.logo || '')
  const [error, setError] = useState('')

  const groupNames = useMemo(
    () => Array.from(new Set(groups.map((g) => g.name))).filter((n) => n.trim()),
    [groups],
  )

  const previewUrl = useLogoUrl(logo.trim() || undefined)

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t('channel.nameRequired'))
      return
    }

    setError('')
    const trimmedGroup = group.trim()
    const trimmedLogo = logo.trim()

    updateChannel(channel.id, {
      name: trimmedName,
      group: trimmedGroup || undefined,
      logo: trimmedLogo || undefined,
    })

    if (trimmedLogo && trimmedLogo !== channel.logo) {
      window.electronAPI.cacheLogos([trimmedLogo]).catch(() => {})
    }

    onClose()
  }

  return (
    <div className="h-full flex flex-col bg-tv-bg-surface">
      <div className="flex items-center justify-between px-8 py-5 border-b border-tv-border shrink-0">
        <h2 className="text-tv-lg font-bold text-tv-text-primary">{t('channel.editTitle')}</h2>
        <button
          onClick={onClose}
          className="text-tv-text-secondary hover:text-tv-text-primary p-2 rounded-tv-sm"
          title={t('channel.cancel')}
        >
          <svg className="w-6 h-6" viewBox="0 0 15 15" fill="none">
            <path d="M4 4l7 7M11 4l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-[560px] space-y-6">
          <div className="flex items-center gap-4 p-4 bg-tv-bg border border-tv-border rounded-tv-md">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt=""
                className="w-16 h-16 object-contain rounded-tv-sm bg-tv-bg-surface border border-tv-border p-1 flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-tv-sm bg-tv-bg-surface border border-tv-border flex items-center justify-center flex-shrink-0 text-tv-text-secondary">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <div className="text-tv-base text-tv-text-primary font-semibold truncate">{name || t('channel.editTitle')}</div>
              <div className="text-tv-sm text-tv-text-secondary truncate">
                {group ? getGroupDisplayName(group, t) : t('channel.ungrouped')}
              </div>
              <div className="text-tv-xs text-tv-text-secondary/70 break-all select-text mt-0.5">{channel.url}</div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-tv-sm font-medium text-tv-text-primary">{t('channel.name')}</label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('channel.name')}
              className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary placeholder-tv-text-secondary focus:border-tv-accent focus:outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-tv-sm font-medium text-tv-text-primary">{t('channel.group')}</label>
            <input
              type="text"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              list="edit-channel-groups"
              placeholder={t('channel.groupPlaceholder')}
              className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary placeholder-tv-text-secondary focus:border-tv-accent focus:outline-none"
            />
            <datalist id="edit-channel-groups">
              {groupNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-2">
            <label className="block text-tv-sm font-medium text-tv-text-primary">{t('channel.logo')}</label>
            <input
              type="text"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder={t('channel.logoPlaceholder')}
              className="w-full px-4 py-3 bg-tv-bg border border-tv-border rounded-tv-md text-tv-sm text-tv-text-primary placeholder-tv-text-secondary focus:border-tv-accent focus:outline-none"
            />
          </div>

          {error && (
            <div className="text-tv-xs text-red-400 bg-red-900/30 border border-red-800 rounded-tv-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-tv-bg border border-tv-border hover:bg-tv-bg rounded-tv-md text-tv-sm transition-colors"
            >
              {t('channel.cancel')}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 py-3 px-4 bg-tv-accent hover:bg-tv-accent-hover rounded-tv-md text-tv-sm font-medium transition-colors"
            >
              {t('channel.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
