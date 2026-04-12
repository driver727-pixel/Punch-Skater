/**
 * battle.ts – Stat-crunching algorithm and wager logic for the Battle Arena.
 *
 * Each battle costs the challenger 6 random attribute points (the "wager").
 * The defender also stakes 6 random attribute points.
 * The winner receives both wagers (12 points) to distribute among their
 * battle-deck cards.
 */
import type { ArenaDeckSummary, CardPayload, StatKey } from "./types";

/** Number of attribute points each player wagers per battle. */
export const WAGER_POINTS = 6;

/** Total bonus points the winner receives (both wagers combined). */
export const WINNER_BONUS = WAGER_POINTS * 2;

// ── Stat keys ────────────────────────────────────────────────────────────────

const STAT_KEYS: StatKey[] = ["speed", "stealth", "tech", "grit", "rep"];
const STAT_LABELS: Record<StatKey, string> = {
  speed: "SPD",
  stealth: "STLTH",
  tech: "TCH",
  grit: "GRT",
  rep: "REP",
};

/** Count how many cards in the deck share each archetype. */
function getArchetypeCounts(cards: CardPayload[]): Map<string, number> {
  const archetypeCounts = new Map<string, number>();
  for (const card of cards) {
    const archetype = card.prompts.archetype;
    archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
  }
  return archetypeCounts;
}

/** Apply a 3% bonus per repeated-archetype pair, capped at +15%. */
function getSynergyMultiplier(cards: CardPayload[]): number {
  const archetypeCounts = getArchetypeCounts(cards);
  let pairs = 0;
  for (const count of archetypeCounts.values()) {
    if (count >= 2) pairs += count - 1;
  }
  return 1 + Math.min(pairs * 0.03, 0.15);
}

/** Sum total speed, stealth, tech, grit, and rep across the whole deck. */
export function getDeckStatTotals(cards: CardPayload[]): Record<StatKey, number> {
  const totals: Record<StatKey, number> = {
    speed: 0,
    stealth: 0,
    tech: 0,
    grit: 0,
    rep: 0,
  };

  for (const card of cards) {
    for (const key of STAT_KEYS) {
      totals[key] += card.stats[key] ?? 0;
    }
  }

  return totals;
}

export function computeDeckTotalPower(cards: CardPayload[]): number {
  const statTotals = getDeckStatTotals(cards);
  return STAT_KEYS.reduce((sum, key) => sum + statTotals[key], 0);
}

export function formatStatLabel(stat: StatKey): string {
  return STAT_LABELS[stat];
}

export function buildArenaDeckSummary(cards: CardPayload[]): ArenaDeckSummary {
  if (cards.length === 0) {
    return {
      deckPower: 0,
      strongestStat: "speed",
      strongestStatTotal: 0,
      synergyBonusPct: 0,
      archetypeHint: "Mixed crew",
    };
  }

  const statTotals = getDeckStatTotals(cards);
  const strongestStat = STAT_KEYS.reduce((best, key) => (
    statTotals[key] > statTotals[best] ? key : best
  ), STAT_KEYS[0]);
  const dominantArchetypeEntry = Array.from(getArchetypeCounts(cards).entries())
    .sort((a, b) => b[1] - a[1])[0];
  const [dominantArchetype, dominantArchetypeCount] = dominantArchetypeEntry ?? [undefined, 0];

  return {
    deckPower: computeDeckScore(cards),
    strongestStat,
    strongestStatTotal: statTotals[strongestStat],
    synergyBonusPct: Math.round((getSynergyMultiplier(cards) - 1) * 100),
    archetypeHint: dominantArchetype && dominantArchetypeCount > 1
      ? `${dominantArchetype} core (${dominantArchetypeCount}/${cards.length})`
      : "Mixed crew",
  };
}

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

  const raw = computeDeckTotalPower(cards);
  const synergyMultiplier = getSynergyMultiplier(cards);

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
