import { expect, test } from '@playwright/test';

test.describe('Progressive web app shell', () => {
  test('publishes a standalone manifest and registers its service worker', async ({ page }) => {
    await page.goto('/');

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toBeTruthy();

    const manifest = await page.evaluate(async (href) => {
      const response = await fetch(new URL(href, window.location.href));
      return response.json();
    }, manifestHref);

    expect(manifest.display).toBe('standalone');
    expect(manifest.categories).toContain('games');
    expect(manifest.shortcuts).toEqual(expect.arrayContaining([
      expect.objectContaining({ url: '/forge' }),
      expect.objectContaining({ url: '/collection' }),
      expect.objectContaining({ url: '/arena' }),
    ]));

    const registration = await page.evaluate(async () => {
      const ready = await navigator.serviceWorker.ready;
      return { active: ready.active?.scriptURL, scope: ready.scope };
    });
    expect(registration.active).toContain('/sw.js');
    expect(registration.scope).toContain('/');
  });

  test('offers the browser install flow when the platform supports it', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.nav-title')).toBeVisible();

    await page.evaluate(() => {
      const promptEvent = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
      };
      promptEvent.prompt = async () => {
        document.documentElement.dataset.installPromptOpened = 'true';
      };
      promptEvent.userChoice = Promise.resolve({ outcome: 'dismissed', platform: 'web' });
      window.dispatchEvent(promptEvent);
    });

    await expect(page.getByTestId('app-install-prompt')).toBeVisible();
    await page.getByRole('button', { name: 'Install app' }).click();
    await expect.poll(() => page.locator('html').getAttribute('data-install-prompt-opened')).toBe('true');
    await expect(page.getByTestId('app-install-prompt')).toBeHidden();
  });

  test('lets players choose when a ready update is activated', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.nav-title')).toBeVisible();

    await page.evaluate(() => {
      const registration = {
        waiting: {
          postMessage: (message: unknown) => {
            document.documentElement.dataset.updateMessage = JSON.stringify(message);
          },
        },
      };
      window.dispatchEvent(new CustomEvent('punch-skater:service-worker-update-ready', {
        detail: registration,
      }));
    });

    await expect(page.getByTestId('app-update-prompt')).toBeVisible();
    await page.getByRole('button', { name: 'Refresh now' }).click();
    await expect.poll(() => page.locator('html').getAttribute('data-update-message')).toBe('{"type":"punch-skater:skip-waiting"}');
  });

  test('loads the cached app shell while offline after installation', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);
    try {
      await page.reload();
      await expect(page.locator('.nav-title')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });
});
