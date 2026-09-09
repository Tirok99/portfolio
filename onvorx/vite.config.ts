/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'
import { adminApiDev } from './vite-plugins/admin-api-dev'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), adminApiDev()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Playwright specs live in ./e2e and are run via `npm run e2e`, not Vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
