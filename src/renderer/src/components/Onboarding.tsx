import { useState } from 'react'

const STEPS = [
  {
    title: '欢迎使用 IPTV Player',
    subtitle: '10 英尺电视体验',
    icon: (
      <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
    description: '高清直播，流畅播放。支持 RTMP、RTSP、HLS 及 M3U 播放列表。',
  },
  {
    title: '导入播放列表',
    subtitle: '开始观看',
    icon: (
      <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="12" y1="18" x2="12" y2="12" />
        <line x1="9" y1="15" x2="15" y2="15" />
      </svg>
    ),
    description: '从本地文件或在线地址导入 M3U 播放列表，频道自动分组，即点即播。',
  },
  {
    title: '准备好了！',
    subtitle: '享受你的节目',
    icon: (
      <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22,4 12,14.01 9,11.01" />
      </svg>
    ),
    description: '按 Ctrl+B 切换频道列表，Ctrl+, 打开设置。祝你观影愉快！',
  },
]

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const s = STEPS[step]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-[fadeIn_300ms_ease]">
      <div className="w-[90vw] max-w-[600px] bg-tv-bg-surface border border-tv-border rounded-2xl p-10 shadow-2xl text-center">
        <div className="flex justify-center mb-6 text-tv-accent">{s.icon}</div>
        <h2 className="text-tv-xl font-bold text-tv-text-primary mb-2">{s.title}</h2>
        <p className="text-tv-sm text-tv-accent mb-4">{s.subtitle}</p>
        <p className="text-tv-sm text-tv-text-secondary mb-8 leading-relaxed">{s.description}</p>
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((_, i) => (
            <div key={i} className={`w-3 h-3 rounded-full transition-colors ${i === step ? 'bg-tv-accent' : 'bg-tv-border'}`} />
          ))}
        </div>
        <button
          onClick={() => {
            if (step < STEPS.length - 1) setStep(step + 1)
            else onDone()
          }}
          className="px-10 py-3 bg-tv-accent hover:bg-tv-accent-hover text-white rounded-xl text-tv-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-tv-focus-ring"
        >
          {step < STEPS.length - 1 ? '下一步' : '开始使用'}
        </button>
      </div>
    </div>
  )
}
