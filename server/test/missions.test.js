import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionBoardEntries, evaluateMissionDeck, getMissionEffectiveRewards } from '../lib/missions.js';

function buildCard(overrides = {}) {
  return {
    prompts: {
      archetype: 'The Knights Technarchy',
      district: 'The Grid',
      ...overrides.prompts,
    },
    identity: {
      crew: 'The Knights Technarchy',
      ...overrides.identity,
    },
    stats: {
      speed: 8,
      range: 6,
      stealth: 4,
      grit: 5,
      ...overrides.stats,
    },
    board: {
      config: {
        boardType: 'Street',
        wheels: 'Urethane',
        ...overrides.board?.config,
      },
    },
  };
}

test('createMissionBoardEntries seeds one entry per mission definition', () => {
  const missions = createMissionBoardEntries('user-123', '2026-04-26T00:00:00.000Z');
  assert.equal(missions.length, 10);
  assert.equal(missions[0].uid, 'user-123');
  assert.equal(missions[0].system, 'mission_board');
  assert.equal(missions[0].schemaVersion, 2);
});

test('evaluateMissionDeck passes an eligible deck for the Grid Trace contract', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-trace');
  const deck = {
    id: 'deck-1',
    name: 'Trace Stack',
    cards: Array.from({ length: 6 }, (_, index) => buildCard({
      stats: { speed: 6 + index, range: 4, stealth: 4, grit: 4 },
    })),
  };

  const result = evaluateMissionDeck(deck, mission);
  assert.equal(result.eligible, true);
  assert.equal(result.results.every((entry) => entry.met), true);
});

test('evaluateMissionDeck fails when the deck lacks district-ready wheels', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'forest-rootline');
  const deck = {
    id: 'deck-2',
    name: 'Bad Wheels',
    cards: Array.from({ length: 6 }, () => buildCard({
      prompts: { district: 'The Forest' },
      board: { config: { boardType: 'Street', wheels: 'Urethane' } },
    })),
  };

  const result = evaluateMissionDeck(deck, mission);
  assert.equal(result.eligible, false);
  assert.match(result.summary, /Pneumatic \/ Rubber|couriers can currently enter|mission requirements/i);
});

test('mission board entries seed fork choices on restored missions', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'batteryville-breaker-yard');
  assert.equal(mission.fork.badge, 'Fork in the road');
  assert.equal(mission.fork.options.length, 2);
  assert.equal(mission.fork.options[0].id, 'crusher-lane');
});

test('new lore missions can seed three-way fork choices', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-parent-trace');
  assert.equal(mission.fork.badge, 'Archive fracture');
  assert.equal(mission.fork.options.length, 3);
  assert.equal(mission.fork.options[2].id, 'worker-trace');
});

test('evaluateMissionDeck applies selected fork requirements', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'batteryville-breaker-yard');
  const deck = {
    id: 'deck-3',
    name: 'Relay Stack',
    cards: Array.from({ length: 6 }, (_, index) => buildCard({
      prompts: { district: index < 2 ? 'Batteryville' : 'The Grid' },
      board: { config: { boardType: 'Street', wheels: 'Rubber' } },
      stats: { speed: 4, range: 4, stealth: 4, grit: 5 },
    })),
  };

  const result = evaluateMissionDeck(deck, mission, null, 'crusher-lane');
  assert.equal(result.eligible, false);
  assert.match(result.summary, /32 total Grit/i);
});

test('getMissionEffectiveRewards includes selected fork bonuses', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-trace');
  const rewards = getMissionEffectiveRewards(mission, 'data-snatch');
  assert.deepEqual(rewards, { rewardXp: 220, rewardOzzies: 165 });
});
