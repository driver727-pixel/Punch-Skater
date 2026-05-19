import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HARD_CUTOUT_COUNTER_ID,
  applyMissionRivalRecord,
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
    ...(overrides.joust ? { joust: overrides.joust } : {}),
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
  assert.equal(first.missions.length, 6);
  assert.deepEqual(first.missions.map((entry) => entry.id), second.missions.map((entry) => entry.id));
});

test('createDailyMissionBoardPayload swaps in a playable contract when the default slice bricks every deck', () => {
  const genericDeck = {
    id: 'deck-generic',
    name: 'Loose Stack',
    cards: Array.from({ length: 5 }, (_, index) => buildCard({
      prompts: { archetype: 'Qu111s', district: 'The Grid' },
      identity: { crew: 'Qu111s' },
      stats: { speed: 5 + index, range: 4, stealth: 4, grit: 4 },
      board: { config: { boardType: 'Street', wheels: 'Urethane' } },
    })),
  };

  const baselinePayload = createDailyMissionBoardPayload('user-123', '2026-05-11T12:00:00.000Z');
  assert.equal(baselinePayload.missions.some((entry) => evaluateMissionDeck(genericDeck, entry).eligible), false);

  const rescuedPayload = createDailyMissionBoardPayload('user-123', '2026-05-11T12:00:00.000Z', {
    decks: [genericDeck],
  });
  assert.equal(rescuedPayload.missions.length, 6);
  assert.equal(rescuedPayload.missions.some((entry) => evaluateMissionDeck(genericDeck, entry).eligible), true);
});

test('getMissionEncounter never produces encounter options with undefined reward deltas', () => {
  const missions = createMissionBoardEntries('user-123', '2026-04-26T00:00:00.000Z');
  for (const mission of missions) {
    const encounter = getMissionEncounter(mission);
    if (!encounter) continue;
    assert.ok(encounter.options.some((option) => option.encounterType === 'joust'));
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

test('rainy weather raises mission payout and adds pressure without blocking district access', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'nightshade-tunnel-run');
  const weatherPayload = {
    districts: [{
      district: 'Nightshade',
      city: 'Perth',
      state: 'WA',
      summary: 'Rain',
      temperatureC: 18,
      windSpeedKph: 10,
      rainMm: 2,
      weatherCode: 61,
      updatedAt: '2026-05-04T00:00:00.000Z',
      accessRule: null,
    }],
  };
  const deck = {
    id: 'deck-rain-1',
    name: 'Wet Work',
    cards: Array.from({ length: 5 }, (_, index) => buildCard({
      prompts: { district: index < 2 ? 'Nightshade' : 'The Grid', archetype: 'Qu111s' },
      identity: { crew: 'Qu111s' },
      board: { config: { boardType: 'Street', wheels: 'Cloud' } },
      stats: { speed: 6, range: 6, stealth: 6, grit: 5 },
    })),
  };

  const result = evaluateMissionDeck(deck, mission, weatherPayload);
  const rewards = getMissionEffectiveRewards(mission, null, weatherPayload);

  assert.equal(result.eligible, true);
  assert.ok(result.statusEffects?.some((effect) => effect.id === 'rain-slick-route'));
  assert.equal(result.counterPower, 0);
  assert.deepEqual(rewards, { rewardXp: 205, rewardOzzies: 120 });
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
        stats: { speed: 8, range: 7, stealth: 6, grit: 4 },
        board: { config: { boardType: 'Street', wheels: 'Urethane' } },
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
  assert.ok(runState.boardPlaystyles?.some((playstyle) => playstyle.id === 'full-noise-sprinter'));
  assert.equal(runState.storyBeats?.length, 3);
});

test('buildMissionActiveRunState treats multi-tag requirement hints as alternatives within one requirement', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-parent-trace');
  const deck = {
    id: 'deck-live-ghost-query',
    name: 'Ghost Query',
    cards: [
      buildCard({
        id: 'ghost-query-1',
        prompts: { archetype: 'Qu111s', district: 'The Grid' },
        identity: { crew: 'Qu111s' },
        stats: { speed: 7, range: 6, stealth: 8, grit: 4 },
      }),
      buildCard({
        id: 'ghost-query-2',
        prompts: { archetype: 'Qu111s', district: 'Batteryville' },
        identity: { crew: 'Qu111s' },
        stats: { speed: 7, range: 6, stealth: 6, grit: 5 },
      }),
      ...Array.from({ length: 3 }, (_, index) => buildCard({
        id: `ghost-query-extra-${index + 1}`,
        prompts: { archetype: 'Qu111s', district: 'Batteryville' },
        identity: { crew: 'Qu111s' },
        stats: { speed: 6, range: 6, stealth: 5, grit: 5 },
      })),
    ],
  };

  const runState = buildMissionActiveRunState(deck, mission);
  assert.ok(runState.availableCounterOptionIds.includes('ghost-query'));
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
  const resolution = resolveMissionCounterChoice(mission, deck, runState, selectedId);
  assert.equal(resolution.hardCutout, false);
  assert.equal(resolution.selectedOption?.id, selectedId);
});

test('resolveMissionCounterChoice clips rewards for a hard cutout', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'glass-city-exchange');
  const resolution = resolveMissionCounterChoice(mission, { id: 'deck-cutout', name: 'Cutout', cards: [] }, null, HARD_CUTOUT_COUNTER_ID);
  assert.equal(resolution.hardCutout, true);
  assert.equal(resolution.rewardXpDelta, -20);
  assert.equal(resolution.rewardOzziesDelta, -20);
});

test('resolveMissionCounterChoice can settle a district joust with tactic-selected bonus rewards', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'nightshade-moonrise-echo');
  const deck = {
    id: 'deck-joust-1',
    name: 'Moonrise Duelists',
    cards: [
      buildCard({
        id: 'duelist-1',
        name: 'Signal Flash',
        identity: { name: 'Signal Flash', crew: 'Qu111s' },
        prompts: { archetype: 'Qu111s', district: 'Nightshade' },
        stats: { speed: 8, range: 6, stealth: 8, grit: 5 },
        board: { config: { boardType: 'Street', wheels: 'Cloud' } },
        joust: { lance: 8, shield: 6, hype: 8, traits: ['Neon Flourish'] },
      }),
      buildCard({
        id: 'duelist-2',
        prompts: { archetype: 'The Knights Technarchy', district: 'Nightshade' },
        identity: { crew: 'The Knights Technarchy' },
        stats: { speed: 7, range: 7, stealth: 7, grit: 5 },
      }),
      ...Array.from({ length: 3 }, (_, index) => buildCard({
        id: `duelist-extra-${index + 1}`,
        stats: { speed: 6, range: 6, stealth: 5, grit: 5 },
      })),
    ],
  };

  const runState = buildMissionActiveRunState(deck, mission);
  const resolution = resolveMissionCounterChoice(mission, deck, runState, 'district-joust', 'trickStrike');

  assert.equal(resolution.hardCutout, false);
  assert.equal(resolution.selectedOption?.encounterType, 'joust');
  assert.equal(resolution.joustResult?.playerTactic, 'trickStrike');
  assert.equal(resolution.joustResult?.rivalId, 'nightshade-rook-wraith');
  assert.equal(resolution.joustResult?.rivalName, 'Rook Wraith');
  assert.ok(['win', 'draw', 'loss'].includes(resolution.joustResult?.outcome));
  assert.ok(resolution.rewardXpDelta >= (resolution.joustResult?.rewardXpBonus ?? 0));
  assert.ok(resolution.rewardOzziesDelta >= (resolution.joustResult?.rewardOzziesBonus ?? 0));
});

test('resolveMissionCounterChoice adds expressive reward signals on a grudge rematch win', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'glass-city-exchange');
  const deck = {
    id: 'deck-rematch-1',
    name: 'Highlight Hunters',
    cards: [
      buildCard({
        id: 'showpony-1',
        name: 'Halo Breaker',
        identity: { name: 'Halo Breaker', crew: 'The Team' },
        prompts: { archetype: 'The Team', district: 'Glass City' },
        stats: { speed: 9, range: 7, stealth: 8, grit: 6 },
        board: { config: { boardType: 'Surf', wheels: 'Cloud' } },
        joust: {
          lance: 9,
          shield: 7,
          hype: 9,
          gear: { boardType: 'Surf', lanceType: 'neon', shieldType: 'banner', armorTag: 'spotlight shell' },
          traits: ['Neon Flourish', 'Boost Charge'],
        },
      }),
      buildCard({
        id: 'showpony-2',
        prompts: { archetype: 'Qu111s', district: 'Glass City' },
        identity: { crew: 'Qu111s' },
        stats: { speed: 8, range: 6, stealth: 8, grit: 5 },
        board: { config: { boardType: 'Slider', wheels: 'Cloud' } },
      }),
      ...Array.from({ length: 3 }, (_, index) => buildCard({
        id: `showpony-extra-${index + 1}`,
        prompts: { district: 'Glass City' },
        stats: { speed: 7, range: 6, stealth: 7, grit: 5 },
        board: { config: { boardType: 'Surf', wheels: 'Cloud' } },
      })),
    ],
  };

  const rivalRecords = {
    'glass-city-nova-saint': {
      rivalId: 'glass-city-nova-saint',
      wins: 0,
      losses: 2,
      draws: 0,
      seenCount: 2,
      lastOutcome: 'loss',
      streak: -2,
      lastSeenAt: '2026-05-01T00:00:00.000Z',
    },
  };
  const runState = buildMissionActiveRunState(deck, mission, null, '2026-05-16T00:00:00.000Z', rivalRecords);
  const resolution = resolveMissionCounterChoice(mission, deck, runState, 'district-joust', 'trickStrike');

  assert.equal(runState.rivalPressure?.status, 'grudge');
  assert.ok((resolution.rewardSignals ?? []).length > 0);
  assert.ok((resolution.storyBeats ?? []).some((beat) => beat.stage === 'finish'));
  if (resolution.joustResult?.outcome === 'win') {
    assert.ok((resolution.rewardSignals ?? []).some((signal) => signal.id === 'highlight-reel'));
  }
});

test('applyMissionRivalRecord tracks repeat rival outcomes and streak direction', () => {
  const first = applyMissionRivalRecord('grid-vex-static', 'loss', {}, '2026-05-16T00:00:00.000Z');
  const second = applyMissionRivalRecord('grid-vex-static', 'win', first, '2026-05-17T00:00:00.000Z');

  assert.equal(first['grid-vex-static'].losses, 1);
  assert.equal(first['grid-vex-static'].streak, -1);
  assert.equal(second['grid-vex-static'].wins, 1);
  assert.equal(second['grid-vex-static'].seenCount, 2);
  assert.equal(second['grid-vex-static'].streak, 1);
});

test('mission encounters pull named rival data for first-wave districts', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-parent-trace');
  const encounter = getMissionEncounter(mission);
  const joustOption = encounter.options.find((option) => option.id === 'district-joust');
  assert.equal(joustOption?.label, 'Vex Static trace joust');
  assert.match(joustOption?.description ?? '', /Vex Static/i);
});

test('district rival progression awards only unlock on mission-joust wins', () => {
  const mission = createMissionBoardEntries('user-123').find((entry) => entry.definitionId === 'grid-parent-trace');
  const deck = {
    id: 'deck-joust-2',
    name: 'Trace Winners',
    cards: [
      buildCard({
        id: 'winner-1',
        name: 'Trace Burner',
        identity: { name: 'Trace Burner', crew: 'The Knights Technarchy' },
        prompts: { archetype: 'The Knights Technarchy', district: 'The Grid' },
        stats: { speed: 9, range: 8, stealth: 8, grit: 6 },
        board: { config: { boardType: 'Street', wheels: 'Urethane' } },
        joust: {
          lance: 9,
          shield: 8,
          hype: 8,
          gear: { boardType: 'Street', lanceType: 'kinetic', shieldType: 'riot', armorTag: 'trace shell' },
          traits: ['Street Parry', 'Magnetic Guard'],
        },
      }),
      ...Array.from({ length: 4 }, (_, index) => buildCard({
        id: `winner-extra-${index + 1}`,
        stats: { speed: 6, range: 6, stealth: 5, grit: 5 },
      })),
    ],
  };

  const runState = buildMissionActiveRunState(deck, mission);
  const resolution = resolveMissionCounterChoice(mission, deck, runState, 'district-joust', 'counter');
  assert.equal(resolution.joustResult?.rivalId, 'grid-vex-static');
  if (resolution.joustResult?.outcome === 'win') {
    assert.deepEqual(resolution.joustResult.loreUnlockIds, ['codex-rival-vex-static']);
    assert.equal(resolution.joustResult.cardRewardId, 'card-reward-static-trace');
    assert.equal(resolution.joustResult.districtReputationDelta, 40);
  } else {
    assert.equal(resolution.joustResult?.loreUnlockIds, undefined);
    assert.equal(resolution.joustResult?.cardRewardId, undefined);
    assert.equal(resolution.joustResult?.districtReputationDelta, undefined);
  }
});
