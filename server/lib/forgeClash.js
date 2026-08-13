import { getAvailableJoustTactics, resolveJoust } from './joust.js';

export const FORGE_CLASH_RIVAL_ID = 'batteryville-jax-voltage';
export const FORGE_CLASH_MAX_ROUNDS = 6;
export const FORGE_CLASH_MAX_HP = 60;
export const FORGE_CLASH_MAX_HEAT = 100;
export const FORGE_CLASH_FINISHER_BONUS = 4;
export const FORGE_CLASH_FIRST_CLEAR_FRAME_ID = 'breaker-crown';

const FORGE_CLASH_TACTICS = ['charge', 'guard', 'feint', 'counter', 'boost', 'trickStrike'];
const TELEGRAPH_BY_TACTIC = {
  charge: {
    intent: 'rush',
    label: 'Throttle spike',
    hint: 'Charge or Boost likely',
  },
  boost: {
    intent: 'rush',
    label: 'Throttle spike',
    hint: 'Charge or Boost likely',
  },
  guard: {
    intent: 'brace',
    label: 'Shield line',
    hint: 'Guard or Counter likely',
  },
  counter: {
    intent: 'brace',
    label: 'Shield line',
    hint: 'Guard or Counter likely',
  },
  feint: {
    intent: 'trick',
    label: 'Signal scramble',
    hint: 'Feint or Trick Strike likely',
  },
  trickStrike: {
    intent: 'trick',
    label: 'Signal scramble',
    hint: 'Feint or Trick Strike likely',
  },
};

function badRequest(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

function seedFromString(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = seedFromString(String(seed)) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  const numeric = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(numeric) ? numeric : min));
}

function resolveMatchResult(playerHp, rivalHp) {
  if (playerHp === rivalHp) return 'draw';
  return playerHp > rivalHp ? 'win' : 'loss';
}

function buildRoundNarration({ outcome, finisher, cardName, rivalName, resolution }) {
  if (finisher && outcome === 'win') {
    return `${cardName} cashes in full Heat and blows open ${rivalName}'s line.`;
  }
  if (finisher && outcome === 'loss') {
    return `${rivalName} survives the Overdrive and sends ${cardName} wide.`;
  }
  return resolution.narration;
}

export function buildForgeClashRivalPattern(seed) {
  const rng = createSeededRandom(`${seed}:jax-pattern`);
  const remaining = FORGE_CLASH_TACTICS.filter((tactic) => tactic !== 'boost');
  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }
  return ['boost', ...remaining];
}

export function getForgeClashTelegraph(tactic) {
  const telegraph = TELEGRAPH_BY_TACTIC[tactic] ?? TELEGRAPH_BY_TACTIC.charge;
  return { ...telegraph };
}

export function createForgeClashMatch({
  id,
  uid,
  seed,
  roster,
  rival,
  now = new Date().toISOString(),
  rematchOf = null,
}) {
  if (!Array.isArray(roster) || roster.length !== 6) {
    throw badRequest('Forge Clash requires exactly six Crew cards.');
  }
  if (!rival?.id || !rival?.name) {
    throw badRequest('Forge Clash rival data is unavailable.', 503);
  }

  const rivalPattern = buildForgeClashRivalPattern(seed);
  return {
    schemaVersion: 1,
    id,
    uid,
    seed,
    rivalId: FORGE_CLASH_RIVAL_ID,
    rival,
    roster,
    rivalPattern,
    status: 'playing',
    turn: 1,
    playerHp: FORGE_CLASH_MAX_HP,
    rivalHp: FORGE_CLASH_MAX_HP,
    combo: 0,
    heat: 0,
    cooldowns: {},
    rounds: [],
    result: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    rematchOf,
    rewards: null,
  };
}

export function resolveForgeClashRound(match, {
  slotId,
  tactic,
  finisher = false,
  now = new Date().toISOString(),
}) {
  if (match?.status !== 'playing') {
    throw badRequest('This Forge Clash is already complete.', 409);
  }
  const slot = match.roster?.find((entry) => entry.slotId === slotId);
  if (!slot) {
    throw badRequest('Choose a card from the locked Crew.');
  }
  if ((Number(match.cooldowns?.[slotId]) || 0) > match.turn) {
    throw badRequest(`${slot.name} is still cooling down.`, 409);
  }
  const availableTactics = getAvailableJoustTactics(slot.snapshot);
  if (!FORGE_CLASH_TACTICS.includes(tactic) || !availableTactics.includes(tactic)) {
    throw badRequest('That tactic is not available to this card.');
  }
  if (finisher && match.heat < FORGE_CLASH_MAX_HEAT) {
    throw badRequest('Overdrive requires full Heat.', 409);
  }

  const rivalTactic = match.rivalPattern?.[match.turn - 1]
    ?? buildForgeClashRivalPattern(match.seed)[match.turn - 1];
  const resolution = resolveJoust(slot.snapshot, match.rival, {
    playerTactic: tactic,
    rivalTactic,
    difficulty: 'standard',
    seed: `${match.seed}:round:${match.turn}`,
  });
  const finisherBonus = finisher ? FORGE_CLASH_FINISHER_BONUS : 0;
  const effectiveStrike = resolution.strike + finisherBonus;
  const outcome = effectiveStrike > 0 ? 'win' : effectiveStrike < 0 ? 'loss' : 'draw';
  const correctRead = resolution.breakdown.advantage > 0;
  const impact = Math.min(5, Math.abs(effectiveStrike));
  let playerDamage = 0;
  let rivalDamage = 0;

  if (outcome === 'win') {
    rivalDamage = 10 + impact * 3 + (finisher ? 6 : 0);
  } else if (outcome === 'loss') {
    playerDamage = 10 + impact * 3;
  } else {
    playerDamage = 4;
    rivalDamage = 4;
  }

  const nextPlayerHp = clamp(match.playerHp - playerDamage, 0, FORGE_CLASH_MAX_HP);
  const nextRivalHp = clamp(match.rivalHp - rivalDamage, 0, FORGE_CLASH_MAX_HP);
  const nextCombo = correctRead && outcome === 'win'
    ? clamp(match.combo + 1, 0, 4)
    : 0;
  const heatGain = correctRead && outcome === 'win'
    ? 38 + nextCombo * 2
    : outcome === 'win'
      ? 20
      : outcome === 'draw'
        ? 12
        : 8;
  const nextHeat = finisher
    ? 0
    : clamp(match.heat + heatGain, 0, FORGE_CLASH_MAX_HEAT);
  const ended = nextPlayerHp <= 0
    || nextRivalHp <= 0
    || match.turn >= FORGE_CLASH_MAX_ROUNDS;
  const result = ended ? resolveMatchResult(nextPlayerHp, nextRivalHp) : null;
  const round = {
    turn: match.turn,
    slotId,
    cardId: slot.cardId,
    cardName: slot.name,
    loaner: slot.loaner,
    telegraph: getForgeClashTelegraph(rivalTactic),
    playerTactic: resolution.playerTactic,
    rivalTactic: resolution.rivalTactic,
    baseStrike: resolution.strike,
    finisher,
    finisherBonus,
    effectiveStrike,
    outcome,
    correctRead,
    playerDamage,
    rivalDamage,
    playerHpBefore: match.playerHp,
    playerHpAfter: nextPlayerHp,
    rivalHpBefore: match.rivalHp,
    rivalHpAfter: nextRivalHp,
    comboBefore: match.combo,
    comboAfter: nextCombo,
    heatBefore: match.heat,
    heatAfter: nextHeat,
    narration: buildRoundNarration({
      outcome,
      finisher,
      cardName: slot.name,
      rivalName: match.rival.name,
      resolution,
    }),
    breakdown: resolution.breakdown,
    resolvedAt: now,
  };
  const nextTurn = ended ? match.turn : match.turn + 1;
  const nextMatch = {
    ...match,
    status: ended ? 'completed' : 'playing',
    turn: nextTurn,
    playerHp: nextPlayerHp,
    rivalHp: nextRivalHp,
    combo: nextCombo,
    heat: nextHeat,
    cooldowns: {
      ...(match.cooldowns ?? {}),
      [slotId]: match.turn + 2,
    },
    rounds: [...(match.rounds ?? []), round],
    result,
    updatedAt: now,
    completedAt: ended ? now : null,
  };

  return {
    match: nextMatch,
    round,
    nextTelegraph: ended
      ? null
      : getForgeClashTelegraph(
        nextMatch.rivalPattern?.[nextTurn - 1]
          ?? buildForgeClashRivalPattern(nextMatch.seed)[nextTurn - 1],
      ),
  };
}

export function buildForgeClashRewards(result, firstClear = false) {
  const rewards = result === 'win'
    ? { xp: 80, ozzies: 24, cardXp: 40, cardOzzies: 10, districtReputation: firstClear ? 40 : 8 }
    : result === 'draw'
      ? { xp: 35, ozzies: 8, cardXp: 18, cardOzzies: 3, districtReputation: 2 }
      : { xp: 20, ozzies: 4, cardXp: 10, cardOzzies: 1, districtReputation: 1 };
  return {
    ...rewards,
    firstClear: result === 'win' && firstClear,
    frameId: result === 'win' && firstClear ? FORGE_CLASH_FIRST_CLEAR_FRAME_ID : null,
  };
}
