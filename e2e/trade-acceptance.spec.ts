import { expect, test } from '@playwright/test';
import {
  createSampleCard,
  createUniqueEmail,
  importCardsIfPrompt,
  liveFirebaseEnabled,
  seedGuestCards,
  signUp,
  unlockTier,
} from './live-auth.helpers';

test.describe('Trade acceptance flow', () => {
  test.skip(!liveFirebaseEnabled, 'Requires live Firebase test configuration.');

  test('sender can offer a card and the recipient can accept it', async ({ browser }) => {
    const senderContext = await browser.newContext();
    const recipientContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    const recipientPage = await recipientContext.newPage();

    const senderEmail = createUniqueEmail('trade-sender');
    const recipientEmail = createUniqueEmail('trade-recipient');
    const tradedCard = createSampleCard('trade-card-alpha', 'Trade Runner Alpha');

    await seedGuestCards(senderPage, [tradedCard]);
    await signUp(senderPage, senderEmail);
    await unlockTier(senderPage, senderEmail, 'tier3');
    await importCardsIfPrompt(senderPage);

    await signUp(recipientPage, recipientEmail);
    await unlockTier(recipientPage, recipientEmail, 'tier3');
    await recipientPage.goto('/trades');
    await expect(recipientPage.getByRole('heading', { name: /^trades$/i })).toBeVisible();

    await senderPage.goto('/trades');
    await senderPage.getByRole('button', { name: /\+ new card offer/i }).click();
    await senderPage.getByPlaceholder(/their@email.com/i).fill(recipientEmail);
    await senderPage.getByRole('button', { name: /send card offer/i }).click();
    await expect(senderPage.getByRole('heading', { name: /offer sent/i })).toBeVisible();

    await recipientPage.goto('/trades');
    await expect(recipientPage.locator('.trade-item', { hasText: 'Trade Runner Alpha' })).toBeVisible();
    await recipientPage.getByRole('button', { name: /accept/i }).click();
    await expect(recipientPage.getByText(/no pending incoming offers/i)).toBeVisible();

    await recipientPage.goto('/collection');
    await expect(recipientPage.getByText('Trade Runner Alpha')).toBeVisible();

    await senderContext.close();
    await recipientContext.close();
  });
});
