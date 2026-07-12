import { Menu, BrowserWindow, app, MenuItemConstructorOptions } from 'electron'
import { getState } from './ipc/shared'
import { t } from './i18n'

function sendToRenderer(action: string) {
  const state = getState()
  if (state.mainWindow && !state.mainWindow.isDestroyed()) {
    state.mainWindow.webContents.send('menu-action', action)
  }
}

function buildFileMenu(): MenuItemConstructorOptions[] {
  return [
    { label: 'Import M3U', accelerator: 'CmdOrCtrl+I', click: () => sendToRenderer('import-m3u') },
    { label: 'Open Stream', click: () => sendToRenderer('open-stream') },
    { type: 'separator' },
    { label: 'Settings', accelerator: 'CmdOrCtrl+,', click: () => sendToRenderer('open-settings') },
    { type: 'separator' },
    { role: 'quit', label: 'Exit' },
  ]
}

function buildEditMenu(): MenuItemConstructorOptions[] {
  return [
    { role: 'undo' },
    { role: 'redo' },
    { type: 'separator' },
    { role: 'cut' },
    { role: 'copy' },
    { role: 'paste' },
    { role: 'selectAll' },
  ]
}

function buildViewMenu(): MenuItemConstructorOptions[] {
  return [
    { label: 'Toggle Fullscreen', accelerator: 'F', click: () => {
      const state = getState()
      if (state.mainWindow) state.mainWindow.setFullScreen(!state.mainWindow.isFullScreen())
    }},
    { type: 'separator' },
    { label: 'Program Guide', click: () => sendToRenderer('open-epg') },
  ]
}

function buildWindowMenu(): MenuItemConstructorOptions[] {
  return [
    { label: 'Minimize', accelerator: 'CmdOrCtrl+M', click: () => {
      const state = getState()
      if (state.mainWindow) state.mainWindow.minimize()
    }},
    { label: 'Toggle Fullscreen', accelerator: 'F11', click: () => {
      const state = getState()
      if (state.mainWindow) state.mainWindow.setFullScreen(!state.mainWindow.isFullScreen())
    }},
  ]
}

function buildHelpMenu(): MenuItemConstructorOptions[] {
  return [
    { label: 'About IPTV Player', click: () => sendToRenderer('show-about') },
    { label: 'Check for Updates', click: () => sendToRenderer('check-update') },
  ]
}

const menuMap: Record<string, () => MenuItemConstructorOptions[]> = {
  file: buildFileMenu,
  edit: buildEditMenu,
  view: buildViewMenu,
  window: buildWindowMenu,
  help: buildHelpMenu,
}

export function showMenuPopup(menuName: string, browserWindow: BrowserWindow, x: number, y: number) {
  const builder = menuMap[menuName]
  if (!builder) return
  const template = builder()
  const menu = Menu.buildFromTemplate(template)
  menu.on('menu-will-close', () => {
    if (!browserWindow.isDestroyed()) {
      browserWindow.webContents.send('menu-closed')
    }
  })
  menu.popup({ window: browserWindow, x, y })
}
