import { expect, test } from '@playwright/test';

test.use({ colorScheme: 'dark', reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('forge-welcome-dismissed', '1');
    localStorage.setItem('punch-skater-install-prompt-dismissed-at', String(Date.now()));
    sessionStorage.setItem('current-objective-popup-shown', '1');
    try {
      Object.defineProperty(navigator.serviceWorker, 'register', {
        configurable: true,
        value: () => new Promise(() => {}),
      });
    } catch {
      // The PWA lifecycle is verified separately; visual snapshots need a stable shell.
    }
  });
});

test('keeps the installed-app shell visually stable', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.nav-title')).toBeVisible();
  await expect(page).toHaveScreenshot('home-shell.png', {
    animations: 'disabled',
  });
});
