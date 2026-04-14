import { expect, test } from '@playwright/test';
import {
  createDeckFromCard,
  createSampleCard,
  createUniqueEmail,
  importCardsIfPrompt,
  liveFirebaseEnabled,
  readyDeck,
  seedGuestCards,
  signUp,
  unlockTier,
} from './live-auth.helpers';

function getUidFromBearerToken(authorizationHeader: string | undefined) {
  const token = authorizationHeader?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Firebase bearer token.');
  const [, payload] = token.split('.');
  const normalizedPayload = payload
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(payload.length / 4) * 4, '=');
  const decoded = JSON.parse(atob(normalizedPayload)) as { user_id?: string };
  if (!decoded.user_id) throw new Error('Firebase token did not include user_id.');
  return decoded.user_id;
}

test.describe('Battle flow', () => {
  test.skip(!liveFirebaseEnabled, 'Requires live Firebase test configuration.');

  test('a readied deck can challenge an opponent and show the battle outcome', async ({ browser }) => {
    const challengerContext = await browser.newContext();
    const defenderContext = await browser.newContext();
    const challengerPage = await challengerContext.newPage();
    const defenderPage = await defenderContext.newPage();

    const challengerEmail = createUniqueEmail('arena-challenger');
    const defenderEmail = createUniqueEmail('arena-defender');
    const challengerCard = createSampleCard('battle-card-alpha', 'Arena Runner Alpha');
    const defenderCard = createSampleCard('battle-card-beta', 'Arena Runner Beta');

    await seedGuestCards(challengerPage, [challengerCard]);
    await signUp(challengerPage, challengerEmail);
    await unlockTier(challengerPage, challengerEmail, 'tier3');
    await importCardsIfPrompt(challengerPage);
    await createDeckFromCard(challengerPage, 'Challenge Deck', challengerCard.identity.name);
    await readyDeck(challengerPage, 'Challenge Deck');

    await seedGuestCards(defenderPage, [defenderCard]);
    await signUp(defenderPage, defenderEmail);
    await unlockTier(defenderPage, defenderEmail, 'tier3');
    await importCardsIfPrompt(defenderPage);
    await createDeckFromCard(defenderPage, 'Defender Deck', defenderCard.identity.name);
    await readyDeck(defenderPage, 'Defender Deck');

    await challengerPage.route('**/api/resolve-battle', async (route) => {
      const authorization = route.request().headers().authorization;
      const challengerUid = getUidFromBearerToken(authorization);
      const body = route.request().postDataJSON() as {
        challengerDeckId: string;
        defenderUid: string;
        defenderDeckId: string;
      };

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: `battle-${Date.now()}`,
          challengerUid,
          challengerDeckId: body.challengerDeckId,
          challengerDeckName: 'Challenge Deck',
          defenderUid: body.defenderUid,
          defenderDeckId: body.defenderDeckId,
          defenderDeckName: 'Defender Deck',
          winnerUid: challengerUid,
          challengerScore: 27,
          defenderScore: 19,
          wagerPoints: 3,
          winningDeckCardIds: [challengerCard.id],
          challengerCardResolutions: [
            {
              id: challengerCard.id,
              stats: {
                speed: 9,
                stealth: 7,
                tech: 8,
                grit: 6,
                rep: 5,
              },
            },
          ],
          defenderCardResolutions: [
            {
              id: defenderCard.id,
              stats: {
                speed: 7,
                stealth: 5,
                tech: 6,
                grit: 4,
                rep: 3,
              },
            },
          ],
          createdAt: new Date().toISOString(),
        }),
      });
    });

    await challengerPage.goto('/arena');
    await expect(challengerPage.locator('.arena-opponent-card', { hasText: 'Defender Deck' })).toBeVisible();
    await challengerPage.locator('.arena-opponent-card', { hasText: 'Defender Deck' }).getByRole('button', { name: /challenge/i }).click();

    await expect(challengerPage.getByRole('heading', { name: /victory/i })).toBeVisible();
    await expect(challengerPage.getByText(/\+3 attribute points earned/i)).toBeVisible();
    await challengerPage.getByRole('button', { name: /continue/i }).click();
    await expect(challengerPage.getByRole('heading', { name: /victory/i })).not.toBeVisible();

    await challengerContext.close();
    await defenderContext.close();
  });
});
