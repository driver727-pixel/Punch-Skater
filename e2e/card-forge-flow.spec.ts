import { expect, test } from '@playwright/test';

test.describe('Card Forge flow', () => {
  test('uses a referral credit to forge a card and prompts free users to upgrade for saving', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('skpd_tier');
      localStorage.setItem('ps_gen_credits', '1');
    });
    await page.reload();

    await page.getByTestId('forge-button').click();

    await expect(page.getByRole('button', { name: /3d/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /print/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save to collection/i })).toContainText(/save to collection/i);
    await expect(page.getByRole('button', { name: /download jpg/i })).toBeVisible();
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('ps_gen_credits'))).toBe('0');

    await page.getByRole('button', { name: /save to collection/i }).click();
    await expect(page.getByRole('heading', { name: /choose your tier/i })).toBeVisible();
  });
});
