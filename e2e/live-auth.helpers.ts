import { expect, type Page } from '@playwright/test';

const PASSWORD = 'PunchSkater!23';
const CHECKOUT_SESSION_KEY = 'skpd_checkout_session_id';
const EMAIL_KEY = 'skpd_email';
const COLLECTION_KEY = 'skpd_collection';

export const liveFirebaseEnabled = Boolean(
  process.env.VITE_FIREBASE_API_KEY &&
  process.env.VITE_FIREBASE_PROJECT_ID &&
  process.env.VITE_FIREBASE_APP_ID,
);

export function createUniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export function getPassword() {
  return PASSWORD;
}

function createCard(id: string, name: string) {
  return {
    id,
    version: '1.0.0',
    seed: `${id}::bg::char`,
    frameSeed: `frame-${id}`,
    backgroundSeed: `bg-${id}`,
    characterSeed: `char-${id}`,
    prompts: {
      archetype: 'The Team',
      rarity: 'Punch Skater',
      style: 'Street',
      district: 'Nightshade',
      accentColor: '#00ff88',
      gender: 'Non-binary',
      ageGroup: 'Adult',
      bodyType: 'Athletic',
      hairLength: 'Short',
      hairColor: 'Black',
      skinTone: 'Medium',
      faceCharacter: 'Conventional',
      shoeStyle: 'Skate Shoes',
    },
    identity: {
      name,
      crew: 'Punch Skaters',
      serialNumber: `SN-${id}`,
      age: '24',
    },
    stats: {
      speed: 8,
      stealth: 6,
      tech: 7,
      grit: 5,
      rep: 4,
    },
    traits: {
      passiveTrait: { name: 'Slipstream', description: 'Keeps momentum through the district grid.' },
      activeAbility: { name: 'Rail Hop', description: 'Boosts speed on the opening clash.' },
      personalityTags: ['Bold', 'Focused'],
    },
    visuals: {
      helmetStyle: 'standard-helm',
      boardStyle: 'street-deck',
      jacketStyle: 'street-jacket',
      colorScheme: 'Neon Night',
      accentColor: '#00ff88',
      storagePackStyle: 'compact-pack',
    },
    flavorText: 'Nightshade courier running the blackout lanes.',
    tags: ['test-card'],
    createdAt: new Date().toISOString(),
  };
}

export function createSampleCard(id: string, name: string) {
  return createCard(id, name);
}

export async function seedGuestCards(page: Page, cards: Array<ReturnType<typeof createCard>>) {
  await page.goto('/');
  await page.evaluate(([collectionKey, seededCards]) => {
    localStorage.setItem(collectionKey, JSON.stringify(seededCards));
  }, [COLLECTION_KEY, cards] as const);
}

export async function signUp(page: Page, email: string) {
  await page.goto('/login');
  await page.locator('.login-tabs').getByRole('button', { name: /create account/i }).click();
  await page.getByPlaceholder(/your@email.com/i).fill(email);
  await page.getByPlaceholder(/^password$/i).fill(PASSWORD);
  await page.getByPlaceholder(/repeat password/i).fill(PASSWORD);
  await page.locator('.login-form').getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL('/');
}

export async function unlockTier(page: Page, email: string, tier: 'tier2' | 'tier3' = 'tier3') {
  await page.route('**/api/verify-checkout-session**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ tier, email }),
    });
  });

  await page.evaluate(([emailKey, checkoutKey, userEmail]) => {
    localStorage.setItem(emailKey, userEmail);
    localStorage.setItem(checkoutKey, `cs_test_${Date.now()}`);
  }, [EMAIL_KEY, CHECKOUT_SESSION_KEY, email] as const);

  await page.reload();
}

export async function importCardsIfPrompt(page: Page) {
  await page.goto('/collection');
  const importButton = page.getByRole('button', { name: /import cards/i });
  if (await importButton.isVisible().catch(() => false)) {
    await importButton.click();
  }
}

export async function createDeckFromCard(page: Page, deckName: string, cardName: string) {
  await page.goto('/decks');
  await page.getByPlaceholder(/new deck name/i).fill(deckName);
  await page.getByRole('button', { name: /\+ new deck/i }).click();
  await expect(page.getByRole('heading', { name: deckName })).toBeVisible();
  const cardTile = page.locator('.card-thumb.card-thumb--add', { hasText: cardName });
  await cardTile.getByRole('button', { name: /^add$/i }).click();
  await expect(page.locator('.deck-slot-card', { hasText: cardName })).toBeVisible();
}

export async function readyDeck(page: Page, deckName: string) {
  await page.goto('/arena');
  await expect(page.getByRole('heading', { name: /battle arena/i })).toBeVisible();
  await page.getByRole('button', { name: /ready for battle/i }).click();
  await expect(page.getByText(`${deckName} is ready for battle!`)).toBeVisible();
}
