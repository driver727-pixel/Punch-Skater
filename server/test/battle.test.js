import test from 'node:test';
import assert from 'node:assert/strict';
import { createBattleCardSnapshot, resolveBattleWithEffects } from '../battle.js';

function createCard(id, stats, archetype = 'Qu111s') {
  return createBattleCardSnapshot({
    id,
    archetype,
    prompts: { archetype },
    stats,
  });
}

test('resolveBattleWithEffects is deterministic for a given seed', () => {
  const challenger = [
    createCard('c1', { speed: 8, stealth: 7, tech: 6, grit: 5, rep: 4 }),
    createCard('c2', { speed: 7, stealth: 7, tech: 6, grit: 5, rep: 5 }),
  ];
  const defender = [
    createCard('d1', { speed: 5, stealth: 5, tech: 5, grit: 5, rep: 5 }, 'Ne0n Legion'),
    createCard('d2', { speed: 4, stealth: 4, tech: 4, grit: 4, rep: 4 }, 'Ne0n Legion'),
  ];

  const first = resolveBattleWithEffects(challenger, defender, 'battle-seed');
  const second = resolveBattleWithEffects(challenger, defender, 'battle-seed');
  assert.deepEqual(first, second);
  assert.equal(first.winnerSide, 'challenger');
});

test('createBattleCardSnapshot clamps forged and legacy stats onto the live 1-10 scale', () => {
  assert.deepEqual(
    createBattleCardSnapshot({
      id: 'card-forged',
      prompts: {},
      stats: { speed: 999999, stealth: 200, tech: 100, grit: -5, rep: 'not-a-number' },
    }),
    {
      id: 'card-forged',
      archetype: undefined,
      stats: {
        speed: 10,
        stealth: 10,
        tech: 5, // legacy 1-200 scale value rescaled like the client
        grit: 1,
        rep: 1,
      },
    },
  );
});

test('createBattleCardSnapshot clamps missing stats to minimum numeric values', () => {
  assert.deepEqual(
    createBattleCardSnapshot({ id: 'card-1', stats: { speed: 9 }, prompts: {} }),
    {
      id: 'card-1',
      archetype: undefined,
      stats: {
        speed: 9,
        stealth: 1,
        tech: 1,
        grit: 1,
        rep: 1,
      },
    },
  );
});
