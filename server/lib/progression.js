/**
 * progression.js — Server-side progression helpers for Punch Skater.
 *
 * Mirrors the constants and pure logic from src/lib/progression.ts.
 * Keep in sync with the client-side version.
 */

/** An active Crew consists of exactly this many Punch Skater cards. */
export const CREW_SIZE = 6;

/** Maximum XP a single card can accumulate through gameplay. */
export const MAX_CARD_XP = 100_000_000;

/**
 * Long-term design target for maximum Deck Power (10,000).
 * Current architectural max with 6 cards × 4 stats × 10 = 240.
 */
export const MAX_DECK_POWER_TARGET = 10_000;

/**
 * Deck Power upgrade-unlock thresholds (expressed as the long-term design
 * target values).  Legendary cannot be forged — earn only.
 */
export const DECK_POWER_UPGRADE_THRESHOLDS = {
  Apprentice: 1_000,
  Master:     2_500,
  Rare:       5_000,
  Legendary:  8_500,
};

/** Base Ozzy ranges per rarity tier. */
export const OZZY_BASE_RANGE = {
  'Punch Skater': { min: 5,   max: 50   },
  Apprentice:     { min: 25,  max: 100  },
  Master:         { min: 75,  max: 200  },
  Rare:           { min: 150, max: 500  },
  Legendary:      { min: 500, max: 2000 },
};

/**
 * Deterministically assign a base Ozzy value for a newly forged card.
 *
 * @param {string} rarity  — card rarity tier
 * @param {number} normRng — a pre-seeded normalised RNG value in [0, 1)
 * @returns {number}
 */
export function assignBaseOzzies(rarity, normRng) {
  const range = OZZY_BASE_RANGE[rarity] ?? OZZY_BASE_RANGE['Punch Skater'];
  return Math.round(range.min + normRng * (range.max - range.min));
}

/**
 * Return the Ozzy value of a single card.
 * Falls back to stat-sum heuristic for cards without an explicit ozzies field.
 *
 * @param {object} card — CardPayload
 * @returns {number}
 */
export function computeCardOzzies(card) {
  if (typeof card.ozzies === 'number' && card.ozzies >= 0) {
    return card.ozzies;
  }
  const { speed = 0, range = 0, stealth = 0, grit = 0 } = card.stats ?? {};
  return speed + range + stealth + grit;
}

/**
 * Crew Ozzies = sum of Ozzy values across the active 6-card deck.
 *
 * @param {object[]} cards
 * @returns {number}
 */
export function computeCrewOzzies(cards) {
  return cards.reduce((sum, card) => sum + computeCardOzzies(card), 0);
}

/**
 * Return the XP value for a single card (defaults to 0).
 *
 * @param {object} card — CardPayload
 * @returns {number}
 */
export function getCardXp(card) {
  return typeof card.xp === 'number' ? Math.max(0, Math.min(card.xp, MAX_CARD_XP)) : 0;
}

/**
 * Crew XP = sum of XP across all cards in the active 6-card deck.
 *
 * @param {object[]} cards
 * @returns {number}
 */
export function computeCrewXp(cards) {
  return cards.reduce((sum, card) => sum + getCardXp(card), 0);
}

/**
 * Combined leaderboard score:
 *   Deck Power + Crew Ozzies + (Crew XP / 10,000) + district reputation
 *
 * Crew XP is divided by 10,000 so a maxed card at 100,000,000 XP contributes
 * 10,000 — the same order of magnitude as Deck Power and Crew Ozzies.
 *
 * @param {number} deckPower
 * @param {number} crewOzzies
 * @param {number} crewXp
 * @param {number} [districtReputation=0]
 * @returns {number}
 */
export function computeLeaderboardScore(deckPower, crewOzzies, crewXp, districtReputation = 0) {
  return Math.round(deckPower + crewOzzies + crewXp / 10_000 + districtReputation);
}
