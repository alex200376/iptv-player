import { t } from './i18n'

export interface EpgProgram {
  channelTvgId: string
  start: Date
  stop: Date
  title: string
  description?: string
  category?: string
  icon?: string
}

function parseXmltvTime(timeStr: string): Date {
  const match = timeStr.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s/)
  if (!match) return new Date(timeStr)
  const [, y, m, d, h, min, s] = match
  return new Date(Number(y), Number(m) - 1, Number(d), Number(h), Number(min), Number(s))
}

/**
 * Parse XMLTV content in chunks to avoid blocking the main-process event loop.
 * Large EPG files (>10 MB) can contain tens of thousands of <programme> nodes;
 * without yielding, IPC calls freeze for several seconds.
 */
export function parseXmltv(xml: string): Promise<EpgProgram[]> {
  return new Promise((resolve) => {
    const programs: EpgProgram[] = []
    const programmeRegex = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/gi
    const CHUNK = 200

    function processChunk() {
      let count = 0
      let progMatch: RegExpExecArray | null

      while (count < CHUNK && (progMatch = programmeRegex.exec(xml)) !== null) {
        count++
        const attrs = progMatch[1]
        const body = progMatch[2]

        const channelMatch = attrs.match(/channel="([^"]*)"/)
        const startMatch = attrs.match(/start="([^"]*)"/)
        const stopMatch = attrs.match(/stop="([^"]*)"/)
        if (!channelMatch || !startMatch) continue

        const title = extractTag(body, 'title')
        const desc = extractTag(body, 'desc')
        const category = extractTag(body, 'category')
        const iconMatch = body.match(/<icon\s+src="([^"]*)"/)

        programs.push({
          channelTvgId: channelMatch[1],
          start: parseXmltvTime(startMatch[1]),
          stop: stopMatch ? parseXmltvTime(stopMatch[1]) : new Date(Date.now() + 86400000),
          title: title || t('epg.unknownTitle'),
          description: desc,
          category,
          icon: iconMatch?.[1],
        })
      }

      if (programmeRegex.lastIndex > 0) {
        setImmediate(processChunk)
      } else {
        resolve(programs)
      }
    }

    processChunk()
  })
}

function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : undefined
}
