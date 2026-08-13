import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORGE_CLASH_FINISHER_BONUS,
  FORGE_CLASH_MAX_HEAT,
  FORGE_CLASH_MAX_ROUNDS,
  buildForgeClashRewards,
  buildForgeClashRivalPattern,
  createForgeClashMatch,
  getForgeClashTelegraph,
  resolveForgeClashRound,
} from '../lib/forgeClash.js';
import { createJoustCardSnapshot } from '../lib/joust.js';

const ALL_TACTICS = ['charge', 'guard', 'feint', 'counter', 'boost', 'trickStrike'];

function buildCard(id, overrides = {}) {
  return createJoustCardSnapshot({
    id,
    name: overrides.name ?? `Rider ${id}`,
    prompts: {
      archetype: 'The Team',
      district: 'Batteryville',
    },
    identity: {
      name: overrides.name ?? `Rider ${id}`,
      crew: 'The Team',
    },
    stats: {
      speed: 8,
      range: 7,
      rangeNm: 7,
      stealth: 7,
      grit: 7,
      ...overrides.stats,
    },
    joust: {
      lance: 7,
      shield: 7,
      hype: 7,
      gear: {
        boardType: 'Street',
        lanceType: 'kinetic',
        shieldType: 'riot',
        armorTag: 'street shell',
      },
      traits: [],
      ...overrides.joust,
    },
  });
}

function buildRoster(cardOverrides = {}) {
  return Array.from({ length: 6 }, (_, index) => {
    const cardId = `card-${index + 1}`;
    const snapshot = buildCard(cardId, cardOverrides);
    return {
      slotId: `owned:${cardId}`,
      cardId,
      ownerUid: 'player-1',
      loaner: false,
      name: snapshot.name,
      snapshot,
    };
  });
}

function buildMatch(seed = 'forge-seed', overrides = {}) {
  return {
    ...createForgeClashMatch({
      id: 'forge-clash-test',
      uid: 'player-1',
      seed,
      roster: buildRoster(),
      rival: buildCard('batteryville-jax-voltage', { name: 'Jax Voltage' }),
      now: '2026-08-13T00:00:00.000Z',
    }),
    ...overrides,
  };
}

function simulateMatch(seed) {
  let match = buildMatch(seed);
  while (match.status === 'playing') {
    const slot = match.roster[(match.turn - 1) % match.roster.length];
    const tactic = match.rivalPattern[match.turn - 1];
    const resolved = resolveForgeClashRound(match, {
      slotId: slot.slotId,
      tactic,
      now: `2026-08-13T00:00:0${match.turn}.000Z`,
    });
    assert.ok(resolved.round.breakdown.randomRoll >= -1);
    assert.ok(resolved.round.breakdown.randomRoll <= 1);
    assert.equal(Number.isInteger(resolved.round.breakdown.randomRoll), true);
    assert.ok(resolved.round.playerDamage >= 0);
    assert.ok(resolved.round.rivalDamage >= 0);
    match = resolved.match;
  }
  return match;
}

test('Jax always opens with Boost and keeps a deterministic hidden pattern', () => {
  const first = buildForgeClashRivalPattern('same-seed');
  const second = buildForgeClashRivalPattern('same-seed');

  assert.deepEqual(first, second);
  assert.equal(first[0], 'boost');
  assert.deepEqual([...first].sort(), [...ALL_TACTICS].sort());
  assert.deepEqual(getForgeClashTelegraph(first[0]), {
    intent: 'rush',
    label: 'Throttle spike',
    hint: 'Charge or Boost likely',
  });
});

test('round resolution is deterministic, enforces cooldowns, and exposes readable variance', () => {
  const initial = buildMatch('deterministic-round');
  const options = {
    slotId: initial.roster[0].slotId,
    tactic: 'charge',
    now: '2026-08-13T00:00:01.000Z',
  };
  const first = resolveForgeClashRound(initial, options);
  const second = resolveForgeClashRound(buildMatch('deterministic-round'), options);

  assert.deepEqual(first, second);
  assert.equal(first.round.breakdown.strike, first.round.baseStrike);
  assert.ok(['win', 'loss', 'draw'].includes(first.round.outcome));
  assert.throws(
    () => resolveForgeClashRound(first.match, options),
    (error) => error?.statusCode === 409 && /cooling down/i.test(error.message),
  );

  const secondSlot = first.match.roster[1];
  const turnTwo = resolveForgeClashRound(first.match, {
    slotId: secondSlot.slotId,
    tactic: 'guard',
  });
  assert.doesNotThrow(() => resolveForgeClashRound(turnTwo.match, {
    slotId: initial.roster[0].slotId,
    tactic: 'charge',
  }));
});

test('stat-locked tactics and premature Overdrive are rejected', () => {
  const roster = buildRoster({
    stats: {
      speed: 6,
      range: 7,
      rangeNm: 7,
      stealth: 5,
      grit: 7,
    },
  });
  const match = buildMatch('locked-tactics', { roster });

  for (const tactic of ['feint', 'boost']) {
    assert.throws(
      () => resolveForgeClashRound(match, { slotId: roster[0].slotId, tactic }),
      (error) => error?.statusCode === 400 && /not available/i.test(error.message),
    );
  }
  assert.throws(
    () => resolveForgeClashRound(match, {
      slotId: roster[0].slotId,
      tactic: 'charge',
      finisher: true,
    }),
    (error) => error?.statusCode === 409 && /full heat/i.test(error.message),
  );
});

test('full Heat can be spent on an Overdrive bonus', () => {
  const match = buildMatch('finisher-seed', { heat: FORGE_CLASH_MAX_HEAT });
  const resolved = resolveForgeClashRound(match, {
    slotId: match.roster[0].slotId,
    tactic: 'charge',
    finisher: true,
  });

  assert.equal(resolved.round.finisher, true);
  assert.equal(resolved.round.finisherBonus, FORGE_CLASH_FINISHER_BONUS);
  assert.equal(
    resolved.round.effectiveStrike,
    resolved.round.baseStrike + FORGE_CLASH_FINISHER_BONUS,
  );
  assert.equal(resolved.round.heatAfter, 0);
});

test('seeded resolver simulations always finish within six rounds', () => {
  for (let index = 0; index < 100; index += 1) {
    const first = simulateMatch(`balance-${index}`);
    const replay = simulateMatch(`balance-${index}`);

    assert.deepEqual(first, replay);
    assert.equal(first.status, 'completed');
    assert.ok(first.rounds.length >= 1);
    assert.ok(first.rounds.length <= FORGE_CLASH_MAX_ROUNDS);
    assert.ok(['win', 'loss', 'draw'].includes(first.result));
  }
});

test('wins, draws, and losses grant distinct authoritative rewards', () => {
  assert.deepEqual(buildForgeClashRewards('win', true), {
    xp: 80,
    ozzies: 24,
    cardXp: 40,
    cardOzzies: 10,
    districtReputation: 40,
    firstClear: true,
    frameId: 'breaker-crown',
  });
  assert.equal(buildForgeClashRewards('draw').xp, 35);
  assert.equal(buildForgeClashRewards('loss').xp, 20);
  assert.equal(buildForgeClashRewards('loss').ozzies, 4);
});
