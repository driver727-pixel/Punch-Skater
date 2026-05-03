import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RACE_DURATION_MS,
  RACE_TICK_MS,
  TICKS_TOTAL,
  buildRaceResult,
  createRaceCardSnapshot,
  resolveRace,
  simulateRace,
} from '../lib/race.js';

function snap(id, stats, name = id) {
  return {
    id,
    name,
    archetype: 'Qu111s',
    rarity: 'Apprentice',
    stats: { speed: 5, range: 5, rangeNm: 5, stealth: 5, grit: 5, ...stats },
  };
}

test('TICKS_TOTAL covers ~30 seconds at 50ms/tick', () => {
  assert.equal(RACE_TICK_MS * TICKS_TOTAL, RACE_DURATION_MS);
  assert.equal(TICKS_TOTAL, 600);
});

test('simulateRace is deterministic for a given seed', () => {
  const c = snap('c1', { speed: 7, grit: 6 });
  const d = snap('d1', { speed: 6, stealth: 7 });
  const a = simulateRace(c, d, 'race-seed-A');
  const b = simulateRace(c, d, 'race-seed-A');
  assert.deepEqual(a, b);
});

test('different seeds produce different races', () => {
  const c = snap('c1', { speed: 6 });
  const d = snap('d1', { speed: 6 });
  const a = simulateRace(c, d, 'seed-1');
  const b = simulateRace(c, d, 'seed-2');
  assert.notDeepEqual(a.timeline.map((tk) => tk.challengerProgress), b.timeline.map((tk) => tk.challengerProgress));
});

test('timeline always has TICKS_TOTAL entries', () => {
  const c = snap('c1');
  const d = snap('d1');
  const sim = simulateRace(c, d, 'len-seed');
  assert.equal(sim.timeline.length, TICKS_TOTAL);
  assert.equal(sim.timeline[0].t, 0);
  assert.equal(sim.timeline[TICKS_TOTAL - 1].t, TICKS_TOTAL - 1);
});

test('progress is monotonically non-decreasing for both racers', () => {
  const c = snap('c1', { speed: 9 });
  const d = snap('d1', { speed: 4 });
  const sim = simulateRace(c, d, 'mono-seed');
  for (let i = 1; i < sim.timeline.length; i += 1) {
    assert.ok(sim.timeline[i].challengerProgress >= sim.timeline[i - 1].challengerProgress);
    assert.ok(sim.timeline[i].defenderProgress >= sim.timeline[i - 1].defenderProgress);
  }
});

test('race always finishes (at least one racer crosses)', () => {
  for (const seed of ['s1', 's2', 's3', 's4', 's5']) {
    const c = snap('c', { speed: 1, grit: 1 });
    const d = snap('d', { speed: 1, grit: 1 });
    const sim = simulateRace(c, d, seed);
    assert.ok(sim.challengerFinishTick !== null || sim.defenderFinishTick !== null,
      `Race for seed ${seed} did not finish`);
  }
});

test('faster speed wins more often than not over many seeds', () => {
  let cWins = 0;
  let dWins = 0;
  for (let i = 0; i < 60; i += 1) {
    const c = snap('c', { speed: 9, grit: 8 });
    const d = snap('d', { speed: 3, grit: 3 });
    const { result } = resolveRace(c, d, { wager: 0, raceSeed: `seed-${i}` });
    if (result.winnerSide === 'challenger') cWins += 1;
    else if (result.winnerSide === 'defender') dWins += 1;
  }
  assert.ok(cWins > dWins,
    `Expected faster card to win majority of races, got challenger=${cWins} defender=${dWins}`);
});

test('buildRaceResult transfers wager to the winner', () => {
  const sim = { challengerFinishTick: 500, defenderFinishTick: 550 };
  const result = buildRaceResult(sim, {
    challengerStats: { speed: 8, range: 5, stealth: 5, grit: 5 },
    defenderStats: { speed: 5, range: 5, stealth: 5, grit: 5 },
    wager: 50,
    raceSeed: 'wager-seed',
  });
  assert.equal(result.winnerSide, 'challenger');
  assert.equal(result.ozzyTransfer.challenger, 50);
  assert.equal(result.ozzyTransfer.defender, -50);
  assert.equal(result.cardDeltas.challenger.ozzies, 50);
  assert.equal(result.cardDeltas.defender.ozzies, -50);
  assert.ok(result.cardDeltas.challenger.xp > result.cardDeltas.defender.xp);
});

test('buildRaceResult treats simultaneous finish as a draw with no Ozzy transfer', () => {
  const sim = { challengerFinishTick: 500, defenderFinishTick: 500 };
  const result = buildRaceResult(sim, {
    challengerStats: { speed: 5, range: 5, stealth: 5, grit: 5 },
    defenderStats: { speed: 5, range: 5, stealth: 5, grit: 5 },
    wager: 25,
    raceSeed: 'draw-seed',
  });
  assert.equal(result.winnerSide, null);
  assert.equal(result.ozzyTransfer.challenger, 0);
  assert.equal(result.ozzyTransfer.defender, 0);
});

test('buildRaceResult handles zero wager (free race)', () => {
  const sim = { challengerFinishTick: 400, defenderFinishTick: 500 };
  const result = buildRaceResult(sim, {
    challengerStats: { speed: 8, range: 5, stealth: 5, grit: 5 },
    defenderStats: { speed: 5, range: 5, stealth: 5, grit: 5 },
    wager: 0,
    raceSeed: 'free-seed',
  });
  assert.equal(result.winnerSide, 'challenger');
  assert.equal(result.ozzyTransfer.challenger, 0);
  assert.equal(result.ozzyTransfer.defender, 0);
});

test('buildRaceResult clamps absurd wager values', () => {
  const sim = { challengerFinishTick: 500, defenderFinishTick: 550 };
  const result = buildRaceResult(sim, {
    challengerStats: { speed: 5, range: 5, stealth: 5, grit: 5 },
    defenderStats: { speed: 5, range: 5, stealth: 5, grit: 5 },
    wager: 9_999_999,
    raceSeed: 'clamp-seed',
  });
  assert.ok(result.ozzyTransfer.challenger <= 100_000);
  assert.equal(result.ozzyTransfer.challenger, 100_000);
});

test('createRaceCardSnapshot extracts stats from a forged card-shaped object', () => {
  const card = {
    id: 'card-1',
    identity: { name: 'Ozzy Q' },
    prompts: { archetype: 'Qu111s' },
    class: { rarity: 'Master' },
    stats: { speed: 9, range: 7, rangeNm: 8, stealth: 6, grit: 5 },
    frameImageUrl: 'https://example.com/frame.png',
  };
  const snapshot = createRaceCardSnapshot(card);
  assert.equal(snapshot.id, 'card-1');
  assert.equal(snapshot.name, 'Ozzy Q');
  assert.equal(snapshot.archetype, 'Qu111s');
  assert.equal(snapshot.rarity, 'Master');
  assert.equal(snapshot.stats.speed, 9);
  assert.equal(snapshot.imageUrl, 'https://example.com/frame.png');
});

test('createRaceCardSnapshot tolerates missing fields with safe defaults', () => {
  const snapshot = createRaceCardSnapshot({});
  assert.equal(snapshot.id, 'unknown');
  assert.equal(snapshot.stats.speed, 5);
  assert.equal(snapshot.stats.grit, 5);
});

test('createRaceCardSnapshot clamps out-of-range stats into [1, 10]', () => {
  const snapshot = createRaceCardSnapshot({ id: 'oob', stats: { speed: 99, grit: -3 } });
  assert.equal(snapshot.stats.speed, 10);
  assert.equal(snapshot.stats.grit, 1);
});
