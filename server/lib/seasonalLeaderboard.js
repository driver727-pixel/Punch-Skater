export const ACTIVE_LEADERBOARD_SEASON = {
  id: 'season-2026-neon-thaw',
  label: 'Neon Thaw',
  startsAt: '2026-03-01T00:00:00.000Z',
  endsAt: '2026-05-31T23:59:59.999Z',
};

export const SEASONAL_SUBMISSION_COOLDOWN_HOURS = 4;
export const SEASONAL_SUBMISSION_COOLDOWN_MS = SEASONAL_SUBMISSION_COOLDOWN_HOURS * 60 * 60 * 1000;

export const SEASONAL_REWARD_TIERS = [
  {
    id: 'participation',
    label: 'Season Crew',
    description: 'Valid 6-card seasonal entry; cosmetic badge only.',
  },
  {
    id: 'top_half',
    label: 'Top Half',
    description: 'Top 50% of eligible seasonal entrants; profile title.',
  },
  {
    id: 'top_ten_percent',
    label: 'Top 10%',
    description: 'Top 10% of eligible seasonal entrants; cosmetic frame.',
  },
  {
    id: 'champion',
    label: 'Season Champion',
    description: 'Rank #1 among eligible entrants; legendary cosmetic title.',
  },
];

export const SEASONAL_FAIR_PLAY_RULES = [
  'Seasonal rank ignores lifetime Crew XP and lifetime Ozzies.',
  'The server recomputes rank from the owner’s saved deck; client-submitted scores are ignored.',
  'A seasonal entry must use exactly 6 unique cards.',
  `Entries can be refreshed once every ${SEASONAL_SUBMISSION_COOLDOWN_HOURS} hours.`,
  'Rewards are cosmetic/status-first so seasonal rank does not become pay-to-win power.',
];

const STAT_KEYS = ['speed', 'range', 'stealth', 'grit'];
const CREW_SIZE = 6;

// Decks (and embedded card snapshots) are user-writable per firestore.rules,
// so a malformed or hostile entry can ship non-numeric or non-finite stats.
// We coerce defensively so a single bad value cannot poison the whole deck
// score with NaN (which would then persist as `null` in Firestore and break
// the seasonal rank query).
function toFiniteNonNegative(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return num;
}

function getCardArchetype(card) {
  return card?.prompts?.archetype ?? card?.archetype ?? 'Unknown';
}

function getArchetypeCounts(cards) {
  const archetypeCounts = new Map();
  for (const card of cards) {
    const archetype = getCardArchetype(card);
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

export function computeDeckScore(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return 0;
  const raw = cards.reduce(
    (sum, card) => sum + STAT_KEYS.reduce((cardSum, key) => cardSum + toFiniteNonNegative(card?.stats?.[key]), 0),
    0,
  );
  return Math.round(raw * getSynergyMultiplier(cards));
}

export function computeDeckWorth(cards) {
  if (!Array.isArray(cards)) return 0;
  return cards.reduce(
    (sum, card) => sum + STAT_KEYS.reduce((cardSum, key) => cardSum + toFiniteNonNegative(card?.stats?.[key]), 0),
    0,
  );
}

export function computeCrewOzzies(cards) {
  if (!Array.isArray(cards)) return 0;
  return cards.reduce((sum, card) => sum + toFiniteNonNegative(card?.ozzies), 0);
}

export function computeCrewXp(cards) {
  if (!Array.isArray(cards)) return 0;
  return cards.reduce((sum, card) => sum + toFiniteNonNegative(card?.xp), 0);
}

export function buildLeaderboardDeckSummary(cards) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return {
      deckPower: 0,
      strongestStat: 'speed',
      strongestStatTotal: 0,
      synergyBonusPct: 0,
      archetypeHint: 'Mixed crew',
    };
  }

  const statTotals = Object.fromEntries(STAT_KEYS.map((key) => [key, 0]));
  for (const card of cards) {
    for (const key of STAT_KEYS) {
      statTotals[key] += toFiniteNonNegative(card?.stats?.[key]);
    }
  }
  const strongestStat = STAT_KEYS.reduce((best, key) => (statTotals[key] > statTotals[best] ? key : best), STAT_KEYS[0]);
  const dominantArchetypeEntry = Array.from(getArchetypeCounts(cards).entries()).sort((a, b) => b[1] - a[1])[0];
  const [dominantArchetype, dominantArchetypeCount] = dominantArchetypeEntry ?? [undefined, 0];

  return {
    deckPower: computeDeckScore(cards),
    strongestStat,
    strongestStatTotal: statTotals[strongestStat],
    synergyBonusPct: Math.round((getSynergyMultiplier(cards) - 1) * 100),
    archetypeHint: dominantArchetype && dominantArchetypeCount > 1
      ? `${dominantArchetype} core (${dominantArchetypeCount}/${cards.length})`
      : 'Mixed crew',
  };
}

export function computeSeasonalRankScore(deckPower) {
  return Math.max(0, Math.round(toFiniteNonNegative(deckPower)));
}

export function computeLifetimeLeaderboardScore({ deckPower, crewOzzies = 0, crewXp = 0 }) {
  return Math.max(
    0,
    Math.round(
      toFiniteNonNegative(deckPower)
        + toFiniteNonNegative(crewOzzies)
        + toFiniteNonNegative(crewXp) / 10_000,
    ),
  );
}

export function resolveSeasonalRewardTierIds(rank, entrantCount) {
  if (rank < 1 || entrantCount < 1) return [];

  const tiers = ['participation'];
  if (rank <= Math.ceil(entrantCount * 0.5)) tiers.push('top_half');
  if (rank <= Math.ceil(entrantCount * 0.1)) tiers.push('top_ten_percent');
  if (rank === 1) tiers.push('champion');
  return tiers;
}

export function isSeasonActive(now = new Date()) {
  const time = now.getTime();
  return time >= Date.parse(ACTIVE_LEADERBOARD_SEASON.startsAt)
    && time <= Date.parse(ACTIVE_LEADERBOARD_SEASON.endsAt);
}

export function validateSeasonalDeck(cards) {
  if (!Array.isArray(cards) || cards.length !== CREW_SIZE) {
    return { ok: false, error: `Seasonal entries require exactly ${CREW_SIZE} cards.` };
  }

  const ids = cards.map((card) => (typeof card?.id === 'string' ? card.id.trim() : ''));
  if (ids.some((id) => !id)) {
    return { ok: false, error: 'Every seasonal card must have an id.' };
  }
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: 'Seasonal entries require 6 unique cards.' };
  }

  return { ok: true };
}
