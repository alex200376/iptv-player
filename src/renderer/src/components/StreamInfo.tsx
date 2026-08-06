import { Download, Volume2, VolumeX } from 'lucide-react'
import { useStore } from '../stores/useStore'

/** Shorten a VLC track name (e.g. "H264 - MPEG-4 AVC (part 10) (h264)") to its fourcc. */
function shortCodec(name: string): string {
  const m = name.match(/\(([a-z0-9-]+)\)\s*$/i)
  if (m) return m[1].toUpperCase()
  return name.split(' ')[0]?.slice(0, 8) || name
}

function formatSpeed(bps: number): string {
  if (bps <= 0) return '0 KB/s'
  if (bps >= 1048576) return `${(bps / 1048576).toFixed(1)} MB/s`
  if (bps >= 1024) return `${Math.round(bps / 1024)} KB/s`
  return `${Math.round(bps)} B/s`
}

/**
 * Real stream info shown in the bottom info bar, right of the channel name.
 * Reads live values polled from the player (see PlayerContainer). Values are
 * only rendered when they are real — the download speed appears only for
 * proxied streams, where the app actually measures the byte rate.
 */
export default function StreamInfo() {
  const stats = useStore((s) => s.playerStats)
  const live = stats.playing || stats.volume > 0 || stats.videoSize !== null
  const muted = stats.muted || stats.volume === 0

  return (
    <div className="stream-info">
      {stats.videoSize && (
        <span className="stream-info-chip" title={`Video: ${stats.videoSize.width}×${stats.videoSize.height}`}>
          {stats.videoSize.width}×{stats.videoSize.height}
        </span>
      )}
      {!!stats.fps && (
        <span className="stream-info-chip stream-info-fps" title="Frame rate">
          {Math.round(stats.fps)} fps
        </span>
      )}
      {stats.videoCodec && (
        <span className="stream-info-chip stream-info-codec" title={stats.videoCodec}>
          {shortCodec(stats.videoCodec)}
        </span>
      )}
      {stats.downloadSpeedBps !== null && stats.downloadSpeedBps !== undefined && (
        <span className="stream-info-chip stream-info-speed" title="Download speed">
          <Download className="stream-info-chip-icon" />
          {formatSpeed(stats.downloadSpeedBps)}
        </span>
      )}
      {live && (
        <span
          className={`stream-info-chip ${muted ? 'stream-info-muted' : ''}`}
          title={muted ? 'Muted' : `Volume: ${stats.volume}%`}
        >
          {muted ? <VolumeX className="stream-info-chip-icon" /> : <Volume2 className="stream-info-chip-icon" />}
          <span className="stream-info-volbar">
            <span className="stream-info-volfill" style={{ width: `${stats.volume}%` }} />
          </span>
          {stats.volume}%
        </span>
      )}
    </div>
  )
}
