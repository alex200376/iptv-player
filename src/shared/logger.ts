import log from 'electron-log/main'

log.transports.file.level = 'warn'
log.transports.file.maxSize = 5 * 1024 * 1024

log.transports.console.level = process.env.ELECTRON_RENDERER_URL ? 'debug' : 'warn'

export const logger = {
  debug: (msg: string, ...args: unknown[]) => log.debug(`[iptv] ${msg}`, ...args),
  info: (msg: string, ...args: unknown[]) => log.info(`[iptv] ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) => log.warn(`[iptv] ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) => log.error(`[iptv] ${msg}`, ...args),
}
