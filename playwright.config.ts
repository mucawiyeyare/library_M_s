import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './client/tests/e2e',
  outputDir: './client/test-results',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'retain-on-failure',
    channel: process.env.PLAYWRIGHT_CHANNEL,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node server/scripts/local-dev.js --api-only',
      url: 'http://127.0.0.1:4010/api/health',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        PORT: '4010',
        NODE_ENV: 'test',
        MAIL_TRANSPORT: 'preview',
        CLIENT_ORIGIN: 'http://localhost:5174',
        DEMO_PASSWORD: 'E2E-library-admin-password-2026',
      },
    },
    {
      command: 'npm run dev --workspace client -- --port 5174',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
      timeout: 120000,
      env: { VITE_API_TARGET: 'http://127.0.0.1:4010' },
    },
  ],
})
