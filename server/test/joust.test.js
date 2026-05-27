import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createJoustCardSnapshot,
  resolveJoust,
  resolveRivalJoustTactic,
  selectDefaultJoustRider,
} from '../lib/joust.js';

function buildCard(overrides = {}) {
  return {
    id: overrides.id ?? 'card-default',
    name: overrides.name,
    prompts: {
      archetype: 'Qu111s',
      district: 'The Grid',
      ...overrides.prompts,
    },
    identity: {
      name: overrides.name ?? 'Jax Voltage',
      crew: 'Qu111s',
      ...overrides.identity,
    },
    stats: {
      speed: 7,
      range: 6,
      rangeNm: 6,
      stealth: 6,
      grit: 6,
      ...overrides.stats,
    },
    joust: {
      lance: 7,
      shield: 6,
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
  };
}

test('resolveJoust is deterministic for a given seed', () => {
  const player = buildCard({
    id: 'player-1',
    name: 'Jax Voltage',
    stats: { speed: 8, range: 6, stealth: 7, grit: 6 },
    joust: { lance: 8, shield: 5, hype: 8, traits: ['Neon Flourish'] },
  });
  const rival = buildCard({
    id: 'rival-1',
    name: 'Mina Chrome',
    identity: { name: 'Mina Chrome', crew: 'Ne0n Legion' },
    prompts: { archetype: 'Ne0n Legion' },
    stats: { speed: 6, range: 6, stealth: 6, grit: 7 },
    joust: { lance: 6, shield: 7, hype: 6, traits: ['Magnetic Guard'] },
  });

  const first = resolveJoust(player, rival, { playerTactic: 'trickStrike', seed: 'same-seed' });
  const second = resolveJoust(player, rival, { playerTactic: 'trickStrike', seed: 'same-seed' });

  assert.deepEqual(first, second);
  assert.equal(first.rewardHints.styleMultiplier, 1.15);
});

test('selectDefaultJoustRider prefers lance, then speed, then hype', () => {
  const rider = selectDefaultJoustRider([
    buildCard({ id: 'alpha', stats: { speed: 7 }, joust: { lance: 7, shield: 5, hype: 6 } }),
    buildCard({ id: 'beta', stats: { speed: 8 }, joust: { lance: 8, shield: 5, hype: 6 } }),
    buildCard({ id: 'gamma', stats: { speed: 6 }, joust: { lance: 8, shield: 5, hype: 8 } }),
  ]);

  assert.equal(rider.id, 'beta');
});

test('hard rival AI picks the strongest counter read for a telegraphed charge', () => {
  const player = buildCard({
    id: 'player-charge',
    stats: { speed: 8, stealth: 5, grit: 6 },
    joust: { lance: 8, shield: 5, hype: 6, traits: ['Heavy Lance'] },
  });
  const rival = buildCard({
    id: 'rival-counter',
    identity: { name: 'Rook Wraith', crew: 'Ne0n Legion' },
    prompts: { archetype: 'Ne0n Legion' },
    stats: { speed: 6, stealth: 6, grit: 7 },
    joust: { lance: 7, shield: 8, hype: 6, traits: ['Street Parry'] },
  });

  const tactic = resolveRivalJoustTactic(player, rival, 'charge', 'ai-seed', 'hard');
  assert.equal(tactic, 'counter');
});

test('difficulty bands raise rival baselines and trim the player strike', () => {
  const player = buildCard({
    id: 'player-band',
    stats: { speed: 8, stealth: 7, grit: 6 },
    joust: { lance: 8, shield: 6, hype: 7, traits: ['Boost Charge'] },
  });
  const rival = buildCard({
    id: 'rival-band',
    identity: { name: 'Nova Saint', crew: 'The Team' },
    prompts: { archetype: 'The Team' },
    stats: { speed: 6, stealth: 6, grit: 7 },
    joust: { lance: 6, shield: 7, hype: 6, traits: ['Magnetic Guard'] },
  });

  const standard = resolveJoust(player, rival, {
    playerTactic: 'boost',
    rivalTactic: 'guard',
    seed: 'band-seed',
    difficulty: 'standard',
  });
  const boss = resolveJoust(player, rival, {
    playerTactic: 'boost',
    rivalTactic: 'guard',
    seed: 'band-seed',
    difficulty: 'boss',
  });

  assert.equal(standard.rival.joust.shield, 7);
  assert.equal(boss.rival.joust.shield, 9);
  assert.ok(boss.strike < standard.strike);
  assert.equal(boss.rewardHints.difficultyMultiplier, 1.5);
});

test('resolveJoust falls back from locked tactics to the first available tactic', () => {
  const player = buildCard({
    id: 'player-lock',
    stats: { speed: 5, stealth: 4, grit: 6 },
    joust: { lance: 7, shield: 6, hype: 7 },
  });
  const rival = createJoustCardSnapshot(buildCard({
    id: 'rival-lock',
    name: 'Vex Static',
  }));

  const result = resolveJoust(player, rival, {
    playerTactic: 'feint',
    rivalTactic: 'guard',
    seed: 'locked-seed',
  });

  assert.equal(result.playerTactic, 'charge');
});
