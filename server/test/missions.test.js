import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HARD_CUTOUT_COUNTER_ID,
  buildMissionActiveRunState,
  createDailyMissionBoardPayload,
  createMissionBoardEntries,
  evaluateMissionDeck,
  getMissionEncounter,
  getMissionEffectiveRewards,
  getWeeklyMissionTheme,
  resolveMissionCounterChoice,
} from '../lib/missions.js';

function buildCard(overrides = {}) {
  return {
    id: overrides.id ?? 'card-default',
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
    maintenance: {
      state: 'active',
      chargePct: 100,
      repairMinutes: 15,
      ...overrides.maintenance,
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

test('createDailyMissionBoardPayload returns a stable daily subset and cadence metadata', () => {
  const first = createDailyMissionBoardPayload('user-123', '2026-04-26T12:00:00.000Z');
  const second = createDailyMissionBoardPayload('user-123', '2026-04-26T19:15:00.000Z');
  assert.equal(first.boardDateKey, '2026-04-26');
  assert.equal(first.dailyResetAt, '2026-04-27T00:00:00.000Z');
  assert.equal(first.missions.length, 4);
  assert.deepEqual(first.missions.map((entry) => entry.id), second.missions.map((entry) => entry.id));
});

test('getMissionEncounter never produces encounter options with undefined reward deltas', () => {
  const missions = createMissionBoardEntries('user-123', '2026-04-26T00:00:00.000Z');
  for (const mission of missions) {
    const encounter = getMissionEncounter(mission);
    if (!encounter) continue;
    for (const option of encounter.options) {
      if ('rewardXpDelta' in option) {
        assert.equal(typeof option.rewardXpDelta, 'number', `${mission.definitionId}/${option.id} rewardXpDelta must be a number when present`);
      }
      if ('rewardOzziesDelta' in option) {
        assert.equal(typeof option.rewardOzziesDelta, 'number', `${mission.definitionId}/${option.id} rewardOzziesDelta must be a number when present`);
      }
    }
  }
});

test('weekly mission themes rotate and softly boost featured districts', () => {
  const theme = getWeeklyMissionTheme('2026-04-26T12:00:00.000Z');
  const payload = createDailyMissionBoardPayload('user-123', '2026-04-26T12:00:00.000Z');
  assert.ok(theme.featuredDistricts.length > 0);
  assert.equal(payload.weeklyTheme.id, theme.id);
  assert.ok(payload.missions.some((entry) => theme.featuredDistricts.includes(entry.district)));
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
  assert.equal(mission.encounter.badge, 'Fork in the road');
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
      stats: { speed: 4, range: 4, stealth: 4, grit: 4 },
    })),
  };

  const result = evaluateMissionDeck(deck, mission, null, 'crusher-lane');
  assert.equal(result.eligible, false);
  assert.match(result.summary, /30 total Grit/i);
});

test('evaluateMissionDeck now lets a generic five-card deck clear the base Grid contract', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-trace');
  const deck = {
    id: 'deck-4',
    name: 'Loose Stack',
    cards: Array.from({ length: 5 }, (_, index) => buildCard({
      prompts: { archetype: 'Qu111s' },
      identity: { crew: 'Qu111s' },
      stats: { speed: 5 + index, range: 4, stealth: 4, grit: 4 },
    })),
  };

  const result = evaluateMissionDeck(deck, mission);
  assert.equal(result.eligible, true);
  assert.equal(result.results.some((entry) => entry.requirement.type === 'archetype'), false);
  assert.equal(result.results.find((entry) => entry.requirement.type === 'min_cards')?.needed, 5);
});

test('evaluateMissionDeck ignores cards that are still in repair timeout', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-trace');
  const deck = {
    id: 'deck-5',
    name: 'Bruised Stack',
    cards: Array.from({ length: 5 }, (_, index) => buildCard({
      id: `card-${index + 1}`,
      prompts: { archetype: 'Qu111s' },
      identity: { crew: 'Qu111s' },
      stats: { speed: 5 + index, range: 4, stealth: 4, grit: 4 },
      ...(index === 0 ? { maintenance: { state: 'in_shop', repairEndsAt: '2999-01-01T00:00:00.000Z' } } : {}),
    })),
  };

  const result = evaluateMissionDeck(deck, mission);
  assert.equal(result.eligible, false);
  assert.match(result.summary, /4\/5 cards ready for the run/i);
  assert.equal(result.results.find((entry) => entry.requirement.type === 'min_cards')?.current, 4);
});

test('getMissionEffectiveRewards includes selected fork bonuses', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-trace');
  const rewards = getMissionEffectiveRewards(mission, 'data-snatch');
  assert.deepEqual(rewards, { rewardXp: 220, rewardOzzies: 165 });
});

test('evaluateMissionDeck surfaces dynamic hardware effects and live hand metadata', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'airaway-sky-lane');
  const deck = {
    id: 'deck-live-1',
    name: 'Glass Burners',
    cards: Array.from({ length: 5 }, (_, index) => buildCard({
      id: `live-card-${index + 1}`,
      stats: { speed: 7 + index, range: 5, stealth: 5, grit: 4 },
      board: { config: { boardType: 'Street', wheels: 'Urethane' } },
    })),
  };

  const result = evaluateMissionDeck(deck, mission);
  assert.equal(result.eligible, true);
  assert.ok(result.activeCardIds?.length > 0);
  assert.ok(result.statusEffects?.some((effect) => effect.id === 'mainline-burst'));
});

test('buildMissionActiveRunState creates a pending live encounter with available counters', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-parent-trace');
  const deck = {
    id: 'deck-live-2',
    name: 'Trace Breakers',
    cards: [
      buildCard({
        id: 'counter-1',
        prompts: { archetype: 'The Knights Technarchy', district: 'The Grid' },
        identity: { crew: 'The Knights Technarchy' },
        stats: { speed: 8, range: 6, stealth: 7, grit: 5 },
        board: { config: { boardType: 'Street', wheels: 'Urethane' } },
      }),
      buildCard({
        id: 'counter-2',
        prompts: { archetype: 'Qu111s', district: 'The Grid' },
        identity: { crew: 'Qu111s' },
        stats: { speed: 7, range: 7, stealth: 6, grit: 4 },
      }),
      ...Array.from({ length: 3 }, (_, index) => buildCard({
        id: `counter-extra-${index + 1}`,
        stats: { speed: 6, range: 6, stealth: 5, grit: 5 },
      })),
    ],
  };

  const runState = buildMissionActiveRunState(deck, mission);
  assert.equal(runState.phase, 'event');
  assert.equal(runState.activeCardIds.length, 3);
  assert.ok(runState.availableCounterOptionIds.length > 0);
  assert.ok(getMissionEncounter(mission).options.length >= 3);
});

test('resolveMissionCounterChoice returns selected encounter rewards when the hand can answer', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-parent-trace');
  const deck = {
    id: 'deck-live-3',
    name: 'Archive Ghosts',
    cards: [
      buildCard({
        id: 'ghost-1',
        prompts: { archetype: 'The Knights Technarchy', district: 'Nightshade' },
        identity: { crew: 'The Knights Technarchy' },
        stats: { speed: 8, range: 6, stealth: 8, grit: 4 },
      }),
      buildCard({
        id: 'ghost-2',
        prompts: { archetype: 'Qu111s', district: 'Nightshade' },
        identity: { crew: 'Qu111s' },
        stats: { speed: 7, range: 7, stealth: 7, grit: 4 },
      }),
      ...Array.from({ length: 3 }, (_, index) => buildCard({
        id: `ghost-extra-${index + 1}`,
        stats: { speed: 6, range: 6, stealth: 5, grit: 5 },
      })),
    ],
  };

  const runState = buildMissionActiveRunState(deck, mission);
  const selectedId = runState.availableCounterOptionIds[0];
  const resolution = resolveMissionCounterChoice(mission, runState, selectedId);
  assert.equal(resolution.hardCutout, false);
  assert.equal(resolution.selectedOption?.id, selectedId);
});

test('resolveMissionCounterChoice clips rewards for a hard cutout', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'glass-city-exchange');
  const resolution = resolveMissionCounterChoice(mission, null, HARD_CUTOUT_COUNTER_ID);
  assert.equal(resolution.hardCutout, true);
  assert.equal(resolution.rewardXpDelta, -20);
  assert.equal(resolution.rewardOzziesDelta, -20);
});
