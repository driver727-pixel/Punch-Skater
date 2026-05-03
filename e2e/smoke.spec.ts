import { test, expect, type Page } from '@playwright/test';
import { calculateBoardStats } from '../src/lib/boardBuilder';
import { FACTION_LORE } from '../src/lib/lore';

async function ensureNavLinksVisible(page: Page) {
  const collectionLink = page.getByRole('link', { name: /collection/i });
  if (await collectionLink.isVisible().catch(() => false)) return;

  const menuButton = page.getByRole('button', { name: /open menu|close menu/i });
  if (await menuButton.isVisible().catch(() => false)) {
    await menuButton.click();
  }
}

// ── Home / Card Forge ─────────────────────────────────────────────────────────

test.describe('Home page (Card Forge)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('forge-welcome-dismissed', '1');
    });
  });

  test('has correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Punch Skater/i);
  });

  test('shows the nav brand', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.nav-title')).toBeVisible();
    await expect(page.locator('.nav-subtitle')).toHaveText('DECK BUILDER');
  });

  test('shows the Card Forge nav link as active', async ({ page }) => {
    await page.goto('/');
    await ensureNavLinksVisible(page);
    const cardForgeLink = page.getByRole('link', { name: /card forge/i });
    await expect(cardForgeLink).toBeVisible();
    await expect(cardForgeLink).toHaveClass(/active/);
  });

  test('shows nav links for Collection and Trades', async ({ page }) => {
    await page.goto('/');
    await ensureNavLinksVisible(page);
    await expect(page.getByRole('link', { name: /collection/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /trades/i })).toBeVisible();
  });

  test('shows the welcome prompt with getting started guidance', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /welcome to punch skater, rookie/i })).toBeVisible();
    await expect(page.getByText(/5 punch skater class cards and 1 master class card/i)).toBeVisible();
    await expect(page.getByText(/battle arena/i)).toBeVisible();
  });



  test('shows the site footer with copyright', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.site-footer__copy')).toContainText('SP Digital LLC');
    await expect(page.getByRole('link', { name: /^credits$/i })).toBeVisible();
  });

  test('shows every cover identity button in the first forge section', async ({ page }) => {
    await page.goto('/');

    const coverIdentityGroup = page
      .locator('.form-group')
      .filter({ has: page.locator('label', { hasText: 'Cover Identity' }) });

    for (const label of [
      'Science Lab Technician',
      'Journalist',
      'Security Guard',
      'Chef',
      'Coder',
      'Humanitarian',
      'Archaeologist',
      'Blue collar worker',
      'Postal worker',
      'Bartender',
    ]) {
      await expect(coverIdentityGroup.getByRole('button', { name: label })).toBeVisible();
    }
  });

  test('keeps the configured board part selected and allows changing it', async ({ page }) => {
    await page.goto('/');

    const standardMotor = page.getByRole('button', { name: /standard 6354 balanced power/i });
    const torqueMotor = page.getByRole('button', { name: /torque 6374 maximum pull/i });

    await expect(standardMotor).toHaveAttribute('aria-pressed', 'true');
    await torqueMotor.click();
    await expect(torqueMotor).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('img', { name: /torque 6374/i })).toBeVisible();
  });

  test('syncs the forge overmap with district selection', async ({ page }) => {
    await page.goto('/');

    const districtGroup = page
      .locator('.form-group')
      .filter({ has: page.locator('label', { hasText: 'District' }) });
    const rideableBadge = page.locator('.geo-atlas__callout-pill').filter({ hasText: /districts rideable now/i }).first();

    await expect(rideableBadge).toHaveText(/3\/6 districts rideable now/i);

    await page.getByRole('button', { name: /solid rubber puncture proof/i }).click();
    await expect(rideableBadge).toHaveText(/5\/6 districts rideable now/i);

    await districtGroup.getByRole('button', { name: /^Glass City$/ }).click();

    await expect(districtGroup.getByRole('button', { name: /^Glass City$/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.geo-atlas__inspection-title').first()).toHaveText('Glass City');
    await expect(page.locator('.geo-atlas__callout-pill').first()).toContainText('Selected setup');
  });

  test('derives board access from rideable districts instead of legacy wheel labels', () => {
    expect(calculateBoardStats({
      boardType: 'Street',
      drivetrain: 'Belt',
      motor: 'Standard',
      wheels: 'Urethane',
      battery: 'SlimStealth',
    }).accessProfile).toBe('Airaway · The Grid · Glass City');

    expect(calculateBoardStats({
      boardType: 'Street',
      drivetrain: 'Belt',
      motor: 'Standard',
      wheels: 'Cloud',
      battery: 'SlimStealth',
    }).accessProfile).toBe('Nightshade · Batteryville · The Grid · Glass City');
  });

  test('random punch skater button randomizes character and board selections', async ({ page }) => {
    await page.goto('/');

    const randomButton = page.getByTestId('random-punch-skater-button');
    await expect(randomButton).toHaveAttribute('title', /character loadout and the board loadout/i);
    const getSelectionSnapshot = () => page.evaluate(() => (
      Array.from(document.querySelectorAll('button[aria-pressed="true"]'))
        .map((node) => {
          const visibleText = node.textContent?.trim();
          return visibleText && visibleText.length > 0
            ? visibleText
            : node.getAttribute('aria-label') ?? node.getAttribute('title');
        })
        .filter(Boolean)
    ));
    const before = JSON.stringify(await getSelectionSnapshot());

    await randomButton.click();

    await expect.poll(async () => JSON.stringify(await getSelectionSnapshot())).not.toBe(before);
  });

  test('shows and toggles the Attractive face-character option', async ({ page }) => {
    await page.goto('/');

    const faceCharacterGroup = page
      .locator('.form-group')
      .filter({ has: page.locator('label', { hasText: 'Face Character' }) });
    const attractiveButton = faceCharacterGroup.getByRole('button', { name: /^Attractive$/ });

    await expect(attractiveButton).toBeVisible();
    await attractiveButton.click();
    await expect(attractiveButton).toHaveAttribute('aria-pressed', 'true');
  });
});

// ── Login page ────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test('loads the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/Punch Skater/i);
  });

  test('shows Sign In and Create Account tabs', async ({ page }) => {
    await page.goto('/login');
    const tabs = page.locator('.login-tabs');
    await expect(tabs.getByRole('button', { name: /sign in/i })).toBeVisible();
    await expect(tabs.getByRole('button', { name: /create account/i })).toBeVisible();
  });

  test('shows email and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByPlaceholder(/your@email.com/i)).toBeVisible();
    await expect(page.getByPlaceholder(/password/i).first()).toBeVisible();
  });

  test('shows Continue with Google button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('shows Continue as guest link', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /continue as guest/i })).toBeVisible();
  });

  test('guest link navigates back to home', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: /continue as guest/i }).click();
    await expect(page).toHaveURL('/');
  });

  test('switches to Create Account mode', async ({ page }) => {
    await page.goto('/login');
    await page.locator('.login-tabs').getByRole('button', { name: /create account/i }).click();
    await expect(page.getByPlaceholder(/repeat password/i)).toBeVisible();
  });

  test('shows password validation error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('.login-tabs').getByRole('button', { name: /create account/i }).click();
    await page.getByPlaceholder(/your@email.com/i).fill('test@example.com');
    await page.getByPlaceholder(/min\. 6 characters/i).fill('abc');
    await page.getByPlaceholder(/repeat password/i).fill('abc');
    await page.locator('.login-form').getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/at least 6 characters/i)).toBeVisible();
  });
});

// ── Credits page ──────────────────────────────────────────────────────────────

test.describe('Credits page', () => {
  test('loads the credits page', async ({ page }) => {
    await page.goto('/credits');
    await expect(page).toHaveTitle(/Punch Skater/i);
  });

  test('shows Credits & Attributions heading', async ({ page }) => {
    await page.goto('/credits');
    await expect(page.getByRole('heading', { name: /credits/i })).toBeVisible();
  });

  test('shows SP Digital LLC as developed by', async ({ page }) => {
    await page.goto('/credits');
    await expect(page.locator('.credits-org')).toHaveText('SP Digital LLC');
  });

  test('shows React attribution', async ({ page }) => {
    await page.goto('/credits');
    await expect(page.getByRole('link', { name: /^react$/i })).toBeVisible();
  });

  test('shows Firebase attribution', async ({ page }) => {
    await page.goto('/credits');
    await expect(page.getByRole('link', { name: /firebase/i })).toBeVisible();
  });

  test('shows Fal.ai attribution', async ({ page }) => {
    await page.goto('/credits');
    await expect(page.getByRole('link', { name: /fal\.ai/i })).toBeVisible();
  });

  test('footer navigates to credits from home', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /^credits$/i }).click();
    await expect(page).toHaveURL('/credits');
    await expect(page.locator('.credits-org')).toHaveText('SP Digital LLC');
  });
});

// ── Factions page ──────────────────────────────────────────────────────────────

test.describe('Factions page', () => {
  test('renders faction descriptions over the image and lets the expanded card collapse from the description area', async ({ page }) => {
    const knownFaction = FACTION_LORE[0];

    await page.goto('/');
    await page.evaluate((factionName) => {
      localStorage.setItem('skpd_faction_discoveries', JSON.stringify([factionName]));
    }, knownFaction.name);
    await page.goto('/factions');

    const factionCard = page.locator('.lore-faction-item').filter({ hasText: knownFaction.name });
    const factionToggle = factionCard.locator('.lore-faction-toggle');
    const description = page.getByText(knownFaction.description);

    await expect(description).toBeHidden();

    await factionToggle.click();

    await expect(description).toBeVisible();
    await expect(factionCard.locator('.lore-faction-media').filter({ hasText: knownFaction.description })).toBeVisible();

    await description.click();

    await expect(description).toBeHidden();
  });
});

// ── Lore / Codex page ──────────────────────────────────────────────────────────

test.describe('Lore page', () => {
  test('shows the district map and arterial routes', async ({ page }) => {
    await page.goto('/lore');
    await expect(page.getByRole('heading', { name: /australia theater map/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /courier archetypes/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /recent codex revisions/i })).toBeVisible();
    await expect(page.getByText(/australian theatre dossiers consolidated/i)).toBeVisible();
    await page.getByRole('button', { name: /expand australia overmap/i }).click();
    await expect(page.getByTestId('australia-overmap')).toBeVisible();
    await expect(page.getByTestId('district-node-airaway')).toContainText(/airaway/i);
    await expect(page.getByTestId('district-node-nightshade')).toContainText(/nightshade/i);
    await expect(page.locator('.lore-grid')).not.toContainText(/electropolis/i);
    await expect(page.getByRole('list', { name: /arterial courier routes/i })).toContainText('Mag-Rail Spine');
    await expect(page.getByRole('list', { name: /arterial courier routes/i })).toContainText('The Roads → Nightshade');
  });
});

// ── Navigation & routing ──────────────────────────────────────────────────────

test.describe('Navigation & routing', () => {
  test('protected routes redirect to login', async ({ page }) => {
    await page.goto('/collection');
    await expect(page).toHaveURL(/\/login/);
  });

  test('decks redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/decks');
    await expect(page).toHaveURL(/\/login/);
  });

  test('trades redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/trades');
    await expect(page).toHaveURL(/\/login/);
  });

  test('mission redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/mission');
    await expect(page).toHaveURL(/\/login/);
  });

  test('arena redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/arena');
    await expect(page).toHaveURL(/\/login/);
  });

  test('account redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login/);
  });

  test('nav link to login works', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /sign in/i }).first().click();
    await expect(page).toHaveURL('/login');
  });
});

// ── SEO & meta ────────────────────────────────────────────────────────────────

test.describe('SEO & meta tags', () => {
  test('home page has meta description', async ({ page }) => {
    await page.goto('/');
    const metaDesc = page.locator('meta[name="description"]');
    await expect(metaDesc).toHaveAttribute('content', /cyberpunk card game/i);
  });

  test('home page has og:title', async ({ page }) => {
    await page.goto('/');
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute('content', /Punch Skater/i);
  });

  test('home page has og:description', async ({ page }) => {
    await page.goto('/');
    const ogDesc = page.locator('meta[property="og:description"]');
    await expect(ogDesc).toHaveAttribute('content', /.+/);
  });

  test('home page has canonical link', async ({ page }) => {
    await page.goto('/');
    const canonical = page.locator('link[rel="canonical"]');
    await expect(canonical).toHaveAttribute('href', 'https://punchskater.com/');
  });

  test('home page has JSON-LD structured data', async ({ page }) => {
    await page.goto('/');
    const ldJson = page.locator('script[type="application/ld+json"]');
    const content = await ldJson.textContent();
    expect(content).toContain('"WebApplication"');
    expect(content).toContain('SP Digital LLC');
  });
});
