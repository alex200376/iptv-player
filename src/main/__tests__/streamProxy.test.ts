import { describe, it, expect } from 'vitest'
// Import the internal helper indirectly through the module
// We test the exported needsProxy which internally calls isHttpTsStream
import { needsProxy } from '../streamProxy'

describe('needsProxy', () => {
  it('returns true for rtmp:// URLs', () => {
    expect(needsProxy('rtmp://live.example.com/stream')).toBe(true)
  })

  it('returns true for rtmps:// URLs', () => {
    expect(needsProxy('rtmps://live.example.com/stream')).toBe(true)
  })

  it('returns true for rtsp:// URLs', () => {
    expect(needsProxy('rtsp://live.example.com/stream')).toBe(true)
  })

  it('returns true for udp:// URLs', () => {
    expect(needsProxy('udp://239.0.0.1:1234')).toBe(true)
  })

  it('returns true for HTTP .ts stream URLs', () => {
    expect(needsProxy('http://example.com/live.ts')).toBe(true)
    expect(needsProxy('http://example.com/channel/stream.ts?token=abc')).toBe(true)
  })

  it('returns true for Stalker portal channelId URLs', () => {
    expect(needsProxy('http://portal.example.com/play?channelId=123')).toBe(true)
  })

  it('returns false for plain HLS m3u8 URLs', () => {
    expect(needsProxy('http://example.com/playlist.m3u8')).toBe(false)
  })

  it('returns false for plain HTTP MP4 URLs', () => {
    expect(needsProxy('http://example.com/video.mp4')).toBe(false)
  })

  it('returns false for malformed URLs (no crash)', () => {
    expect(() => needsProxy('not-a-url')).not.toThrow()
    expect(needsProxy('not-a-url')).toBe(false)
  })
})
