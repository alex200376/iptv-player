import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))
const deps = Object.keys(pkg.dependencies || {})
const asarPath = resolve(root, 'release/win-unpacked/resources/app.asar')

let entries
try {
  const raw = execSync(`npx asar list "${asarPath}"`, { encoding: 'utf-8', cwd: root })
  entries = raw.trim().split('\n')
} catch (e) {
  console.error(`Cannot read ${asarPath}`)
  console.error(e.message)
  process.exit(1)
}

// Normalize path separators (asar uses \ on Windows, / on Unix)
const normalized = entries.map((e) => e.replace(/\\/g, '/').replace(/^\//, ''))

const missing = deps.filter((dep) => {
  const prefix = `node_modules/${dep}/`
  return !normalized.some((e) => e.startsWith(prefix) || e === `node_modules/${dep}`)
})

if (missing.length > 0) {
  console.error(`❌ ${missing.length} dependencies missing from app.asar:`)
  missing.forEach((m) => console.error(`   - ${m}`))
  process.exit(1)
} else {
  console.log(`✅ All ${deps.length} production dependencies found in app.asar`)
}
