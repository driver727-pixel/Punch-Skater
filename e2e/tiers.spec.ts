import { test, expect } from '@playwright/test';

async function openTierModal(page: import('@playwright/test').Page) {
  await page.goto('/');
  const desktopTierButton = page.locator('.nav-desktop-only.tier-badge-btn');
  if (await desktopTierButton.isVisible().catch(() => false)) {
    await desktopTierButton.click();
  } else {
    await page.getByRole('button', { name: /open menu/i }).click();
    await page.locator('.nav-mobile-menu .tier-badge-btn').click();
  }
  await expect(page.getByRole('heading', { name: /choose your tier/i })).toBeVisible();
}

// ── Tier Modal ────────────────────────────────────────────────────────────────

test.describe('Tier modal', () => {
  test('opens when clicking the tier badge button', async ({ page }) => {
    await openTierModal(page);
  });

  test('displays all three tier cards', async ({ page }) => {
    await openTierModal(page);
    const tierCards = page.locator('.tier-cards');
    await expect(tierCards.locator('.tier-name', { hasText: 'Free Rider' })).toBeVisible();
    await expect(tierCards.locator('.tier-name', { hasText: 'Street Creator' })).toBeVisible();
    await expect(tierCards.locator('.tier-name', { hasText: 'Deck Master' })).toBeVisible();
  });

  test('free tier card shows correct price', async ({ page }) => {
    await openTierModal(page);
    await expect(page.locator('.tier-card').filter({ hasText: 'Free Rider' }).locator('.tier-price')).toContainText(/free/i);
  });

  test('tier2 card shows $5 one-time price', async ({ page }) => {
    await openTierModal(page);
    await expect(
      page.locator('.tier-card', {
        has: page.locator('.tier-name', { hasText: 'Street Creator' }),
      }).locator('.tier-price'),
    ).toContainText('$5 one-time');
  });

  test('tier3 card shows $10 one-time price and BEST VALUE badge', async ({ page }) => {
    await openTierModal(page);
    const featuredCard = page.locator('.tier-card', {
      has: page.locator('.tier-name', { hasText: 'Deck Master' }),
    });
    await expect(featuredCard.locator('.tier-price')).toContainText('$10 one-time');
    await expect(featuredCard.getByText('BEST VALUE')).toBeVisible();
  });

  test('closes when clicking the ✕ button', async ({ page }) => {
    await openTierModal(page);
    await page.getByRole('button', { name: /✕/i }).click();
    await expect(page.getByRole('heading', { name: /choose your tier/i })).not.toBeVisible();
  });

  test('closes when clicking the modal overlay backdrop', async ({ page }) => {
    await openTierModal(page);
    await page.locator('.modal-overlay').click({ position: { x: 10, y: 10 } });
    await expect(page.getByRole('heading', { name: /choose your tier/i })).not.toBeVisible();
  });

  test('tier2 upgrade flow shows email input', async ({ page }) => {
    await openTierModal(page);
    await page.getByRole('button', { name: /upgrade.*\$5/i }).click();
    await expect(page.getByPlaceholder(/your@email\.com/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /continue to payment/i })).toBeVisible();
  });

  test('tier3 upgrade flow shows email input', async ({ page }) => {
    await openTierModal(page);
    await page.getByRole('button', { name: /upgrade.*\$10/i }).click();
    await expect(page.getByPlaceholder(/your@email\.com/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /continue to payment/i })).toBeVisible();
  });

  test('upgrade flow shows error for invalid email', async ({ page }) => {
    await openTierModal(page);
    await page.getByRole('button', { name: /upgrade.*\$5/i }).click();
    await page.getByPlaceholder(/your@email\.com/i).fill('not-an-email');
    await page.getByRole('button', { name: /continue to payment/i }).click();
    await expect(page.getByText(/valid email/i)).toBeVisible();
  });

  test('back button returns to tier list from email step', async ({ page }) => {
    await openTierModal(page);
    await page.getByRole('button', { name: /upgrade.*\$5/i }).click();
    await expect(page.getByRole('button', { name: /← back/i })).toBeVisible();
    await page.getByRole('button', { name: /← back/i }).click();
    await expect(page.locator('.tier-cards .tier-name', { hasText: 'Street Creator' })).toBeVisible();
    await expect(page.locator('.tier-cards .tier-name', { hasText: 'Deck Master' })).toBeVisible();
  });
});

// ── Forge gating — free tier ──────────────────────────────────────────────────

test.describe('Forge gating — free tier', () => {
  test('forge button shows locked label for free-tier users', async ({ page }) => {
    await page.goto('/');
    // Ensure free tier (no localStorage tier set)
    await page.evaluate(() => localStorage.removeItem('skpd_tier'));
    await page.reload();
    const forgeBtn = page.getByTestId('forge-button');
    await expect(forgeBtn).toBeVisible();
    await expect(forgeBtn).toContainText(/upgrade to unlock/i);
  });

  test('clicking locked forge button opens the upgrade modal', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('skpd_tier'));
    await page.reload();
    await page.getByTestId('forge-button').click();
    await expect(page.getByRole('heading', { name: /choose your tier/i })).toBeVisible();
  });
});

// ── Forge gating — tampered localStorage tiers ────────────────────────────────

test.describe('Forge gating — tampered localStorage tiers', () => {
  test('forge button stays locked when localStorage is forced to tier2', async ({ page }) => {
    await page.goto('/');
    // Simulate a tampered client-side tier value.
    await page.evaluate(() => localStorage.setItem('skpd_tier', 'tier2'));
    await page.reload();
    const forgeBtn = page.getByTestId('forge-button');
    await expect(forgeBtn).toBeVisible();
    await expect(forgeBtn).toContainText(/upgrade to unlock/i);
    await expect(forgeBtn).toContainText(/forge your card/i);
  });

  test('forge button stays locked when localStorage is forced to tier3', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('skpd_tier', 'tier3'));
    await page.reload();
    const forgeBtn = page.getByTestId('forge-button');
    await expect(forgeBtn).toBeVisible();
    await expect(forgeBtn).toContainText(/upgrade to unlock/i);
  });
});

// ── Forge gating — referral credits ──────────────────────────────────────────

test.describe('Forge gating — referral credits', () => {
  test('forge button shows credit count when free user has credits', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('skpd_tier');
      localStorage.setItem('ps_gen_credits', '3');
    });
    await page.reload();
    const forgeBtn = page.getByTestId('forge-button');
    await expect(forgeBtn).toContainText(/3 credit/i);
  });

  test('forge button does not open upgrade modal when credits > 0', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.removeItem('skpd_tier');
      localStorage.setItem('ps_gen_credits', '1');
    });
    await page.reload();
    await page.getByTestId('forge-button').click();
    // Upgrade modal should NOT appear
    await expect(page.getByRole('heading', { name: /choose your tier/i })).not.toBeVisible();
  });
});

// ── Referral link ─────────────────────────────────────────────────────────────

test.describe('Referral link via URL param', () => {
  test('visiting with ?ref= param does not show an error', async ({ page }) => {
    // Should load normally — referral param is silently processed
    await page.goto('/?ref=testReferrerUid123');
    await expect(page).toHaveTitle(/Punch Skater/i);
    await expect(page.locator('.page-title')).toBeVisible();
  });

  test('?ref= param is stripped from the URL after processing', async ({ page }) => {
    await page.goto('/?ref=testReferrerUid123');
    await expect(page).toHaveURL('/');
  });
});

test.describe('Stripe checkout session verification', () => {
  test('verified checkout unlocks and persists the paid tier', async ({ page }) => {
    await page.route('**/api/verify-checkout-session**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ tier: 'tier2', email: 'paid@example.com' }),
      });
    });

    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('skpd_email', 'paid@example.com'));
    await page.goto('/?checkout_session_id=cs_test_paid_session');
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('forge-button')).toContainText(/forge your card/i);
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('skpd_tier'))).toBe('tier2');
    await expect.poll(async () => page.evaluate(() => localStorage.getItem('skpd_email'))).toBe('paid@example.com');

    await page.reload();
    await expect(page.getByTestId('forge-button')).toContainText(/forge your card/i);
  });
});
