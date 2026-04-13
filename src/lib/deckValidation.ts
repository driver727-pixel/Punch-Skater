/**
 * deckValidation.ts
 *
 * Enforces the "5:1 initiation rule" for a player's first deck:
 *
 *   PRE-INITIATION  (deck has fewer than MIN_PUNCH_SKATERS Punch Skater cards)
 *     • Only Punch Skater rarity cards may be added.
 *     • One Legendary card is permitted alongside them.
 *     • Apprentice / Master / Rare cards are blocked until initiation is met.
 *
 *   POST-INITIATION (deck has ≥ MIN_PUNCH_SKATERS Punch Skater cards)
 *     • All card types — including additional Legendaries — may be added freely.
 *
 * These rules apply **only** to the player's first deck (index 0 in the list).
 * All subsequent decks have no composition restrictions.
 */

import type { CardPayload, DeckPayload, Rarity } from "./types";

/** Minimum number of Punch Skater cards required to initiate the first deck. */
export const FIRST_DECK_MIN_PUNCH_SKATERS = 5;

/** Maximum Legendary cards allowed while the first deck is still pre-initiation. */
export const FIRST_DECK_MAX_LEGENDARY_BEFORE_INIT = 1;

/** Returns true when the given deck is the player's first deck. */
export function isFirstDeck(deck: DeckPayload, allDecks: DeckPayload[]): boolean {
  return allDecks.length > 0 && allDecks[0].id === deck.id;
}

/** Returns the number of Punch Skater rarity cards in a card list. */
export function countPunchSkaters(cards: CardPayload[]): number {
  return cards.filter((c) => c.prompts.rarity === "Punch Skater").length;
}

/** Returns the number of Legendary rarity cards in a card list. */
export function countLegendaries(cards: CardPayload[]): number {
  return cards.filter((c) => c.prompts.rarity === "Legendary").length;
}

/**
 * Returns true when the first deck has met its initiation requirement
 * (≥ FIRST_DECK_MIN_PUNCH_SKATERS Punch Skater cards present).
 */
export function isFirstDeckInitiated(cards: CardPayload[]): boolean {
  return countPunchSkaters(cards) >= FIRST_DECK_MIN_PUNCH_SKATERS;
}

/**
 * Checks whether `cardToAdd` may be added to the first deck given its
 * current `existingCards`.
 *
 * @returns `{ allowed: true }` when the add is permitted, or
 *          `{ allowed: false; reason: string }` with a human-readable explanation.
 */
export function canAddToFirstDeck(
  existingCards: CardPayload[],
  cardToAdd: CardPayload,
): { allowed: true } | { allowed: false; reason: string } {
  const rarity: Rarity = cardToAdd.prompts.rarity;

  // Post-initiation — no restrictions.
  if (isFirstDeckInitiated(existingCards)) {
    return { allowed: true };
  }

  // Pre-initiation rules:
  const punchSkatersNeeded =
    FIRST_DECK_MIN_PUNCH_SKATERS - countPunchSkaters(existingCards);

  if (rarity === "Punch Skater") {
    return { allowed: true };
  }

  if (rarity === "Legendary") {
    if (countLegendaries(existingCards) >= FIRST_DECK_MAX_LEGENDARY_BEFORE_INIT) {
      return {
        allowed: false,
        reason: `Your first deck is still forming. You can only include ${FIRST_DECK_MAX_LEGENDARY_BEFORE_INIT} Legendary card${FIRST_DECK_MAX_LEGENDARY_BEFORE_INIT !== 1 ? "s" : ""} until the deck has ${FIRST_DECK_MIN_PUNCH_SKATERS} Punch Skaters (${punchSkatersNeeded} more needed).`,
      };
    }
    return { allowed: true };
  }

  // Apprentice / Master / Rare — blocked until initiation.
  return {
    allowed: false,
    reason: `Your first deck needs ${punchSkatersNeeded} more Punch Skater card${punchSkatersNeeded !== 1 ? "s" : ""} before you can add ${rarity} cards.`,
  };
}

/**
 * Returns a status summary for the first deck's initiation progress.
 * Useful for rendering a progress banner in the UI.
 */
export function getFirstDeckInitiationStatus(cards: CardPayload[]): {
  initiated: boolean;
  punchSkaterCount: number;
  legendaryCount: number;
  punchSkatersNeeded: number;
} {
  const punchSkaterCount = countPunchSkaters(cards);
  const legendaryCount = countLegendaries(cards);
  const punchSkatersNeeded = Math.max(
    0,
    FIRST_DECK_MIN_PUNCH_SKATERS - punchSkaterCount,
  );
  return {
    initiated: punchSkaterCount >= FIRST_DECK_MIN_PUNCH_SKATERS,
    punchSkaterCount,
    legendaryCount,
    punchSkatersNeeded,
  };
}
