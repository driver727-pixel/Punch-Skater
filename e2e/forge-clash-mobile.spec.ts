import { expect, test } from '@playwright/test';
import {
  createSampleCard,
  createUniqueEmail,
  liveFirebaseEnabled,
  seedGuestCards,
  signUp,
} from './live-auth.helpers';

test.describe('Forge Clash mobile hand', () => {
  test.skip(!liveFirebaseEnabled, 'Requires live Firebase test configuration.');
  test.use({ viewport: { width: 393, height: 851 } });

  test('keeps the selected-card fan visible and points to the next action', async ({ page }) => {
    const cards = Array.from(
      { length: 6 },
      (_, index) => createSampleCard(`clash-card-${index}`, `Clash Runner ${index + 1}`),
    );

    await seedGuestCards(page, cards);
    await signUp(page, createUniqueEmail('forge-clash-mobile'));
    await page.goto('/arena/forge-clash');

    await expect(page.getByRole('heading', { name: /forge clash/i })).toBeVisible();
    const progressBars = page.getByRole('progressbar');
    await expect(progressBars).toHaveCount(2);
    const progressBarTops = await progressBars.evaluateAll((nodes) => (
      nodes.map((node) => Math.round(node.getBoundingClientRect().top))
    ));
    expect(Math.abs(progressBarTops[0] - progressBarTops[1])).toBeLessThanOrEqual(2);

    const draftCards = page.locator('.forge-clash-draft-card');
    await expect(draftCards).toHaveCount(6);
    for (let index = 0; index < 6; index += 1) {
      await draftCards.nth(index).click();
    }

    await expect(page.locator('.forge-clash-turn-prompt')).toHaveText(/crew locked.*start the clash/i);
    const handCards = page.locator('.forge-clash-hand .forge-clash-card');
    await expect(handCards).toHaveCount(6);
    const cardsFitViewport = await handCards.evaluateAll((nodes) => nodes.every((node) => {
      const bounds = node.getBoundingClientRect();
      return bounds.left >= 0 && bounds.right <= window.innerWidth;
    }));
    expect(cardsFitViewport).toBe(true);

    await page.getByRole('button', { name: /start clash/i }).click();
    await expect(page.locator('.forge-clash-turn-prompt')).toHaveText(/choose a ready card/i);
    await expect(page.locator('.forge-clash-hand')).toHaveClass(/is-actionable/);
    await expect(page.locator('.forge-clash-coach')).toContainText(/read the signal/i);

    await handCards.nth(2).click();
    await expect(page.getByRole('heading', { name: /choose a tactic/i })).toBeVisible();
    await page.locator('.forge-clash-tactic').filter({ hasText: /^Charge/ }).click();
    await page.getByRole('button', { name: /lock tactic/i }).click();
    await expect(page.locator('.forge-clash-last-result')).toContainText(/turn 1 result/i);
    await expect(page.locator('.forge-clash-last-result')).toContainText(/clash runner 3/i);
  });
});
