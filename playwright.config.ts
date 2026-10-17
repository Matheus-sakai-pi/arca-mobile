import { defineConfig } from '@playwright/test';

const port = 8091;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL,
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 60_000,
    actionTimeout: 15_000,
  },
  projects: [
    { name: 'small-mobile', use: { viewport: { width: 320, height: 740 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: `node node_modules/expo/bin/cli start --web --host localhost --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      CI: '1',
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_SUPABASE_URL: 'https://arca-e2e.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'e2e-public-placeholder-not-a-production-key',
      EXPO_PUBLIC_AUTH_REDIRECT_URL: `${baseURL}/auth/callback`,
    },
  },
});
