// Renders routes of the built single-file site to PNGs for visual review.
// usage: node scripts/shots.mjs <outDir> <route[@width x height][!full]> ...
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const [outDir, ...routes] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const file = `file://${resolve('dist/index.html')}`
const unlock = process.env.UNLOCK !== '0'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []
for (const spec of routes) {
  const full = spec.endsWith('!full')
  const [route, size] = spec.replace('!full', '').split('@')
  const [w, h] = (size ?? '1440x900').split('x').map(Number)
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  if (unlock) {
    await ctx.addInitScript(() => {
      const units = {}
      for (let i = 1; i <= 20; i++) units[`u${String(i).padStart(2, '0')}`] = { leaves: [], best: 0.9, passed: i < 20, attempts: 1 }
      localStorage.setItem('active-acoustics-academy-v1', JSON.stringify({ state: { units }, version: 1 }))
    })
  }
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`${route}: ${e.message}`))
  page.on('console', (m) => m.type() === 'error' && errors.push(`${route}: console ${m.text()}`))
  await page.goto(`${file}#${route}`)
  await page.waitForTimeout(Number(process.env.WAIT ?? 2200))
  const name = route.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home'
  await page.screenshot({ path: `${outDir}/${name}.png`, fullPage: full })
  await ctx.close()
}
await browser.close()
if (errors.length) {
  console.log('PAGE ERRORS:\n' + errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`ok: ${routes.length} shots in ${outDir}`)
}
