import { expect, test, type Locator } from '@playwright/test';
import { calculateBoardStats, type BoardConfig } from '../src/lib/boardBuilder';

const efficientBoardConfig: BoardConfig = {
  boardType: 'Street',
  drivetrain: 'Hub',
  driveOrientation: 'Rear-Wheel Drive',
  motor: 'Micro',
  wheels: 'Cloud',
  battery: 'SlimStealth',
};

const efficientBoardLoadout = calculateBoardStats(efficientBoardConfig);

async function expectStatValue(panel: Locator, label: string, value: number) {
  const statBar = panel.locator('.skate-stat-bar').filter({
    has: panel.locator('.skate-stat-label', { hasText: new RegExp(`^${label}$`) }),
  }).first();

  await expect(statBar.locator('.skate-stat-value')).toHaveText(String(value));
}

test.describe('Card Forge efficiency flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('forge-welcome-dismissed', '1');
    });
  });

  test('forges an efficient commuter setup and shows the expected board summary', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('skpd_tier');
      localStorage.removeItem('ps_gen_credits');
      localStorage.removeItem('skpd_free_card_used');
    });
    await page.reload();

    await page.getByRole('button', { name: /hub drive silent operator/i }).click();
    await page.getByRole('button', { name: /micro 500x2 lightweight compact/i }).click();
    await page.getByRole('button', { name: /vapor wheels smooth and floaty/i }).click();

    await page.getByTestId('forge-button').click();

    await expect(page.getByRole('button', { name: /save to collection/i })).toBeVisible();

    const boardPanel = page.locator('.card-full--back .card-board').first();
    const statsPanel = boardPanel.locator('.skate-stats-panel');

    await expect(boardPanel).toContainText('Street');
    await expect(boardPanel).toContainText('Hub Drive');
    await expect(boardPanel).toContainText('Micro 500x2');
    await expect(boardPanel).toContainText('Vapor Wheels');
    await expect(boardPanel).toContainText('Slim Stealth Pack');

    await expect(statsPanel.locator('.skate-text-row').nth(0)).toContainText(efficientBoardLoadout.accessProfile);
    await expect(statsPanel.locator('.skate-text-row').nth(1)).toContainText(efficientBoardLoadout.style);
    await expectStatValue(statsPanel, 'Speed', efficientBoardLoadout.speed);
    await expectStatValue(statsPanel, 'Accel', efficientBoardLoadout.acceleration);
    await expectStatValue(statsPanel, 'Range', efficientBoardLoadout.range);
  });
});
