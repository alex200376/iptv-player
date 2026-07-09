import { createServer, IncomingMessage, ServerResponse } from 'http'
import { AddressInfo } from 'net'
import { spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

const NEEDS_PROXY_RE = /^rtmp[s]?:\/\/|^rtsp:\/\/|^udp:\/\//
const SCALE_MAP: Record<string, string | null> = {
  'original': null,
  '2160p': 'scale=-2:2160',
  '1440p': 'scale=-2:1440',
  '1080p': 'scale=-2:1080',
  '720p': 'scale=-2:720',
  '540p': 'scale=-2:540',
  '480p': 'scale=-2:480',
  '360p': 'scale=-2:360',
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

function safeKill(proc: ChildProcess): void {
  if (proc.killed) return
  proc.kill('SIGTERM')
  const timer = setTimeout(() => {
    if (!proc.killed) proc.kill('SIGKILL')
  }, 1500)
  if (timer.unref) timer.unref()
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
  vlcDir?: string | null
) {
  if (currentProcess && currentStreamUrl === streamUrl && !currentProcess.killed) {
    res.writeHead(200, {
      'Content-Type': 'video/x-flv',
      'Cache-Control': 'no-cache, no-store',
      'Pragma': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    })
    res.end()
    return
  }

  if (currentProcess) {
    const oldProc = currentProcess
    currentProcess = null
    safeKill(oldProc)
  }

  currentStreamUrl = streamUrl
  const ffmpegPath = findFfmpeg(vlcDir)

  const useScale = currentScale && SCALE_MAP[currentScale]
  const args = [
    // --- faster stream open ---
    '-fflags', 'nobuffer+discardcorrupt',
    '-flags', 'low_delay',
    // Reduced from 5 000 000 → 500 000 µs (0.5 s) — cuts channel-switch delay by ~4 s
    '-analyzeduration', '500000',
    '-probesize', '500000',
    '-i', streamUrl,
    ...(useScale
      ? ['-vf', useScale, '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '28', '-c:a', 'aac']
      : ['-c', 'copy']),
    '-f', 'flv',
    '-flvflags', 'no_duration_filesize',
    '-loglevel', 'warning',
    'pipe:1',
  ]

  console.log('[stream-proxy] ffmpeg', ffmpegPath, args.slice(0, 3).join(' '), '...', args.slice(-1))

  const proc = spawn(ffmpegPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  currentProcess = proc

  res.writeHead(200, {
    'Content-Type': 'video/x-flv',
    'Cache-Control': 'no-cache, no-store',
    'Pragma': 'no-cache',
    'Access-Control-Allow-Origin': '*',
  })

  proc.stdout?.pipe(res)

  proc.stderr?.on('data', (data: Buffer) => {
    const text = data.toString()
    for (const line of text.split('\n')) {
      const t = line.trim()
      if (
        t &&
        (t.includes('Error') ||
          t.includes('error') ||
          t.includes('Invalid') ||
          t.includes('frame=') ||
          t.includes('Stream'))
      ) {
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

  req.on('close', () => {
    if (currentProcess === proc && !proc.killed) {
      const p = proc
      currentProcess = null
      safeKill(p)
    }
  })
}

export function needsProxy(url: string): boolean {
  return NEEDS_PROXY_RE.test(url)
}

export function getProxyUrl(
  streamUrl: string,
  vlcDir?: string | null,
  scale?: string
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
        resolve(`http://127.0.0.1:${port}/proxy/${encoded}`)
      } catch (err) {
        reject(err)
      }
    }, 200)
  })
}

export function stopProxy() {
  if (currentProcess) {
    const p = currentProcess
    currentProcess = null
    safeKill(p)
  }
  currentStreamUrl = ''
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
