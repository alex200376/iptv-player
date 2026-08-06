import { useEffect, useState, useRef } from 'react'
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  PictureInPicture2,
  Maximize,
  Minimize,
  ListVideo,
} from 'lucide-react'
import { useStore } from '../stores/useStore'
import { useTranslation } from 'react-i18next'

/**
 * Hover control bar shown at the bottom of the video area.
 * Mirrors the PiP window controls (play/pause, mute, volume) plus
 * EPG, PiP and fullscreen toggles. State is kept in the zustand store
 * so keyboard shortcuts (Space / M / arrows) and the buttons stay in sync.
 */
export default function PlayerControls({ onToggleEpg }: { onToggleEpg: () => void }) {
  const { t } = useTranslation()
  const volume = useStore((s) => s.volume)
  const isPlaying = useStore((s) => s.isPlaying)
  const isMuted = useStore((s) => s.isMuted)
  const setVolume = useStore((s) => s.setVolume)
  const setIsPlaying = useStore((s) => s.setIsPlaying)
  const setIsMuted = useStore((s) => s.setIsMuted)
  const [pipActive, setPipActive] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  // Guard so a fast slider drag only triggers one toggleMute (each IPC call
  // flips VLC's mute state, so repeated calls would race and re-mute).
  const unmutingRef = useRef(false)

  const syncState = () => {
    window.electronAPI
      .getPlayerState()
      .then((s: { playing: boolean; muted: boolean; volume: number }) => {
        // volume === 0 && !playing means there is no live player — keep store defaults
        if (s.playing || s.volume > 0) {
          useStore.setState({ isPlaying: s.playing, isMuted: s.muted, volume: s.volume })
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    syncState()
    const offPip = window.electronAPI.onPipStateChange((active: boolean) => {
      setPipActive(active)
      if (!active) syncState() // volume may have changed inside the PiP window
    })
    const offFs = window.electronAPI.onFullscreenChanged(setFullscreen)
    return () => {
      offPip()
      offFs()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // While in PiP the video lives in the PiP window — hide this bar.
  if (pipActive) return null

  const handleTogglePlay = () => {
    const next = !useStore.getState().isPlaying
    setIsPlaying(next)
    window.electronAPI.togglePlay()
  }

  const handleToggleMute = () => {
    window.electronAPI.toggleMute().then(setIsMuted).catch(() => {})
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    window.electronAPI.setVolume(v)
    if (useStore.getState().isMuted && v > 0 && !unmutingRef.current) {
      unmutingRef.current = true
      window.electronAPI
        .toggleMute()
        .then((m: boolean) => setIsMuted(m))
        .catch(() => {})
        .finally(() => {
          unmutingRef.current = false
        })
    }
  }

  const handleTogglePip = () => {
    window.electronAPI
      .togglePip()
      .then((res: { active: boolean }) => setPipActive(res.active))
      .catch(() => {})
  }

  const handleToggleFullscreen = () => {
    window.electronAPI.toggleFullscreen().catch(() => {})
  }

  const playLabel = isPlaying ? t('controls.pause') : t('controls.play')

  return (
    <div className="video-controls-overlay z-20">
      <div className="flex items-center gap-2">
        <button
          className="controls-btn"
          onClick={handleTogglePlay}
          title={playLabel}
          aria-label={playLabel}
        >
          {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
        </button>

        <button
          className="controls-btn"
          onClick={handleToggleMute}
          title={isMuted || volume === 0 ? t('controls.unmute') : t('controls.mute')}
          aria-label={isMuted || volume === 0 ? t('controls.unmute') : t('controls.mute')}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>

        <input
          type="range"
          className="volume-slider"
          min={0}
          max={100}
          step={1}
          value={volume}
          onChange={handleVolumeChange}
          aria-label={t('controls.volume')}
        />
        <span className="text-xs text-white/70 tabular-nums w-9 text-right select-none shrink-0">
          {volume}%
        </span>

        <div className="flex-1" />

        <button
          className="controls-btn"
          onClick={onToggleEpg}
          title={t('player.epgButton')}
          aria-label={t('player.epgButton')}
        >
          <ListVideo className="w-5 h-5" />
        </button>

        <button
          className={`controls-btn ${pipActive ? 'text-primary' : ''}`}
          onClick={handleTogglePip}
          title={pipActive ? t('controls.exitPip') : t('controls.pip')}
          aria-label={pipActive ? t('controls.exitPip') : t('controls.pip')}
        >
          <PictureInPicture2 className="w-5 h-5" />
        </button>

        <button
          className="controls-btn"
          onClick={handleToggleFullscreen}
          title={fullscreen ? t('controls.exitFullscreen') : t('controls.fullscreen')}
          aria-label={fullscreen ? t('controls.exitFullscreen') : t('controls.fullscreen')}
        >
          {fullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )
}
