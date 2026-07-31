import { useToastStore } from '../stores/toastStore'

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const removeToast = useToastStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto px-4 py-2.5 rounded-tv-md text-tv-sm shadow-xl border animate-[fadeIn_200ms_ease] flex items-center gap-2 ${
            t.type === 'success'
              ? 'bg-green-900/90 border-green-700 text-green-200'
              : t.type === 'error'
                ? 'bg-red-900/90 border-red-700 text-red-200'
                : 'bg-tv-bg-surface border-tv-border text-tv-text-primary'
          }`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-current opacity-60 hover:opacity-100"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l7 7M11 4l-7 7" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  )
}