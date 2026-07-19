import { describe, it, expect } from 'vitest'
import { parseXmltv } from '../epgParser'

describe('parseXmltv', () => {
  it('parses a basic EPG entry', async () => {
    const xml = `<?xml version="1.0"?>
<tv>
  <programme start="20240101000000 +0800" stop="20240101010000 +0800" channel="bbc">
    <title lang="en">BBC News</title>
    <desc lang="en">Latest news</desc>
    <category lang="en">News</category>
  </programme>
</tv>`
    const programs = await parseXmltv(xml)
    expect(programs).toHaveLength(1)
    expect(programs[0].channelTvgId).toBe('bbc')
    expect(programs[0].title).toBe('BBC News')
    expect(programs[0].description).toBe('Latest news')
    expect(programs[0].category).toBe('News')
  })

  it('handles empty EPG', async () => {
    const xml = '<?xml version="1.0"?><tv></tv>'
    const programs = await parseXmltv(xml)
    expect(programs).toHaveLength(0)
  })

  it('handles malformed XML gracefully', async () => {
    const xml = 'this is not xml'
    const programs = await parseXmltv(xml)
    expect(programs).toHaveLength(0)
  })

  it('extracts icon when present', async () => {
    const xml = `<?xml version="1.0"?>
<tv>
  <programme start="20240101000000 +0800" stop="20240101010000 +0800" channel="bbc">
    <title>BBC News</title>
    <icon src="http://example.com/icon.png" />
  </programme>
</tv>`
    const programs = await parseXmltv(xml)
    expect(programs[0].icon).toBe('http://example.com/icon.png')
  })

  it('parses multiple programmes', async () => {
    const xml = `<?xml version="1.0"?>
<tv>
  <programme start="20240101000000 +0800" stop="20240101010000 +0800" channel="ch1">
    <title>Show 1</title>
  </programme>
  <programme start="20240101010000 +0800" stop="20240101020000 +0800" channel="ch1">
    <title>Show 2</title>
  </programme>
  <programme start="20240101000000 +0800" stop="20240101010000 +0800" channel="ch2">
    <title>Other Show</title>
  </programme>
</tv>`
    const programs = await parseXmltv(xml)
    expect(programs).toHaveLength(3)
  })

  it('defaults missing title to unknown', async () => {
    const xml = `<?xml version="1.0"?>
<tv>
  <programme start="20240101000000 +0800" stop="20240101010000 +0800" channel="ch1">
  </programme>
</tv>`
    const programs = await parseXmltv(xml)
    expect(programs[0].title).toBeTruthy()
  })
})
