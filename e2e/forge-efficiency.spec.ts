import { expect, test } from '@playwright/test';

const BOARD_SETUP_SELECTORS = {
  hubDrive: /hub drive silent operator/i,
  microMotor: /micro 500x2 lightweight compact/i,
  vaporWheels: /vapor wheels smooth and floaty/i,
  lockIn: /lock in board configuration/i,
  lockedIn: /locked in/i,
  confirmForge: /let's go/i,
} as const;

test.describe('Card Forge efficiency flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('forge-welcome-dismissed', '1');
      localStorage.removeItem('skpd_tier');
      localStorage.removeItem('ps_gen_credits');
      localStorage.removeItem('skpd_free_card_used');
      localStorage.removeItem('skpd_free_forge_ready_at');
      sessionStorage.clear();
    });
  });

  test('completes free forge flow with a locked efficient setup', async ({ page }) => {
    await page.goto('/');

    const hubDrive = page.getByRole('button', { name: BOARD_SETUP_SELECTORS.hubDrive }).first();
    const microMotor = page.getByRole('button', { name: BOARD_SETUP_SELECTORS.microMotor }).first();
    const vaporWheels = page.getByRole('button', { name: BOARD_SETUP_SELECTORS.vaporWheels }).first();

    await hubDrive.click();
    await microMotor.click();
    await vaporWheels.click();

    await expect(hubDrive).toHaveAttribute('aria-pressed', 'true');
    await expect(microMotor).toHaveAttribute('aria-pressed', 'true');
    await expect(vaporWheels).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: BOARD_SETUP_SELECTORS.lockIn }).click();
    await expect(page.getByText(BOARD_SETUP_SELECTORS.lockedIn)).toBeVisible();

    await expect(page.getByTestId('forge-button')).toContainText(/1 free card/i);
    await page.getByTestId('forge-button').click();
    await page.getByRole('button', { name: BOARD_SETUP_SELECTORS.confirmForge }).click();

    await expect.poll(async () => page.evaluate(() => localStorage.getItem('skpd_free_card_used'))).toBe('1');
    await expect.poll(async () => page.evaluate(() => {
      const value = Number(localStorage.getItem('skpd_free_forge_ready_at'));
      return Number.isFinite(value) && value > Date.now() - 1_000;
    })).toBe(true);
    await expect(page.getByTestId('forge-button')).toContainText(/ready in/i);
    await expect(page.getByRole('button', { name: /download jpg/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save to collection/i })).toBeVisible();
  });
});
