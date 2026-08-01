import { existsSync } from 'node:fs'
import { join } from 'node:path'
import * as asar from '@electron/asar'

const candidates = [
  'release/win-unpacked/resources/app.asar',
  'release/mac-arm64/IPTV Player.app/Contents/Resources/app.asar',
  'release/mac/IPTV Player.app/Contents/Resources/app.asar',
]

const found = candidates.find((rel) => existsSync(join(process.cwd(), rel)))
if (!found) {
  console.error('verify-asar: no app.asar found under release/ (expected one of:)')
  for (const rel of candidates) console.error(`  - ${rel}`)
  process.exit(1)
}

const abs = join(process.cwd(), found)
let stat
try {
  stat = asar.statFile(abs, 'package.json')
} catch (err) {
  console.error(`verify-asar: failed to read app.asar (${abs})`)
  console.error(err)
  process.exit(1)
}

console.log(`verify-asar: OK ${found} (${stat.size} bytes, package.json present)`)
