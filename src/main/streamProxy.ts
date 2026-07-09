import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const NEEDS_PROXY_RE = /^rtmp[s]?:\/\/|^rtsp:\/\/|^udp:\/\//
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

  // Low-latency ffmpeg args for live RTMP/RTSP/UDP → HTTP-FLV
  const useScale = currentScale && SCALE_MAP[currentScale]
  const gpuEnc = useScale ? detectGpuEncoder(ffmpegPath) : null
  const args = [
    '-fflags', 'nobuffer+discardcorrupt',
    '-flags', 'low_delay',
    '-analyzeduration', '100000',
    '-probesize', '50000',
    '-i', streamUrl,
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

  console.log('[stream-proxy] ffmpeg start:', streamUrl.substring(0, 60))

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
  })
}

export function needsProxy(url: string): boolean {
  return NEEDS_PROXY_RE.test(url)
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
