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

function findFfmpeg(vlcDir?: string | null): string {
  if (vlcDir) {
    for (const name of ['ffmpeg.exe', 'ffmpeg']) {
      const p = join(vlcDir, name)
      if (existsSync(p)) return p
    }
  }
  return 'ffmpeg'
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

function handleProxyRequest(streamUrl: string, req: IncomingMessage, res: ServerResponse, vlcDir?: string | null) {
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
    currentProcess.kill('SIGTERM')
    setTimeout(() => {
      if (currentProcess && !currentProcess.killed) currentProcess.kill('SIGKILL')
    }, 2000)
    currentProcess = null
  }

  currentStreamUrl = streamUrl
  const ffmpegPath = findFfmpeg(vlcDir)

  const useScale = currentScale && SCALE_MAP[currentScale]
  const args = [
    '-i', streamUrl,
    ...(useScale ? ['-vf', useScale, '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-c:a', 'aac'] : ['-c', 'copy']),
    '-f', 'flv',
    '-flvflags', 'no_duration_filesize',
    '-fflags', 'nobuffer',
    '-flags', 'low_delay',
    '-analyzeduration', '5000000',
    '-probesize', '5000000',
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
      if (t && (t.includes('Error') || t.includes('error') || t.includes('Invalid') || t.includes('frame=') || t.includes('Stream'))) {
        console.debug('[ffmpeg]', t)
      }
    }
  })

  proc.on('close', (code) => {
    console.log('[stream-proxy] ffmpeg exited, code:', code)
    currentProcess = null
    if (!res.writableEnded) res.end()
  })

  proc.on('error', (err) => {
    console.error('[stream-proxy] ffmpeg error:', err.message)
    currentProcess = null
    if (!res.writableEnded) res.end()
  })

  req.on('close', () => {
    if (currentProcess && !currentProcess.killed) {
      currentProcess.kill('SIGTERM')
      setTimeout(() => {
        if (currentProcess && !currentProcess.killed) currentProcess.kill('SIGKILL')
      }, 2000)
      currentProcess = null
    }
  })
}

export function needsProxy(url: string): boolean {
  return NEEDS_PROXY_RE.test(url)
}

export async function getProxyUrl(streamUrl: string, vlcDir?: string | null, scale?: string): Promise<string> {
  currentScale = scale && SCALE_MAP[scale] ? scale : null
  const port = await ensureServer(vlcDir)
  const encoded = Buffer.from(streamUrl).toString('base64url')
  return `http://127.0.0.1:${port}/proxy/${encoded}`
}

export function stopProxy() {
  if (currentProcess) {
    currentProcess.kill('SIGTERM')
    setTimeout(() => {
      if (currentProcess && !currentProcess.killed) currentProcess.kill('SIGKILL')
    }, 2000)
    currentProcess = null
  }
  currentStreamUrl = ''
}

export function destroyProxy() {
  stopProxy()
  if (httpServer) {
    httpServer.close()
    httpServer = null
    serverPort = 0
  }
}
