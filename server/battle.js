const MIN_SINGLE_STAT = 1;
const MAX_SINGLE_STAT = 10;
// Older saved cards used a 1–200 stat scale; mirror the client's
// normalizeLegacyCardStat so legacy decks resolve the same everywhere.
const LEGACY_MAX_SINGLE_STAT = 200;
const WAGER_POINTS = 6;
const WINNER_BONUS = WAGER_POINTS * 2;
const STAT_KEYS = ["speed", "stealth", "tech", "grit", "rep"];

function clampCardStat(value) {
  return Math.max(MIN_SINGLE_STAT, Math.min(MAX_SINGLE_STAT, Math.round(value)));
}

// Card docs and deck snapshots are client-writable per firestore.rules, so a
// hostile payload can carry arbitrary stat values. Normalize every stat onto
// the live 1–10 scale before battle resolution instead of trusting the client.
export function normalizeBattleCardStat(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return MIN_SINGLE_STAT;
  if (num <= MAX_SINGLE_STAT) return clampCardStat(num);

  const scaled = MIN_SINGLE_STAT
    + ((Math.min(num, LEGACY_MAX_SINGLE_STAT) - MIN_SINGLE_STAT) * (MAX_SINGLE_STAT - MIN_SINGLE_STAT))
      / (LEGACY_MAX_SINGLE_STAT - MIN_SINGLE_STAT);
  return clampCardStat(scaled);
}

function seedFromString(seed) {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seedFromString(seed) || 1;
  return {
    next() {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      return ((state >>> 0) % 1_000_000) / 1_000_000;
    },
  };
}

function cloneBattleCard(card) {
  return {
    ...card,
    stats: { ...card.stats },
  };
}

function getArchetypeCounts(cards) {
  const archetypeCounts = new Map();
  for (const card of cards) {
    const archetype = card.archetype ?? card.prompts?.archetype;
    archetypeCounts.set(archetype, (archetypeCounts.get(archetype) ?? 0) + 1);
  }
  return archetypeCounts;
}

function getSynergyMultiplier(cards) {
  const archetypeCounts = getArchetypeCounts(cards);
  let pairs = 0;
  for (const count of archetypeCounts.values()) {
    if (count >= 2) pairs += count - 1;
  }
  return 1 + Math.min(pairs * 0.03, 0.15);
}

function computeDeckTotalPower(cards) {
  return cards.reduce(
    (sum, card) => sum + STAT_KEYS.reduce((cardSum, key) => cardSum + (card.stats?.[key] ?? 0), 0),
    0,
  );
}

function computeDeckScore(cards) {
  if (cards.length === 0) return 0;
  return Math.round(computeDeckTotalPower(cards) * getSynergyMultiplier(cards));
}

function resolveBattle(challengerCards, defenderCards) {
  const challengerScore = computeDeckScore(challengerCards);
  const defenderScore = computeDeckScore(defenderCards);

  let winnerSide = "draw";
  if (challengerScore > defenderScore) winnerSide = "challenger";
  else if (defenderScore > challengerScore) winnerSide = "defender";

  return { challengerScore, defenderScore, winnerSide };
}

function getEligibleStatPositions(cards, direction) {
  const cells = [];
  for (let cardIndex = 0; cardIndex < cards.length; cardIndex += 1) {
    for (const key of STAT_KEYS) {
      const value = cards[cardIndex].stats[key];
      if (direction < 0 && value > MIN_SINGLE_STAT) cells.push([cardIndex, key]);
      if (direction > 0 && value < MAX_SINGLE_STAT) cells.push([cardIndex, key]);
    }
  }
  return cells;
}

function applyRandomStatShift(cards, totalPoints, direction, seed) {
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

function toCardResolutions(cards) {
  return cards.map((card) => ({
    id: card.id,
    stats: { ...card.stats },
  }));
}

export function createBattleCardSnapshot(card) {
  return {
    id: card.id,
    archetype: card.prompts?.archetype ?? card.archetype,
    stats: {
      speed: normalizeBattleCardStat(card.stats?.speed ?? MIN_SINGLE_STAT),
      stealth: normalizeBattleCardStat(card.stats?.stealth ?? MIN_SINGLE_STAT),
      tech: normalizeBattleCardStat(card.stats?.tech ?? MIN_SINGLE_STAT),
      grit: normalizeBattleCardStat(card.stats?.grit ?? MIN_SINGLE_STAT),
      rep: normalizeBattleCardStat(card.stats?.rep ?? MIN_SINGLE_STAT),
    },
  };
}

export function resolveBattleWithEffects(challengerCards, defenderCards, battleSeed) {
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
