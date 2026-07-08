import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('pipAPI', {
  exitPip: () => ipcRenderer.invoke('exit-pip'),
  togglePlay: () => ipcRenderer.invoke('toggle-play'),
  setVolume: (vol: number) => ipcRenderer.invoke('set-volume', vol),
  toggleMute: () => ipcRenderer.invoke('toggle-mute'),
  getPlayerTime: () => ipcRenderer.invoke('get-player-time'),
  getPlayerDuration: () => ipcRenderer.invoke('get-player-duration'),
  setPlayerTime: (timeMs: number) => ipcRenderer.invoke('set-player-time', timeMs),
  skipTime: (seconds: number) => ipcRenderer.invoke('skip-time', seconds),
  moveBy: (dx: number, dy: number) => ipcRenderer.invoke('pip-move-by', dx, dy),
  getPlaybackState: () => ipcRenderer.invoke('pip-get-playback-state'),
})
