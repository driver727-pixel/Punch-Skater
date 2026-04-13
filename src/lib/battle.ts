/**
 * battle.ts – Stat-crunching algorithm and wager logic for the Battle Arena.
 *
 * Each battle costs the challenger 6 random attribute points (the "wager").
 * The defender also stakes 6 random attribute points.
 * The winner receives both wagers (12 points) to distribute among their
 * battle-deck cards.
 */
import { createSeededRandom } from "./prng";
import type {
  ArenaDeckSummary,
  BattleCardResolution,
  BattleCardSnapshot,
  CardPayload,
  StatKey,
} from "./types";
import { CARD_STAT_LABELS } from "./statLabels";
import { MAX_SINGLE_STAT, MIN_SINGLE_STAT } from "./generator";

/** Number of attribute points each player wagers per battle. */
export const WAGER_POINTS = 6;

/** Total bonus points the winner receives (both wagers combined). */
export const WINNER_BONUS = WAGER_POINTS * 2;

// ── Stat keys ────────────────────────────────────────────────────────────────

const STAT_KEYS: StatKey[] = ["speed", "stealth", "tech", "grit", "rep"];
const STAT_LABELS: Record<StatKey, string> = Object.fromEntries(
  STAT_KEYS.map((k) => [k, CARD_STAT_LABELS[k].label]),
) as Record<StatKey, string>;

type BattleCardInput = CardPayload | BattleCardSnapshot;

function getCardArchetype(card: BattleCardInput): string {
  return "archetype" in card ? card.archetype : card.prompts.archetype;
}

function cloneBattleCard(card: BattleCardSnapshot): BattleCardSnapshot {
  return {
    ...card,
    stats: { ...card.stats },
  };
}

export function createBattleCardSnapshot(card: CardPayload): BattleCardSnapshot {
  return {
    id: card.id,
    archetype: card.prompts.archetype,
    stats: { ...card.stats },
  };
}

/** Count how many cards in the deck share each archetype. */
function getArchetypeCounts(cards: readonly BattleCardInput[]): Map<string, number> {
  const archetypeCounts = new Map<string, number>();
  for (const card of cards) {
    const archetype = getCardArchetype(card);
    archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
  }
  return archetypeCounts;
}

/** Apply a 3% bonus per repeated-archetype pair, capped at +15%. */
function getSynergyMultiplier(cards: readonly BattleCardInput[]): number {
  const archetypeCounts = getArchetypeCounts(cards);
  let pairs = 0;
  for (const count of archetypeCounts.values()) {
    if (count >= 2) pairs += count - 1;
  }
  return 1 + Math.min(pairs * 0.03, 0.15);
}

// ── Ozzycred (card & deck worth) ─────────────────────────────────────────────

/**
 * Return the Ozzycred worth of a single card.
 * New cards carry an explicit `ozzies` currency field.  Legacy cards that
 * pre-date the field fall back to the old "sum of five stats" heuristic so
 * existing collections aren't zeroed out.
 */
export function computeCardWorth(card: CardPayload): number {
  if (typeof card.ozzies === "number" && card.ozzies > 0) {
    return card.ozzies;
  }
  // Legacy fallback: sum of stats
  return STAT_KEYS.reduce((sum, key) => sum + (card.stats[key] ?? 0), 0);
}

/** Compute the total Ozzycred worth of a deck (sum of every card's worth). */
export function computeDeckWorth(cards: CardPayload[]): number {
  return Math.round(cards.reduce((sum, card) => sum + computeCardWorth(card), 0) * 100) / 100;
}

/** Sum total speed, stealth, tech, grit, and rep across the whole deck. */
export function getDeckStatTotals(cards: readonly BattleCardInput[]): Record<StatKey, number> {
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

export function computeDeckTotalPower(cards: readonly BattleCardInput[]): number {
  const statTotals = getDeckStatTotals(cards);
  return STAT_KEYS.reduce((sum, key) => sum + statTotals[key], 0);
}

export function formatStatLabel(stat: StatKey): string {
  return STAT_LABELS[stat];
}

export function buildArenaDeckSummary(cards: readonly BattleCardInput[]): ArenaDeckSummary {
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
export function computeDeckScore(cards: readonly BattleCardInput[]): number {
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

export interface BattleResolutionDetails extends BattleOutcome {
  wagerPoints: number;
  winningDeckCardIds: string[];
  challengerCardResolutions: BattleCardResolution[];
  defenderCardResolutions: BattleCardResolution[];
}

/**
 * Resolve a battle between two decks.  Pure function – no side-effects.
 */
export function resolveBattle(
  challengerCards: readonly BattleCardInput[],
  defenderCards: readonly BattleCardInput[],
): BattleOutcome {
  const challengerScore = computeDeckScore(challengerCards);
  const defenderScore = computeDeckScore(defenderCards);

  let winnerSide: BattleOutcome["winnerSide"];
  if (challengerScore > defenderScore) winnerSide = "challenger";
  else if (defenderScore > challengerScore) winnerSide = "defender";
  else winnerSide = "draw";

  return { challengerScore, defenderScore, winnerSide };
}

/**
 * Returns every card/stat position that can still be adjusted in the requested
 * direction without violating the live stat bounds.
 */
function getEligibleStatPositions(cards: BattleCardSnapshot[], direction: -1 | 1): Array<[number, StatKey]> {
  const cells: Array<[number, StatKey]> = [];
  for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
    for (const key of STAT_KEYS) {
      const value = cards[cardIndex].stats[key];
      if (direction < 0 && value > MIN_SINGLE_STAT) {
        cells.push([cardIndex, key]);
      }
      if (direction > 0 && value < MAX_SINGLE_STAT) {
        cells.push([cardIndex, key]);
      }
    }
  }
  return cells;
}

/**
 * Applies a deterministic random stat shift across a battle deck.
 * `direction = -1` spends wager points, while `direction = 1` distributes bonus
 * points. Seeded randomness keeps the final resolution reproducible.
 */
function applyRandomStatShift(
  cards: BattleCardSnapshot[],
  totalPoints: number,
  direction: -1 | 1,
  seed: string,
): BattleCardSnapshot[] {
  const rng = createSeededRandom(seed);
  const nextCards = cards.map(cloneBattleCard);
  let remaining = totalPoints;

  while (remaining > 0) {
    const eligible = getEligibleStatPositions(nextCards, direction);
    if (eligible.length === 0) break;
    const [cardIndex, statKey] = eligible[Math.floor(rng.next() * eligible.length)];
    nextCards[cardIndex].stats[statKey] += direction;
    remaining -= 1;
  }

  return nextCards;
}

/** Converts resolved battle snapshots into compact card-resolution records. */
function toCardResolutions(cards: BattleCardSnapshot[]): BattleCardResolution[] {
  return cards.map((card) => ({
    id: card.id,
    stats: { ...card.stats },
  }));
}

export function resolveBattleWithEffects(
  challengerCards: BattleCardSnapshot[],
  defenderCards: BattleCardSnapshot[],
  battleSeed: string,
): BattleResolutionDetails {
  const outcome = resolveBattle(challengerCards, defenderCards);

  if (outcome.winnerSide === "draw") {
    return {
      ...outcome,
      wagerPoints: 0,
      winningDeckCardIds: [],
      challengerCardResolutions: toCardResolutions(challengerCards),
      defenderCardResolutions: toCardResolutions(defenderCards),
    };
  }

  const wageredChallenger = applyRandomStatShift(
    challengerCards,
    WAGER_POINTS,
    -1,
    `${battleSeed}:challenger:wager`,
  );
  const wageredDefender = applyRandomStatShift(
    defenderCards,
    WAGER_POINTS,
    -1,
    `${battleSeed}:defender:wager`,
  );

  const challengerResolvedCards =
    outcome.winnerSide === "challenger"
      ? applyRandomStatShift(wageredChallenger, WINNER_BONUS, 1, `${battleSeed}:challenger:bonus`)
      : wageredChallenger;
  const defenderResolvedCards =
    outcome.winnerSide === "defender"
      ? applyRandomStatShift(wageredDefender, WINNER_BONUS, 1, `${battleSeed}:defender:bonus`)
      : wageredDefender;

  return {
    ...outcome,
    wagerPoints: WINNER_BONUS,
    winningDeckCardIds:
      outcome.winnerSide === "challenger"
        ? challengerCards.map((card) => card.id)
        : defenderCards.map((card) => card.id),
    challengerCardResolutions: toCardResolutions(challengerResolvedCards),
    defenderCardResolutions: toCardResolutions(defenderResolvedCards),
  };
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
