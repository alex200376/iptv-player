import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { spawn, execFile, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

// RTMP/RTSP/UDP always need proxy.
// HTTP .ts streams (MPEG-TS over HTTP) also need proxy — VLC cannot reliably
// play raw MPEG-TS over HTTP without ffmpeg demuxing it first.
const NEEDS_PROXY_RE = /^rtmp[s]?:\/\/|^rtsp:\/\/|^udp:\/\/|^rtp:\/\//

/**
 * Returns true when the URL is an HTTP/HTTPS MPEG-TS stream that needs the
 * ffmpeg proxy even though the scheme is http(s).
 * Matches:
 *  - paths ending in .ts (with optional query string / fragment)
 *  - paths containing /live.ts, /stream.ts, /play.ts
 *  - query strings containing "channelId=" (Stalker portal pattern)
 *
 * FIX(critical): Added explicit `return false` on all exit paths.
 */
function isHttpTsStream(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false
  try {
    const u = new URL(url)
    const path = u.pathname.toLowerCase()
    if (/\.ts$/.test(path)) return true
    if (/\/(live|stream|play|channel|video)\.ts/.test(path)) return true
    if (u.searchParams.has('channelId')) return true
  } catch {
    // malformed URL — fall through
  }
  return false
}

const SCALE_MAP: Record<string, string | null> = {
  original: null,
  '2160p': 'scale=-2:2160',
  '1440p': 'scale=-2:1440',
  '1080p': 'scale=-2:1080',
  '720p': 'scale=-2:720',
  '540p': 'scale=-2:540',
  '480p': 'scale=-2:480',
  '360p': 'scale=-2:360',
}

/** Cached GPU encoder name, null if none available, undefined = not probed yet. */
let _gpuEncoder: string | null | undefined = undefined
let _gpuEncoderProbe: Promise<string | null> | null = null

/**
 * Test whether a GPU encoder actually works by encoding a single null frame.
 * Only tests once per session and caches the result.
 * FIX(low): Added Intel QSV (h264_qsv) to the encoder probe list.
 */
async function probeGpuEncoder(ffmpegPath: string): Promise<string | null> {
  for (const enc of ['h264_nvenc', 'h264_amf', 'h264_qsv']) {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile(ffmpegPath, [
          '-f', 'lavfi', '-i', 'nullsrc=s=1280x720:duration=0.1',
          '-frames:v', '1',
          '-c:v', enc,
          '-f', 'null', '-',
        ], { timeout: 5000, stdio: 'ignore' }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      _gpuEncoder = enc
      console.log('[stream-proxy] GPU encoder available:', enc)
      return enc
    } catch {
      console.log('[stream-proxy] GPU encoder not available:', enc)
    }
  }
  _gpuEncoder = null
  return null
}

async function detectGpuEncoder(ffmpegPath: string): Promise<string | null> {
  if (_gpuEncoder !== undefined) return _gpuEncoder
  if (_gpuEncoderProbe) return _gpuEncoderProbe
  _gpuEncoderProbe = probeGpuEncoder(ffmpegPath)
  return _gpuEncoderProbe
}

function encoderArgs(enc: string): string[] {
  switch (enc) {
    case 'h264_nvenc':
      return ['-preset', 'p1', '-tune', 'll', '-rc', 'vbr', '-cq', '28', '-b:v', '2M', '-maxrate', '2M']
    case 'h264_amf':
      return ['-usage', 'lowlatency', '-quality', 'speed', '-rc', 'cbr', '-b:v', '2M']
    case 'h264_qsv':
      return ['-preset', 'veryfast', '-look_ahead', '0', '-b:v', '2M']
    default:
      return ['-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '28']
  }
}

let httpServer: ReturnType<typeof createServer> | null = null
let serverPort = 0

/**
 * FIX(critical): Replaced single global `currentProcess` with a per-session
 * Map to eliminate race conditions when PiP window and main window both stream
 * simultaneously. Each session (identified by a caller-supplied ID) tracks its
 * own ChildProcess independently.
 */
const activeProcesses = new Map<string, ChildProcess>()

let currentScale: string | null = null

let switchTimer: ReturnType<typeof setTimeout> | null = null
let switchResolve: ((url: string) => void) | null = null
let switchReject: ((err: Error) => void) | null = null

function findFfmpeg(vlcDir?: string | null): string {
  // 1. Check bundled resources path (extraResources)
  const bundled = app.isPackaged
    ? join(process.resourcesPath, 'resources', 'ffmpeg.exe')
    : join(__dirname, '..', '..', 'resources', 'ffmpeg.exe')
  if (existsSync(bundled)) return bundled

  // 2. Check VLC directory
  if (vlcDir) {
    for (const name of ['ffmpeg.exe', 'ffmpeg']) {
      const p = join(vlcDir, name)
      if (existsSync(p)) return p
    }
  }

  // 3. Fall back to PATH
  return 'ffmpeg'
}

/**
 * Check if ffmpeg is available on the system.
 * On first call probes once and caches the result for the session.
 */
let _ffmpegAvailable: boolean | undefined = undefined
let _ffmpegProbe: Promise<boolean> | null = null

async function probeFfmpeg(vlcDir?: string | null): Promise<boolean> {
  const ffmpegPath = findFfmpeg(vlcDir)
  if (ffmpegPath === 'ffmpeg' && !ffmpegPath.includes('\\') && !ffmpegPath.includes('/')) {
    try {
      await new Promise<void>((resolve, reject) => {
        execFile(ffmpegPath, ['-version'], { timeout: 3000 }, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      _ffmpegAvailable = true
    } catch {
      _ffmpegAvailable = false
    }
  } else {
    _ffmpegAvailable = existsSync(ffmpegPath)
  }
  return _ffmpegAvailable
}

export async function isFfmpegAvailable(vlcDir?: string | null): Promise<boolean> {
  if (_ffmpegAvailable !== undefined) return _ffmpegAvailable
  if (_ffmpegProbe) return _ffmpegProbe
  _ffmpegProbe = probeFfmpeg(vlcDir)
  return _ffmpegProbe
}

/**
 * Kill a child process immediately.
 * SIGKILL is sent straight away instead of waiting 1.5 s for SIGTERM to take
 * effect — ffmpeg stuck on a dead stream ignores SIGTERM during TCP probe.
 */
function safeKill(proc: ChildProcess): void {
  if (proc.killed) return
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], {
        windowsHide: true,
        stdio: 'ignore',
      })
    } else {
      proc.kill('SIGKILL')
    }
  } catch (e) {
    console.error('[stream-proxy] safeKill error:', e)
  }
}

function ensureServer(vlcDir?: string | null): Promise<number> {
  if (httpServer) return Promise.resolve(serverPort)
  return new Promise((resolve) => {
    httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url?.startsWith('/proxy/')) {
        // URL format: /proxy/<sessionId>/<base64url-encoded stream URL>
        const rest = req.url.slice('/proxy/'.length)
        const slashIdx = rest.indexOf('/')
        if (slashIdx === -1) {
          res.writeHead(400)
          res.end('Bad Request')
          return
        }
        const sessionId = rest.slice(0, slashIdx)
        const encoded = rest.slice(slashIdx + 1)
        try {
          const streamUrl = Buffer.from(encoded, 'base64url').toString()
          handleProxyRequest(streamUrl, req, res, sessionId, vlcDir)
        } catch {
          res.writeHead(400)
          res.end('Bad Request')
        }
      } else {
        res.writeHead(404)
        res.end('Not Found')
      }
    })
    httpServer.listen(0, '127.0.0.1', () => {
      serverPort = (httpServer!.address() as AddressInfo).port
      console.log('[stream-proxy] HTTP server on port', serverPort)
      resolve(serverPort)
    })
  })
}

/**
 * Build ffmpeg input args for a given URL.
 */
function buildInputArgs(streamUrl: string): string[] {
  const isHttp = /^https?:\/\//i.test(streamUrl)
  const isRtmp = /^rtmp[s]?:\/\//i.test(streamUrl)
  const isTs = isHttpTsStream(streamUrl)
  const base = [
    '-fflags', 'nobuffer+discardcorrupt',
    '-flags', 'low_delay',
    '-analyzeduration', '2000000',
    '-probesize', '1000000',
  ]
  if (isHttp) {
    base.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5', '-reconnect_at_eof', '1')
    base.push('-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36')
    base.push('-multiple_requests', '1')
    base.push('-timeout', '15000000')
  }
  if (isRtmp) {
    base.push('-rtmp_live', 'live')
  }
  if (isTs) {
    base.push('-f', 'mpegts')
  }
  base.push('-i', streamUrl)
  return base
}

/**
 * FIX(critical): `sessionId` parameter added so each caller (main window / PiP)
 * manages its own ffmpeg process independently — no more global state collision.
 */
async function handleProxyRequest(
  streamUrl: string,
  req: IncomingMessage,
  res: ServerResponse,
  sessionId: string,
  vlcDir?: string | null,
) {
  // Kill only the process for THIS session, not all sessions
  if (activeProcesses.has(sessionId)) {
    safeKill(activeProcesses.get(sessionId)!)
    activeProcesses.delete(sessionId)
  }

  const ffmpegPath = findFfmpeg(vlcDir)

  const useScale = currentScale && SCALE_MAP[currentScale]
  const gpuEnc = useScale ? await detectGpuEncoder(ffmpegPath) : null
  const inputArgs = buildInputArgs(streamUrl)
  // Stream-copy mode: reduce analysis time for faster first-byte-to-VLC
  if (!useScale) {
    for (let i = 0; i < inputArgs.length; i++) {
      if (inputArgs[i] === '-analyzeduration') inputArgs[i + 1] = '500000'
      if (inputArgs[i] === '-probesize') inputArgs[i + 1] = '500000'
    }
  }
  const args = [
    ...inputArgs,
    ...(useScale
      ? [
          '-vf', useScale,
          '-c:v', gpuEnc || 'libx264',
          ...encoderArgs(gpuEnc || 'libx264'),
          '-c:a', 'aac',
          '-flags', 'low_delay',
        ]
      : ['-c', 'copy']),
    '-f', 'mpegts',
    '-flush_packets', '1',
    '-loglevel', 'warning',
    'pipe:1',
  ]

  if (gpuEnc) console.log('[stream-proxy] using GPU encoder:', gpuEnc)
  console.log('[stream-proxy] ffmpeg cmd:', ffmpegPath, args.join(' '))

  const proc = spawn(ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  activeProcesses.set(sessionId, proc)

  res.writeHead(200, {
    'Content-Type': 'video/mp2t',
    'Cache-Control': 'no-cache, no-store',
    Pragma: 'no-cache',
    'Access-Control-Allow-Origin': '*',
  })

  const outputTimeout = setTimeout(() => {
    if (activeProcesses.get(sessionId) === proc) {
      console.warn('[stream-proxy] ffmpeg no output for 20s, killing')
      activeProcesses.delete(sessionId)
      safeKill(proc)
      if (!res.writableEnded) {
        try { res.destroy() } catch (e) { console.error('[stream-proxy] destroy response:', e) }
      }
    }
  }, 20000)

  proc.stdout?.pipe(res)

  let hasOutput = false
  proc.stdout?.on('data', () => {
    if (!hasOutput) {
      hasOutput = true
      clearTimeout(outputTimeout)
    }
  })

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString()
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (t && (t.includes('Error') || t.includes('error') || t.includes('Invalid') || t.includes('frame=') || t.includes('Stream'))) {
        console.debug('[ffmpeg]', t)
      }
    }
  })

  proc.on('close', (code) => {
    console.log('[stream-proxy] ffmpeg exited, code:', code)
    clearTimeout(outputTimeout)
    if (activeProcesses.get(sessionId) === proc) activeProcesses.delete(sessionId)
    if (!res.writableEnded) res.end()
  })

  proc.on('error', (err) => {
    console.error('[stream-proxy] ffmpeg error:', err.message)
    clearTimeout(outputTimeout)
    if (activeProcesses.get(sessionId) === proc) activeProcesses.delete(sessionId)
    if (!res.writableEnded) res.end()
  })

  req.on('close', () => {
    if (activeProcesses.get(sessionId) === proc) {
      activeProcesses.delete(sessionId)
      safeKill(proc)
    }
  })
}

export function needsProxy(url: string): boolean {
  return NEEDS_PROXY_RE.test(url) || isHttpTsStream(url)
}

/**
 * Kill the ffmpeg proxy process for a specific session.
 * Pass sessionId='all' to kill every active session.
 */
export function stopProxy(sessionId = 'main') {
  if (sessionId === 'all') {
    for (const [id, proc] of activeProcesses) {
      safeKill(proc)
      activeProcesses.delete(id)
    }
    return
  }
  if (activeProcesses.has(sessionId)) {
    safeKill(activeProcesses.get(sessionId)!)
    activeProcesses.delete(sessionId)
  }
}

export function getProxyUrl(
  streamUrl: string,
  vlcDir?: string | null,
  scale?: string,
  sessionId = 'main',
): Promise<string> {
  if (switchTimer !== null) {
    clearTimeout(switchTimer)
    switchTimer = null
    switchReject?.(new Error('Stream switch superseded'))
    switchResolve = null
    switchReject = null
  }

  return new Promise<string>((resolve, reject) => {
    switchResolve = resolve
    switchReject = reject

    switchTimer = setTimeout(async () => {
      switchTimer = null
      switchResolve = null
      switchReject = null

      try {
        currentScale = scale && SCALE_MAP[scale] ? scale : null
        const port = await ensureServer(vlcDir)
        const encoded = Buffer.from(streamUrl).toString('base64url')
        // Include sessionId in the URL path so the server routes correctly
        resolve(`http://127.0.0.1:${port}/proxy/${sessionId}/${encoded}`)
      } catch (err) {
        reject(err)
      }
    }, 50)
  })
}

export async function createProxyUrl(
  streamUrl: string,
  vlcDir?: string | null,
  scale?: string,
  sessionId: string = 'main',
): Promise<string> {
  currentScale = scale && SCALE_MAP[scale] ? scale : null
  const port = await ensureServer(vlcDir)
  const encoded = Buffer.from(streamUrl).toString('base64url')
  return `http://127.0.0.1:${port}/proxy/${sessionId}/${encoded}`
}

export function destroyProxy() {
  stopProxy('all')
  if (switchTimer !== null) {
    clearTimeout(switchTimer)
    switchTimer = null
  }
  if (httpServer) {
    httpServer.close()
    httpServer = null
    serverPort = 0
  }
}
