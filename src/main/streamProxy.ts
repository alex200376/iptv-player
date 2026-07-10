import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

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

/**
 * Test whether a GPU encoder actually works by encoding a single null frame.
 * Only tests once per session and caches the result.
 */
function detectGpuEncoder(ffmpegPath: string): string | null {
  if (_gpuEncoder !== undefined) return _gpuEncoder

  for (const enc of ['h264_nvenc', 'h264_amf']) {
    try {
      const { execFileSync } = require('child_process')
      execFileSync(ffmpegPath, [
        '-f', 'lavfi', '-i', 'nullsrc=s=1280x720:duration=0.1',
        '-frames:v', '1',
        '-c:v', enc,
        '-f', 'null', '-',
      ], { encoding: 'utf8', timeout: 5000, stdio: 'ignore' })
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

function encoderArgs(enc: string): string[] {
  switch (enc) {
    case 'h264_nvenc':
      return ['-preset', 'p1', '-tune', 'll', '-rc', 'vbr', '-cq', '28', '-b:v', '2M', '-maxrate', '2M']
    case 'h264_amf':
      return ['-usage', 'lowlatency', '-quality', 'speed', '-rc', 'cbr', '-b:v', '2M']
    default:
      return ['-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '28']
  }
}

let httpServer: ReturnType<typeof createServer> | null = null
let serverPort = 0
let currentProcess: ChildProcess | null = null
let currentResponse: ServerResponse | null = null
let currentStreamUrl = ''
let currentScale: string | null = null

let switchTimer: ReturnType<typeof setTimeout> | null = null
let switchResolve: ((url: string) => void) | null = null
let switchReject: ((err: Error) => void) | null = null

function findFfmpeg(vlcDir?: string | null): string {
  if (vlcDir) {
    for (const name of ['ffmpeg.exe', 'ffmpeg']) {
      const p = join(vlcDir, name)
      if (existsSync(p)) return p
    }
  }
  return 'ffmpeg'
}

/**
 * Check if ffmpeg is available on the system.
 * On first call probes once and caches the result for the session.
 */
let _ffmpegAvailable: boolean | undefined = undefined

export function isFfmpegAvailable(vlcDir?: string | null): boolean {
  if (_ffmpegAvailable !== undefined) return _ffmpegAvailable
  const ffmpegPath = findFfmpeg(vlcDir)
  if (ffmpegPath === 'ffmpeg' && !ffmpegPath.includes('\\') && !ffmpegPath.includes('/')) {
    // Bare command — probe PATH
    try {
      const { execFileSync } = require('child_process')
      execFileSync(ffmpegPath, ['-version'], { encoding: 'utf8', timeout: 3000, stdio: 'ignore' })
      _ffmpegAvailable = true
    } catch {
      _ffmpegAvailable = false
    }
  } else {
    _ffmpegAvailable = existsSync(ffmpegPath)
  }
  return _ffmpegAvailable
}

/**
 * Kill a child process immediately.
 * SIGKILL is sent straight away instead of waiting 1.5 s for SIGTERM to take
 * effect — ffmpeg stuck on a dead stream ignores SIGTERM during TCP probe.
 */
function safeKill(proc: ChildProcess): void {
  if (proc.killed) return
  try {
    // On Windows `SIGKILL` is not supported; `taskkill /F` is the equivalent.
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], {
        windowsHide: true,
        stdio: 'ignore',
      })
    } else {
      proc.kill('SIGKILL')
    }
  } catch {
    // Process may have already exited
  }
}

function ensureServer(vlcDir?: string | null): Promise<number> {
  if (httpServer) return Promise.resolve(serverPort)
  return new Promise((resolve) => {
    httpServer = createServer((req: IncomingMessage, res: ServerResponse) => {
      if (req.url?.startsWith('/proxy/')) {
        const encoded = req.url.slice('/proxy/'.length)
        try {
          const streamUrl = Buffer.from(encoded, 'base64url').toString()
          handleProxyRequest(streamUrl, req, res, vlcDir)
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
 * HTTP MPEG-TS streams need explicit -f mpegts to avoid ffmpeg mis-detecting
 * the format from the Content-Type header, which can cause it to bail early.
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
    // Reconnect on drop — critical for Stalker portal streams that have
    // short session timeouts; ffmpeg will re-request the URL automatically.
    base.push('-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5')
    // Use a browser-like User-Agent so the server doesn't block ffmpeg.
    base.push('-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36')
    base.push('-multiple_requests', '1')
    // Give up after 30s on a dead stream — long enough for slow-starting
    // live transcoders but short enough to avoid a permanent hang.
    base.push('-timeout', '30000000')
  }
  if (isRtmp) {
    base.push('-rtmp_live', 'live')
  }
  if (isTs) {
    // Force mpegts demuxer for raw .ts streams so ffmpeg doesn't waste time
    // probing the format and doesn't give up when Content-Type is unusual.
    base.push('-f', 'mpegts')
  }
  base.push('-i', streamUrl)
  return base
}

function handleProxyRequest(
  streamUrl: string,
  req: IncomingMessage,
  res: ServerResponse,
  vlcDir?: string | null,
) {
  // Always kill any running ffmpeg before starting a new one,
  // even if the URL looks the same (the old stream may be dead).
  if (currentProcess) {
    const oldProc = currentProcess
    currentProcess = null
    safeKill(oldProc)
  }

  currentStreamUrl = streamUrl
  const ffmpegPath = findFfmpeg(vlcDir)

  // Low-latency ffmpeg args for live streams → HTTP-FLV
  const useScale = currentScale && SCALE_MAP[currentScale]
  const gpuEnc = useScale ? detectGpuEncoder(ffmpegPath) : null
  const args = [
    ...buildInputArgs(streamUrl),
    ...(useScale
      ? [
          '-vf', useScale,
          '-c:v', gpuEnc || 'libx264',
          ...encoderArgs(gpuEnc || 'libx264'),
          '-c:a', 'aac',
          '-flags', 'low_delay',
        ]
      : ['-c', 'copy']),
    '-f', 'flv',
    '-flvflags', 'no_duration_filesize+no_sequence_end',
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
  currentProcess = proc

  res.writeHead(200, {
    'Content-Type': 'video/x-flv',
    'Cache-Control': 'no-cache, no-store',
    Pragma: 'no-cache',
    'Access-Control-Allow-Origin': '*',
  })

  currentResponse = res
  proc.stdout?.pipe(res)

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
    if (currentProcess === proc) currentProcess = null
    if (!res.writableEnded) res.end()
  })

  proc.on('error', (err) => {
    console.error('[stream-proxy] ffmpeg error:', err.message)
    if (currentProcess === proc) currentProcess = null
    if (!res.writableEnded) res.end()
  })

  // When VLC closes the HTTP connection (e.g. user switched channel),
  // kill ffmpeg immediately so it doesn't keep probing a dead stream.
  req.on('close', () => {
    if (currentProcess === proc) {
      const p = proc
      currentProcess = null
      safeKill(p)
    }
    if (currentResponse === res) {
      currentResponse = null
    }
  })
}

export function needsProxy(url: string): boolean {
  return NEEDS_PROXY_RE.test(url) || isHttpTsStream(url)
}

/**
 * Kill any running ffmpeg proxy process right now.
 * Call this BEFORE setSource so the old process is dead before the new one
 * starts, preventing resource contention on dead streams.
 */
export function stopProxy() {
  if (currentProcess) {
    const p = currentProcess
    currentProcess = null
    safeKill(p)
  }
  // Destroy the HTTP response so VLC's connection is closed immediately —
  // without this, VLC may keep the pipe open draining a dead stream.
  if (currentResponse && !currentResponse.writableEnded) {
    currentResponse.destroy()
  }
  currentResponse = null
  currentStreamUrl = ''
}

export function getProxyUrl(
  streamUrl: string,
  vlcDir?: string | null,
  scale?: string,
): Promise<string> {
  // Cancel any pending debounced switch
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

      // Give the OS time to fully kill the old ffmpeg process and release
      // its TCP socket / pipe before we start a new one.
      await new Promise<void>((r) => setTimeout(r, 50))

      try {
        currentScale = scale && SCALE_MAP[scale] ? scale : null
        const port = await ensureServer(vlcDir)
        const encoded = Buffer.from(streamUrl).toString('base64url')
        resolve(`http://127.0.0.1:${port}/proxy/${encoded}`)
      } catch (err) {
        reject(err)
      }
    }, 200)
  })
}

export function destroyProxy() {
  stopProxy()
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
