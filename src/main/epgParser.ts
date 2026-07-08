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

export function parseXmltv(xml: string): EpgProgram[] {
  const programs: EpgProgram[] = []

  const programmeRegex = /<programme\s+([^>]*)>([\s\S]*?)<\/programme>/gi
  let progMatch: RegExpExecArray | null

  while ((progMatch = programmeRegex.exec(xml)) !== null) {
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
      title: title || '未知节目',
      description: desc,
      category,
      icon: iconMatch?.[1],
    })
  }

  return programs
}

function extractTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1].trim() : undefined
}
