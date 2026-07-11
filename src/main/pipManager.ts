import { BrowserWindow, screen as electronScreen } from 'electron'
import { join } from 'path'
import { t } from './i18n'

export function getPipHtml(): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-user-select:none;user-select:none}
html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:Inter,Noto Sans SC,system-ui,sans-serif}
#player{position:absolute;top:10px;left:0;right:0;bottom:36px}
#player video,#player canvas{width:100%!important;height:100%!important;display:block;object-fit:contain}
#drag-strip{position:absolute;top:0;left:0;right:0;height:10px;z-index:10;-webkit-app-region:drag;display:flex;align-items:center;justify-content:center;pointer-events:none}
#drag-handle{width:24px;height:4px;border-radius:2px;background:rgba(255,255,255,0.35);pointer-events:none}
#controls-bar{position:absolute;bottom:0;left:0;right:0;height:36px;display:flex;align-items:center;gap:6px;padding:0 8px;background:rgba(20,22,26,0.9);-webkit-app-region:drag}
#controls-bar button,#controls-bar input{-webkit-app-region:no-drag}
.ctrl-btn{background:none;border:none;color:#fff;cursor:pointer;width:28px;height:28px;border-radius:2px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s}
.ctrl-btn:hover{background:rgba(255,138,61,0.2)}
.ctrl-btn svg{width:16px;height:16px;fill:currentColor}
#close-btn.ctrl-btn:hover{background:rgba(220,50,50,0.7)}
#time-display{color:rgba(255,255,255,0.75);font-size:11px;white-space:nowrap;font-variant-numeric:tabular-nums;flex-shrink:0;min-width:68px;text-align:center;-webkit-app-region:no-drag}
#progress-wrap{flex:1;min-width:0;display:flex;align-items:center;padding:0 2px}
#progress-bar{width:100%;height:4px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,0.2);border-radius:2px;outline:none;cursor:pointer}
#progress-bar::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:#fff;border:1px solid rgba(0,0,0,0.3);box-shadow:0 0 2px rgba(0,0,0,0.4)}
#progress-bar::-webkit-slider-runnable-track{height:4px;border-radius:2px}
#volume-wrap{display:flex;align-items:center;gap:4px;flex-shrink:0;-webkit-app-region:no-drag}
#volume-slider{width:50px;height:4px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,0.2);border-radius:2px;outline:none;cursor:pointer}
#volume-slider::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;background:#fff}
body{border-radius:4px;overflow:hidden;--pip-radius:4px}
</style>
</head>
<body>
<div id="drag-strip"><div id="drag-handle"></div></div>
<div id="player"></div>
<div id="controls-bar">
  <button class="ctrl-btn" id="play-btn" title="${t('pip.playPause')}">
    <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
  </button>
  <span id="time-display">--:-- / --:--</span>
  <div id="progress-wrap">
    <input type="range" id="progress-bar" min="0" max="1000" value="0">
  </div>
  <div id="volume-wrap">
    <button class="ctrl-btn" id="volume-btn" title="${t('pip.mute')}">
      <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.49 4.49 0 0 0 2.5-3.5zm2.5 0A7.5 7.5 0 0 0 14 5.5v2a5.5 5.5 0 0 1 0 9v2a7.5 7.5 0 0 0 5-6.5z"/></svg>
    </button>
    <input type="range" id="volume-slider" min="0" max="100" value="80">
  </div>
  <button class="ctrl-btn" id="close-btn" title="${t('pip.close')}">
    <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
  </button>
</div>
<script>
(function(){
  let isPlaying = true, isMuted = false, volume = 80
  let currentTime = 0, duration = 0, isSeeking = false
  const playBtn = document.getElementById('play-btn')
  const timeDisplay = document.getElementById('time-display')
  const progressBar = document.getElementById('progress-bar')
  const volumeSlider = document.getElementById('volume-slider')
  const volumeBtn = document.getElementById('volume-btn')
  const closeBtn = document.getElementById('close-btn')

  function fmt(ms) {
    const s = Math.floor(ms / 1000)
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0')
    return m + ':' + String(sec).padStart(2,'0')
  }

  function updatePlayBtn() {
    playBtn.innerHTML = isPlaying
      ? '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>'
  }

  function updateVolumeIcon() {
    volumeBtn.innerHTML = isMuted || volume === 0
      ? '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13 7.59L14.59 14 13 15.59 16.59 19 13 22.59 14.59 24 17 20.41 19.41 23 21 21.41 18.59 19 22 15.59 20.41 14 17 17.59z"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 8.5v7a4.49 4.49 0 0 0 2.5-3.5zm2.5 0A7.5 7.5 0 0 0 14 5.5v2a5.5 5.5 0 0 1 0 9v2a7.5 7.5 0 0 0 5-6.5z"/></svg>'
  }

  function updateProgress() {
    if (isSeeking) return
    if (duration > 0) {
      const pct = Math.round((currentTime / duration) * 1000)
      progressBar.value = Math.min(1000, Math.max(0, pct))
    } else {
      progressBar.value = 0
    }
    timeDisplay.textContent = fmt(currentTime) + ' / ' + (duration > 0 ? fmt(duration) : '--:--')
  }

  playBtn.addEventListener('click', async () => {
    await window.pipAPI.togglePlay()
    isPlaying = !isPlaying
    updatePlayBtn()
  })

  progressBar.addEventListener('input', () => {
    isSeeking = true
    const pct = parseInt(progressBar.value) / 1000
    if (duration > 0) {
      timeDisplay.textContent = fmt(pct * duration) + ' / ' + fmt(duration)
    }
  })
  progressBar.addEventListener('change', () => {
    const pct = parseInt(progressBar.value) / 1000
    if (duration > 0) window.pipAPI.setPlayerTime(pct * duration)
    isSeeking = false
  })

  volumeSlider.addEventListener('input', () => {
    volume = parseInt(volumeSlider.value)
    window.pipAPI.setVolume(volume)
    updateVolumeIcon()
  })
  volumeBtn.addEventListener('click', async () => {
    isMuted = await window.pipAPI.toggleMute()
    updateVolumeIcon()
  })

  closeBtn.addEventListener('click', () => window.pipAPI.exitPip())

  document.addEventListener('keydown', (e) => {
    if (e.key === ' ' || e.key === 'Space') { playBtn.click(); e.preventDefault() }
    if (e.key === 'ArrowLeft') { window.pipAPI.skipTime(-10); e.preventDefault() }
    if (e.key === 'ArrowRight') { window.pipAPI.skipTime(10); e.preventDefault() }
    if (e.key === 'ArrowUp') { volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 5); volume = parseInt(volumeSlider.value); window.pipAPI.setVolume(volume); updateVolumeIcon(); e.preventDefault() }
    if (e.key === 'ArrowDown') { volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 5); volume = parseInt(volumeSlider.value); window.pipAPI.setVolume(volume); updateVolumeIcon(); e.preventDefault() }
  })

  async function poll() {
    const [time, dur] = await Promise.all([
      window.pipAPI.getPlayerTime(),
      window.pipAPI.getPlayerDuration()
    ])
    currentTime = time
    if (dur > 0) duration = dur
    updateProgress()
  }

  async function pollState() {
    try {
      const state = await window.pipAPI.getPlaybackState()
      isPlaying = state.playing
      isMuted = state.muted
      volume = state.volume
      volumeSlider.value = volume
      updatePlayBtn()
      updateVolumeIcon()
    } catch {}
  }

  setInterval(poll, 2000)
  setInterval(pollState, 5000)
  pollState()
  poll()
})()
</script>
</body>
</html>`
}

export function createPipWindow(vlcDir: string): BrowserWindow {
  const pipWin = new BrowserWindow({
    width: 400,
    height: 260,
    minWidth: 280,
    minHeight: 180,
    maxWidth: 800,
    maxHeight: 600,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    show: false,
    backgroundColor: '#000',
    webPreferences: {
      preload: join(__dirname, '../preload/pipPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  pipWin.on('ready-to-show', () => {
    pipWin.show()
  })

  return pipWin
}

export function positionPipBottomRight(pipWindow: BrowserWindow) {
  const cursor = electronScreen.getCursorScreenPoint()
  const display = electronScreen.getDisplayNearestPoint(cursor)
  const { x: dx, y: dy, width: dw, height: dh } = display.workArea
  const bounds = pipWindow.getBounds()
  pipWindow.setPosition(
    dx + dw - bounds.width - 20,
    dy + dh - bounds.height - 20,
  )
}
