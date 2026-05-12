import { expect, test } from '@playwright/test';

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

  test('locks in an efficient commuter setup and consumes the free forge end to end', async ({ page }) => {
    await page.goto('/');

    const hubDrive = page.getByRole('button', { name: /hub drive silent operator/i });
    const microMotor = page.getByRole('button', { name: /micro 500x2 lightweight compact/i });
    const vaporWheels = page.getByRole('button', { name: /vapor wheels smooth and floaty/i });

    await hubDrive.click();
    await microMotor.click();
    await vaporWheels.click();

    await expect(hubDrive).toHaveAttribute('aria-pressed', 'true');
    await expect(microMotor).toHaveAttribute('aria-pressed', 'true');
    await expect(vaporWheels).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: /lock in board configuration/i }).click();
    await expect(page.getByText(/locked in/i)).toBeVisible();

    await expect(page.getByTestId('forge-button')).toContainText(/1 free card/i);
    await page.getByTestId('forge-button').click();
    await page.getByRole('button', { name: /let's go/i }).click();

    await expect(page.getByTestId('forge-button')).toContainText(/ready in/i);
    await expect(page.getByRole('button', { name: /download jpg/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /save to collection/i })).toBeVisible();
  });
});
