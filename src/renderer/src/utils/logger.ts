type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function send(level: LogLevel, msg: string, ...args: unknown[]): void {
  // Forward to the main process so renderer logs land in the same electron-log file.
  if (typeof window !== 'undefined' && typeof window.electronAPI?.logToMain === 'function') {
    try {
      window.electronAPI.logToMain(level, msg, ...args)
      return
    } catch {
      // Fall through to console if forwarding fails (e.g. preload not ready).
    }
  }
  const fn = console[level] ?? console.log
  fn(`[renderer] ${msg}`, ...args)
}

export const logger = {
  debug: (msg: string, ...args: unknown[]) => send('debug', msg, ...args),
  info: (msg: string, ...args: unknown[]) => send('info', msg, ...args),
  warn: (msg: string, ...args: unknown[]) => send('warn', msg, ...args),
  error: (msg: string, ...args: unknown[]) => send('error', msg, ...args),
}
