import { defineConfig } from '@playwright/test'

// Runs against the built single file, opened from disk, the way it will be used.
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  // Serial, so the CPU-heavy page sweep cannot slow the timing-sensitive tests.
  workers: 1,
  reporter: 'line',
  use: { channel: 'chrome', headless: true, viewport: { width: 1440, height: 900 } },
})
