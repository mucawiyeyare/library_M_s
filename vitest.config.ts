import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
export default defineConfig({
  test: {
    include: ['server/tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 120000,
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      MAIL_TRANSPORT: 'preview',
      JWT_SECRET: 'test-only-secret-that-is-at-least-32-characters',
      MONGOMS_DOWNLOAD_DIR: resolve('.cache/mongodb-binaries'),
    },
  },
})
