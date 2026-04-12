/**
 * battle.ts – Stat-crunching algorithm and wager logic for the Battle Arena.
 *
 * Each battle costs the challenger 10 random attribute points (the "wager").
 * The defender also stakes 10 random attribute points.
 * The winner receives both wagers (20 points) to distribute among their
 * battle-deck cards.
 */
import type { CardPayload, StatKey } from "./types";

/** Number of attribute points each player wagers per battle. */
export const WAGER_POINTS = 10;

/** Total bonus points the winner receives (both wagers combined). */
export const WINNER_BONUS = WAGER_POINTS * 2;

// ── Stat keys ────────────────────────────────────────────────────────────────

const STAT_KEYS: StatKey[] = ["speed", "stealth", "tech", "grit", "rep"];

// ── Deck scoring ─────────────────────────────────────────────────────────────

/** Compute a deterministic battle score for a deck of cards.
 *
 *  The algorithm:
 *  1. Sum every card stat across the deck.
 *  2. Apply a small "synergy bonus" when multiple cards share the same
 *     archetype (+3 % per matching pair, max +15 %).
 *  3. Return the rounded total.
 *
 *  This keeps results fully reproducible (no RNG during resolution) while
 *  still rewarding thoughtful deck building over raw stat-stacking.
 */
export function computeDeckScore(cards: CardPayload[]): number {
  if (cards.length === 0) return 0;

  // Raw stat total
  let raw = 0;
  for (const card of cards) {
    for (const k of STAT_KEYS) {
      raw += card.stats[k] ?? 0;
    }
  }

  // Synergy bonus: count archetype occurrences
  const archetypeCounts = new Map<string, number>();
  for (const card of cards) {
    const a = card.prompts.archetype;
    archetypeCounts.set(a, (archetypeCounts.get(a) ?? 0) + 1);
  }
  let pairs = 0;
  for (const count of archetypeCounts.values()) {
    if (count >= 2) pairs += count - 1;
  }
  const synergyMultiplier = 1 + Math.min(pairs * 0.03, 0.15);

  return Math.round(raw * synergyMultiplier);
}

// ── Battle resolution ────────────────────────────────────────────────────────

export interface BattleOutcome {
  challengerScore: number;
  defenderScore: number;
  winnerSide: "challenger" | "defender" | "draw";
}

/**
 * Resolve a battle between two decks.  Pure function – no side-effects.
 */
export function resolveBattle(
  challengerCards: CardPayload[],
  defenderCards: CardPayload[],
): BattleOutcome {
  const challengerScore = computeDeckScore(challengerCards);
  const defenderScore = computeDeckScore(defenderCards);

  let winnerSide: BattleOutcome["winnerSide"];
  if (challengerScore > defenderScore) winnerSide = "challenger";
  else if (defenderScore > challengerScore) winnerSide = "defender";
  else winnerSide = "draw";

  return { challengerScore, defenderScore, winnerSide };
}

// ── Wager deduction ──────────────────────────────────────────────────────────

/**
 * Deduct `WAGER_POINTS` random attribute points across a set of cards.
 * Returns a shallow copy of the cards with reduced stats (min 1 per stat).
 */
export function deductWager(cards: CardPayload[]): CardPayload[] {
  if (cards.length === 0) return [];

  const copies: CardPayload[] = cards.map((c) => ({
    ...c,
    stats: { ...c.stats },
  }));

  let remaining = WAGER_POINTS;
  let safetyBreak = WAGER_POINTS * 10;

  while (remaining > 0 && safetyBreak-- > 0) {
    const cardIdx = Math.floor(Math.random() * copies.length);
    const statIdx = Math.floor(Math.random() * STAT_KEYS.length);
    const key = STAT_KEYS[statIdx];
    const card = copies[cardIdx];
    if (card.stats[key] > 1) {
      card.stats[key] -= 1;
      remaining -= 1;
    }
  }

  return copies;
}
