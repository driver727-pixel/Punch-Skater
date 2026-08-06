import { defineConfig, devices } from '@playwright/test';

const visualSpec = /app-shell\.visual\.spec\.ts/;
const visualBaseUrl = 'https://localhost:4174';

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
        baseURL: visualBaseUrl,
        browserName: 'chromium',
        colorScheme: 'dark',
        ignoreHTTPSErrors: true,
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'visual-desktop-edge',
      testMatch: visualSpec,
      use: {
        baseURL: visualBaseUrl,
        browserName: 'chromium',
        colorScheme: 'dark',
        ignoreHTTPSErrors: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36 Edg/123.0.0.0',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'visual-desktop-firefox',
      testMatch: visualSpec,
      use: {
        baseURL: visualBaseUrl,
        browserName: 'firefox',
        colorScheme: 'dark',
        ignoreHTTPSErrors: true,
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'visual-ios-safari',
      testMatch: visualSpec,
      use: {
        baseURL: visualBaseUrl,
        browserName: 'webkit',
        colorScheme: 'dark',
        ignoreHTTPSErrors: true,
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
        baseURL: visualBaseUrl,
        browserName: 'chromium',
        colorScheme: 'dark',
        ignoreHTTPSErrors: true,
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
        baseURL: visualBaseUrl,
        browserName: 'webkit',
        colorScheme: 'dark',
        ignoreHTTPSErrors: true,
        hasTouch: true,
        isMobile: true,
        userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        viewport: { width: 834, height: 1112 },
      },
    },
  ],
  webServer: {
    command: 'rm -rf /tmp/punch-skater-playwright && mkdir -p /tmp/punch-skater-playwright && openssl req -x509 -newkey rsa:2048 -nodes -keyout /tmp/punch-skater-playwright/key.pem -out /tmp/punch-skater-playwright/cert.pem -subj /CN=localhost -days 1 >/dev/null 2>&1 && PLAYWRIGHT_HTTPS=1 npm run build && (npm run preview -- --port 4173 & PLAYWRIGHT_HTTPS=1 npm run preview -- --port 4174 & wait)',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
