import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  resolve: {
    alias: {
      '@': root,
      '@prodexy/ui': fileURLToPath(new URL('./tests/mocks/prodexy-ui.tsx', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/component-setup.ts'],
    include: ['tests/components/**/*.test.tsx'],
    restoreMocks: true,
  },
})
