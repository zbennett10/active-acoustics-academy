import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Builds one self-contained dist/index.html that runs from a double-click with no server or network.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 8000 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: { include: ['src/lib/**', 'src/curriculum/questions/**', 'src/curriculum/parse.ts', 'src/state/**'] },
  },
})
