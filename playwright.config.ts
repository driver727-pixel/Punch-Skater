import { defineConfig, devices } from '@playwright/test';

const visualSpec = /app-shell\.visual\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: visualSpec,
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      testIgnore: visualSpec,
    },
    {
      name: 'visual-desktop-chrome',
      testMatch: visualSpec,
      use: {
        browserName: 'chromium',
        colorScheme: 'dark',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'visual-desktop-edge',
      testMatch: visualSpec,
      use: {
        browserName: 'chromium',
        colorScheme: 'dark',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'visual-desktop-firefox',
      testMatch: visualSpec,
      use: {
        browserName: 'firefox',
        colorScheme: 'dark',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'visual-ios-safari',
      testMatch: visualSpec,
      use: {
        browserName: 'webkit',
        colorScheme: 'dark',
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'visual-android-chrome',
      testMatch: visualSpec,
      use: {
        browserName: 'chromium',
        colorScheme: 'dark',
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Mobile Safari/537.36',
        viewport: { width: 412, height: 915 },
      },
    },
    {
      name: 'visual-tablet-safari',
      testMatch: visualSpec,
      use: {
        browserName: 'webkit',
        colorScheme: 'dark',
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 834, height: 1112 },
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
