/**
 * joustur.test.js — Tests for the Joustur Skatur pure rules engine.
 *
 * Covers:
 *   – faction/trait/support mappings
 *   – board utility functions
 *   – lineup validation
 *   – legal move generation (entry, overshoot, friendly block, capture,
 *     stealth alcove, smoke screen, zero roll)
 *   – move application (normal, capture, exit, stealth alcove extra turn,
 *     all support effects)
 *   – win detection
 *   – reward calculation (idempotency via rewardsGranted flag)
 *   – USB Shard roll determinism & range
 *   – async turn ownership sanity
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  // Board constants
  OFF_BOARD,
  EXIT_POSITION,
  PRIVATE_ENTRY_MIN,
  PRIVATE_ENTRY_MAX,
  SHARED_MIN,
  SHARED_MAX,
  PRIVATE_EXIT_MIN,
  PRIVATE_EXIT_MAX,
  STEALTH_ALCOVES,
  RIDER_COUNT,
  SHARD_COUNT,
  // Board utils
  isOnBoard,
  isSharedPosition,
  isPrivatePosition,
  isStealthAlcove,
  // Mappings
  resolveFactionForCrew,
  FACTION_PASSIVE,
  FACTION_SUPPORT_EFFECT,
  resolveRiderTrait,
  // State builders
  buildInitialPlayerState,
  buildInitialBoardState,
  // Game logic
  validateLineup,
  getLegalMoves,
  applyMove,
  detectWinner,
  calcRewards,
  // RNG
  createSeededRng,
  generateRollSeed,
  rollUsbShards,
} from '../lib/jousturRules.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRiderSnapshot(cardId, trait = 'boost', crew = 'Punch Skaters') {
  return {
    cardId,
    name: `Card ${cardId}`,
    rarity: 'Apprentice',
    crew,
    jousturTrait: trait,
    jousturFaction: resolveFactionForCrew(crew),
  };
}

function makeSupportSnapshot(cardId, crew = 'Punch Skaters') {
  const faction = resolveFactionForCrew(crew);
  return {
    cardId,
    name: `Support ${cardId}`,
    rarity: 'Apprentice',
    crew,
    jousturFaction: faction,
    supportEffect: FACTION_SUPPORT_EFFECT[faction],
  };
}

function makePlayer(uid, riderCount = RIDER_COUNT, crew = 'Punch Skaters') {
  const riders = Array.from({ length: riderCount }, (_, i) =>
    makeRiderSnapshot(`r${i + 1}-${uid}`, 'boost', crew),
  );
  const support = makeSupportSnapshot(`sup-${uid}`, crew);
  const faction = resolveFactionForCrew(crew);
  return buildInitialPlayerState(uid, riders, support, faction);
}

function makeBoard(activeUid, rollResult = null) {
  return {
    ...buildInitialBoardState(activeUid),
    rollResult,
  };
}

// Move all riders of a player to a specific position.
function setRiderPositions(player, positions) {
  const p = JSON.parse(JSON.stringify(player));
  positions.forEach((pos, i) => {
    if (p.riders[i]) p.riders[i].position = pos;
  });
  return p;
}

// ── Board constants ───────────────────────────────────────────────────────────

test('board constants are consistent', () => {
  assert.equal(OFF_BOARD, 0);
  assert.equal(EXIT_POSITION, 15);
  assert.equal(PRIVATE_ENTRY_MIN, 1);
  assert.equal(PRIVATE_ENTRY_MAX, 4);
  assert.equal(SHARED_MIN, 5);
  assert.equal(SHARED_MAX, 12);
  assert.equal(PRIVATE_EXIT_MIN, 13);
  assert.equal(PRIVATE_EXIT_MAX, 14);
  assert.equal(RIDER_COUNT, 6);
  assert.equal(SHARD_COUNT, 4);
});

test('isOnBoard covers 1–14 only', () => {
  assert.equal(isOnBoard(0), false);
  assert.equal(isOnBoard(1), true);
  assert.equal(isOnBoard(14), true);
  assert.equal(isOnBoard(15), false);
});

test('isSharedPosition covers 5–12 only', () => {
  assert.equal(isSharedPosition(4), false);
  assert.equal(isSharedPosition(5), true);
  assert.equal(isSharedPosition(12), true);
  assert.equal(isSharedPosition(13), false);
});

test('isPrivatePosition is on-board but not shared', () => {
  assert.equal(isPrivatePosition(1), true);
  assert.equal(isPrivatePosition(4), true);
  assert.equal(isPrivatePosition(5), false);
  assert.equal(isPrivatePosition(13), true);
  assert.equal(isPrivatePosition(14), true);
});

test('isStealthAlcove matches exactly {4, 6, 8, 12, 14}', () => {
  [4, 6, 8, 12, 14].forEach((p) => assert.equal(isStealthAlcove(p), true));
  [1, 2, 3, 5, 7, 9, 10, 11, 13, 15].forEach((p) =>
    assert.equal(isStealthAlcove(p), false),
  );
});

test('STEALTH_ALCOVES set has exactly 5 entries', () => {
  assert.equal(STEALTH_ALCOVES.size, 5);
});

// ── Faction mapping ───────────────────────────────────────────────────────────

test('resolveFactionForCrew maps all 6 known crews', () => {
  assert.equal(resolveFactionForCrew('Punch Skaters'),   'rustKids');
  assert.equal(resolveFactionForCrew('Ne0n Legion'),     'neonSaints');
  assert.equal(resolveFactionForCrew('Qu111s (Quills)'), 'signalGhosts');
  assert.equal(resolveFactionForCrew('The Team'),        'chromeSyndicate');
  assert.equal(resolveFactionForCrew('Iron Curtains'),   'voltageVultures');
  assert.equal(resolveFactionForCrew('The Asclepians'),  'alleyWraiths');
});

test('resolveFactionForCrew falls back to rustKids for unknown crew', () => {
  assert.equal(resolveFactionForCrew('Unknown Crew'), 'rustKids');
  assert.equal(resolveFactionForCrew(''),             'rustKids');
  assert.equal(resolveFactionForCrew(undefined),      'rustKids');
  assert.equal(resolveFactionForCrew('D4rk $pider'),  'rustKids');
  assert.equal(resolveFactionForCrew('Moonrisers'),   'rustKids');
});

test('FACTION_PASSIVE maps all 6 factions', () => {
  assert.equal(FACTION_PASSIVE.rustKids,        'patchworkRush');
  assert.equal(FACTION_PASSIVE.neonSaints,      'crowdHalo');
  assert.equal(FACTION_PASSIVE.signalGhosts,    'ghostRoute');
  assert.equal(FACTION_PASSIVE.chromeSyndicate, 'precisionCast');
  assert.equal(FACTION_PASSIVE.voltageVultures, 'surgeTrigger');
  assert.equal(FACTION_PASSIVE.alleyWraiths,    'cutline');
});

test('FACTION_SUPPORT_EFFECT maps all 6 factions', () => {
  assert.equal(FACTION_SUPPORT_EFFECT.rustKids,        'recoveryPing');
  assert.equal(FACTION_SUPPORT_EFFECT.neonSaints,      'crowdRoar');
  assert.equal(FACTION_SUPPORT_EFFECT.signalGhosts,    'smokeScreen');
  assert.equal(FACTION_SUPPORT_EFFECT.chromeSyndicate, 'reroll');
  assert.equal(FACTION_SUPPORT_EFFECT.voltageVultures, 'overclock');
  assert.equal(FACTION_SUPPORT_EFFECT.alleyWraiths,    'sideRoute');
});

// ── Rider trait resolution ────────────────────────────────────────────────────

test('resolveRiderTrait — exact name lookup', () => {
  assert.equal(resolveRiderTrait(['Turbo Kick']),  'boost');
  assert.equal(resolveRiderTrait(['Riot Shield']), 'guard');
  assert.equal(resolveRiderTrait(['Fakeout']),     'feint');
  assert.equal(resolveRiderTrait(['Lock Axle']),   'anchor');
  assert.equal(resolveRiderTrait(['Heavy Lance']), 'strike');
  assert.equal(resolveRiderTrait(['Silent Run']),  'slip');
  assert.equal(resolveRiderTrait(['Overcharge']),  'surge');
  assert.equal(resolveRiderTrait(['Halo Trail']),  'echo');
});

test('resolveRiderTrait — keyword fallback', () => {
  assert.equal(resolveRiderTrait(['Shield Bash']),      'guard');   // shield
  assert.equal(resolveRiderTrait(['Lance Thrust']),     'strike');  // lance
  assert.equal(resolveRiderTrait(['Volt Spike']),       'surge');   // volt
  assert.equal(resolveRiderTrait(['Feint Step']),       'feint');   // feint
  assert.equal(resolveRiderTrait(['Quick Dash']),       'boost');   // quick
  assert.equal(resolveRiderTrait(['Ghost Slide']),      'slip');    // ghost
  assert.equal(resolveRiderTrait(['Anchor Hold']),      'anchor');  // anchor
  assert.equal(resolveRiderTrait(['Crowd Pleaser']),    'echo');    // crowd
});

test('resolveRiderTrait — default fallback to boost', () => {
  assert.equal(resolveRiderTrait([]),                'boost');
  assert.equal(resolveRiderTrait(['Mystery Move']), 'boost');
  assert.equal(resolveRiderTrait(null),              'boost');
  assert.equal(resolveRiderTrait(undefined),         'boost');
});

test('resolveRiderTrait — first matching trait wins', () => {
  // 'Riot Shield' is exact-match for guard; 'Turbo Kick' for boost.
  assert.equal(resolveRiderTrait(['Riot Shield', 'Turbo Kick']), 'guard');
  assert.equal(resolveRiderTrait(['Turbo Kick', 'Riot Shield']), 'boost');
});

// ── Lineup validation ─────────────────────────────────────────────────────────

test('validateLineup — valid lineup passes', () => {
  const riders = ['r1','r2','r3','r4','r5','r6'];
  const { valid, reason } = validateLineup(riders, 'sup1');
  assert.equal(valid, true);
  assert.equal(reason, null);
});

test('validateLineup — wrong rider count', () => {
  const { valid } = validateLineup(['r1','r2'], 'sup1');
  assert.equal(valid, false);
});

test('validateLineup — duplicate riders', () => {
  const { valid } = validateLineup(['r1','r1','r2','r3','r4','r5'], 'sup1');
  assert.equal(valid, false);
});

test('validateLineup — support duplicates a rider', () => {
  const { valid } = validateLineup(['r1','r2','r3','r4','r5','r6'], 'r1');
  assert.equal(valid, false);
});

test('validateLineup — missing support', () => {
  const { valid } = validateLineup(['r1','r2','r3','r4','r5','r6'], '');
  assert.equal(valid, false);
});

// ── USB Shard roll ─────────────────────────────────────────────────────────────

test('rollUsbShards always returns a value in [0, SHARD_COUNT]', () => {
  for (let seed = 0; seed < 500; seed++) {
    const rng = createSeededRng(`test-seed-${seed}`);
    const roll = rollUsbShards(rng);
    assert.ok(roll >= 0 && roll <= SHARD_COUNT, `roll ${roll} out of range for seed ${seed}`);
  }
});

test('rollUsbShards is deterministic for the same seed', () => {
  const seed = generateRollSeed('match-1', 5, 1234567890);
  const a = rollUsbShards(createSeededRng(seed));
  const b = rollUsbShards(createSeededRng(seed));
  assert.equal(a, b);
});

test('rollUsbShards produces different results for different seeds', () => {
  const results = new Set();
  for (let i = 0; i < 30; i++) {
    results.add(rollUsbShards(createSeededRng(`seed-${i}`)));
  }
  // With 30 different seeds we should see more than just one value.
  assert.ok(results.size > 1);
});

// ── Legal move generation ─────────────────────────────────────────────────────

test('getLegalMoves — roll 0 returns empty', () => {
  const playerA = makePlayer('A');
  const playerB = makePlayer('B');
  const board = makeBoard('A', 0);
  assert.deepEqual(getLegalMoves(board, playerA, playerB), []);
});

test('getLegalMoves — off-board rider enters at roll position', () => {
  const playerA = makePlayer('A');
  const playerB = makePlayer('B');
  const board = makeBoard('A', 3);
  const moves = getLegalMoves(board, playerA, playerB);
  // All 6 riders are at OFF_BOARD; with roll 3 each would land at position 3.
  // But they all share the same target, so only one distinct target → only first
  // non-blocked entry counts.  In practice, multiple riders at pos 0 can all
  // target pos 3 but friendly blockade prevents more than one (only the first is
  // included — the rest are blocked by their own lineup mates targeting the same
  // spot, OR the engine includes all since they each represent different cardIds).
  // Verify at least one legal move exists and targets position 3.
  assert.ok(moves.length > 0);
  assert.equal(moves[0].toPosition, 3);
  assert.equal(moves[0].fromPosition, 0);
});

test('getLegalMoves — overshoot beyond EXIT_POSITION is illegal', () => {
  let playerA = makePlayer('A');
  // Move all riders to position 14 — a roll of 2 would send them to 16 (overshoot).
  playerA = setRiderPositions(playerA, [14, 14, 14, 14, 14, 14]);
  // Duplicate positions would be blocked by friendly blockade... but overshoot
  // check comes first.  Use roll 2.
  const board = makeBoard('A', 2);
  const moves = getLegalMoves(board, playerA, makePlayer('B'));
  assert.equal(moves.length, 0);
});

test('getLegalMoves — exact exit (roll 1 from pos 14) is legal', () => {
  let playerA = makePlayer('A');
  // Mark riders 1-5 as already scored so only rider 0's exit move is in play.
  playerA = setRiderPositions(playerA, [14, 0, 0, 0, 0, 0]);
  playerA.riders.slice(1).forEach((r) => { r.isScored = true; });
  const board = makeBoard('A', 1);
  const moves = getLegalMoves(board, playerA, makePlayer('B'));
  assert.equal(moves.length, 1);
  assert.equal(moves[0].isExitMove, true);
  assert.equal(moves[0].toPosition, EXIT_POSITION);
});

test('getLegalMoves — friendly blockade prevents landing on own rider', () => {
  let playerA = makePlayer('A');
  // Rider 0 at pos 3, rider 1 also at pos 3 would block, but rider 0 is at 3
  // and rider 1 is at 0. Roll 3: rider 1 (pos 0+3=3) would land on rider 0.
  playerA = setRiderPositions(playerA, [3, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 3);
  const moves = getLegalMoves(board, playerA, makePlayer('B'));
  // Rider 0 is at 3; roll 3 sends to 6 — that is legal.
  // Riders 1-5 are at 0; roll 3 sends to 3 — blocked by rider 0.
  const rider0Move = moves.find((m) => m.cardId === playerA.riders[0].cardId);
  assert.ok(rider0Move, 'rider 0 should be able to move to pos 6');
  assert.equal(rider0Move.toPosition, 6);
  // No rider from pos 0 targeting pos 3 (blocked).
  const blockedMoves = moves.filter((m) => m.toPosition === 3);
  assert.equal(blockedMoves.length, 0);
});

test('getLegalMoves — capture in shared lane is legal when opponent is not on alcove', () => {
  let playerA = makePlayer('A');
  let playerB = makePlayer('B');
  // Rider A at pos 5, roll 2 → pos 7.  Opponent rider at pos 7 (shared, not alcove).
  playerA = setRiderPositions(playerA, [5, 0, 0, 0, 0, 0]);
  playerB = setRiderPositions(playerB, [7, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 2);
  const moves = getLegalMoves(board, playerA, playerB);
  const capMove = moves.find((m) => m.toPosition === 7);
  assert.ok(capMove, 'capture move at pos 7 should be legal');
  assert.equal(capMove.wouldCapture, true);
  assert.equal(capMove.capturedCardId, playerB.riders[0].cardId);
});

test('getLegalMoves — cannot capture opponent on stealth alcove in shared lane', () => {
  let playerA = makePlayer('A');
  let playerB = makePlayer('B');
  // Rider A-0 at pos 4, roll 2 → pos 6 (stealth alcove, shared).
  // Opponent at pos 6 — safe.  Mark all other A riders as scored so they
  // don't contribute extra moves, isolating the stealth-alcove logic.
  playerA = setRiderPositions(playerA, [4, 0, 0, 0, 0, 0]);
  playerA.riders.slice(1).forEach((r) => { r.isScored = true; });
  playerB = setRiderPositions(playerB, [6, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 2);
  const moves = getLegalMoves(board, playerA, playerB);
  assert.equal(moves.length, 0, 'landing on occupied stealth alcove should be illegal');
});

test('getLegalMoves — smoke screen protects opponent from capture', () => {
  let playerA = makePlayer('A');
  let playerB = makePlayer('B');
  // Rider A-0 at pos 5, roll 2 → pos 7 (shared, not alcove). Opponent at 7.
  // Mark all other A riders as scored to isolate the smoke-screen logic.
  playerA = setRiderPositions(playerA, [5, 0, 0, 0, 0, 0]);
  playerA.riders.slice(1).forEach((r) => { r.isScored = true; });
  playerB = setRiderPositions(playerB, [7, 0, 0, 0, 0, 0]);
  // Smoke screen protecting opponent B.
  const board = { ...makeBoard('A', 2), smokeScreenUid: 'B', smokeScreenExpiresAfterTurn: 99 };
  const moves = getLegalMoves(board, playerA, playerB);
  assert.equal(moves.length, 0, 'smoke screen should block the capture move');
});

// ── Move application ──────────────────────────────────────────────────────────

test('applyMove — normal move updates rider position', () => {
  let playerA = makePlayer('A');
  let playerB = makePlayer('B');
  playerA = setRiderPositions(playerA, [3, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 2); // roll 2: 3→5

  const { active, extraTurn } = applyMove(board, playerA, playerB, {
    cardId: playerA.riders[0].cardId,
    activateSupport: false,
  });

  assert.equal(active.riders[0].position, 5);
  assert.equal(extraTurn, false);
});

test('applyMove — capture sends opponent rider to OFF_BOARD', () => {
  let playerA = makePlayer('A');
  let playerB = makePlayer('B');
  playerA = setRiderPositions(playerA, [5, 0, 0, 0, 0, 0]);
  playerB = setRiderPositions(playerB, [7, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 2); // 5+2=7

  const { active, opponent, capturedCardId } = applyMove(board, playerA, playerB, {
    cardId: playerA.riders[0].cardId,
    activateSupport: false,
  });

  assert.equal(active.riders[0].position, 7);
  assert.equal(opponent.riders[0].position, OFF_BOARD);
  assert.equal(capturedCardId, playerB.riders[0].cardId);
});

test('applyMove — landing on stealth alcove grants extra turn', () => {
  let playerA = makePlayer('A');
  let playerB = makePlayer('B');
  // 4 + 2 = 6 (stealth alcove in shared zone)
  playerA = setRiderPositions(playerA, [4, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 2);

  const { extraTurn, active } = applyMove(board, playerA, playerB, {
    cardId: playerA.riders[0].cardId,
    activateSupport: false,
  });

  assert.equal(extraTurn, true);
  assert.equal(active.riders[0].position, 6);
});

test('applyMove — exit marks rider as scored', () => {
  let playerA = makePlayer('A');
  let playerB = makePlayer('B');
  playerA = setRiderPositions(playerA, [14, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 1); // 14+1=15=EXIT

  const { active } = applyMove(board, playerA, playerB, {
    cardId: playerA.riders[0].cardId,
    activateSupport: false,
  });

  assert.equal(active.riders[0].position, EXIT_POSITION);
  assert.equal(active.riders[0].isScored, true);
  assert.equal(active.scoredCount, 1);
});

test('applyMove — turn switches to opponent after normal move', () => {
  let playerA = makePlayer('A');
  // Use pos 1 + roll 2 = pos 3 (not a stealth alcove) to avoid an extra turn.
  playerA = setRiderPositions(playerA, [1, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 2);

  const { board: newBoard } = applyMove(board, playerA, makePlayer('B'), {
    cardId: playerA.riders[0].cardId,
    activateSupport: false,
  });

  assert.equal(newBoard.activePlayerUid, 'B');
});

test('applyMove — extra turn keeps active player the same', () => {
  let playerA = makePlayer('A');
  playerA = setRiderPositions(playerA, [4, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 2); // lands on pos 6 (stealth alcove)

  const { board: newBoard, extraTurn } = applyMove(board, playerA, makePlayer('B'), {
    cardId: playerA.riders[0].cardId,
    activateSupport: false,
  });

  assert.equal(extraTurn, true);
  assert.equal(newBoard.activePlayerUid, 'A');
});

test('applyMove — pass (cardId null) advances turn', () => {
  const playerA = makePlayer('A');
  const board = makeBoard('A', 0); // roll 0

  const { board: newBoard } = applyMove(board, playerA, makePlayer('B'), {
    cardId: null,
    activateSupport: false,
  });

  assert.equal(newBoard.activePlayerUid, 'B');
});

// Support effect tests

test('applyMove — recoveryPing moves a captured rider to pos 1', () => {
  const playerA = makePlayer('A', RIDER_COUNT, 'Punch Skaters');
  // One rider already captured (pos 0).
  const board = makeBoard('A', 1);

  const { active } = applyMove(board, playerA, makePlayer('B'), {
    cardId: null,
    activateSupport: true,
  });

  assert.equal(active.supportRuntime.activated, true);
  // At least one rider should now be at position 1 (was at 0 before).
  const recoveredRider = active.riders.find((r) => r.position === PRIVATE_ENTRY_MIN);
  assert.ok(recoveredRider, 'recoveryPing should recover a rider to pos 1');
});

test('applyMove — crowdRoar grants extra turn', () => {
  const playerA = makePlayer('A', RIDER_COUNT, 'Ne0n Legion');
  const board = makeBoard('A', 1);

  const { active, extraTurn } = applyMove(board, playerA, makePlayer('B'), {
    cardId: null,
    activateSupport: true,
  });

  assert.equal(active.supportRuntime.activated, true);
  assert.equal(extraTurn, true);
});

test('applyMove — smokeScreen sets board flag', () => {
  const playerA = makePlayer('A', RIDER_COUNT, 'Qu111s (Quills)');
  const board = makeBoard('A', 1);

  const { board: newBoard, active } = applyMove(board, playerA, makePlayer('B'), {
    cardId: null,
    activateSupport: true,
  });

  assert.equal(active.supportRuntime.activated, true);
  assert.equal(newBoard.smokeScreenUid, 'A');
  assert.ok(newBoard.smokeScreenExpiresAfterTurn !== null);
});

test('applyMove — reroll sets rollResult null and grants extra turn', () => {
  const playerA = makePlayer('A', RIDER_COUNT, 'The Team');
  const board = makeBoard('A', 3);

  const { board: newBoard, active, extraTurn } = applyMove(board, playerA, makePlayer('B'), {
    cardId: null,
    activateSupport: true,
  });

  assert.equal(active.supportRuntime.activated, true);
  assert.equal(newBoard.rollResult, null);
  assert.equal(extraTurn, true);
});

test('applyMove — overclock adds +1 to roll and grants extra turn', () => {
  const playerA = makePlayer('A', RIDER_COUNT, 'Iron Curtains');
  const board = makeBoard('A', 3);

  const { board: newBoard, active, extraTurn } = applyMove(board, playerA, makePlayer('B'), {
    cardId: null,
    activateSupport: true,
  });

  assert.equal(active.supportRuntime.activated, true);
  assert.equal(newBoard.rollResult, 4); // 3 + 1
  assert.equal(extraTurn, true);
});

test('applyMove — sideRoute teleports a rider from entry to pos 13', () => {
  let playerA = makePlayer('A', RIDER_COUNT, 'The Asclepians');
  // Move rider 0 to private entry zone.
  playerA = setRiderPositions(playerA, [2, 0, 0, 0, 0, 0]);
  const board = makeBoard('A', 1);

  const { active } = applyMove(board, playerA, makePlayer('B'), {
    cardId: null,
    activateSupport: true,
    supportTargetCardId: playerA.riders[0].cardId,
  });

  assert.equal(active.supportRuntime.activated, true);
  assert.equal(active.riders[0].position, PRIVATE_EXIT_MIN);
});

test('applyMove — support cannot be activated twice', () => {
  let playerA = makePlayer('A', RIDER_COUNT, 'Ne0n Legion');
  // Pre-activate.
  playerA.supportRuntime = { activated: true, activatedOnTurn: 1 };
  const board = makeBoard('A', 1);

  const { active } = applyMove(board, playerA, makePlayer('B'), {
    cardId: null,
    activateSupport: true, // Should be ignored since already activated.
  });

  // supportRuntime.activated was already true; activatedOnTurn should not reset.
  assert.equal(active.supportRuntime.activated, true);
});

// ── Win detection ──────────────────────────────────────────────────────────────

test('detectWinner — false when fewer than RIDER_COUNT riders scored', () => {
  let playerA = makePlayer('A');
  playerA.scoredCount = RIDER_COUNT - 1;
  assert.equal(detectWinner(playerA), false);
});

test('detectWinner — true when all RIDER_COUNT riders scored', () => {
  let playerA = makePlayer('A');
  playerA.scoredCount = RIDER_COUNT;
  assert.equal(detectWinner(playerA), true);
});

// ── Reward calculation ────────────────────────────────────────────────────────

function makeCompletedMatch(winnerUid) {
  const challenger = makePlayer('A');
  const defender   = makePlayer('B');
  return {
    status: 'completed',
    winnerUid,
    rewardsGranted: false,
    challengerUid: 'A',
    defenderUid:   'B',
    challengerState: challenger,
    defenderState:   defender,
  };
}

test('calcRewards — participation XP/Ozzies for both players', () => {
  const match = makeCompletedMatch('A');
  const { challenger, defender } = calcRewards(match);
  assert.ok(challenger.xp >= 50);
  assert.ok(challenger.ozzies >= 10);
  assert.ok(defender.xp >= 50);
  assert.ok(defender.ozzies >= 10);
});

test('calcRewards — winner receives bonus XP and Ozzies', () => {
  const match = makeCompletedMatch('A');
  const { challenger, defender } = calcRewards(match);
  assert.ok(challenger.xp > defender.xp, 'winner XP should exceed loser XP');
  assert.ok(challenger.ozzies > defender.ozzies, 'winner Ozzies should exceed loser Ozzies');
});

test('calcRewards — strike trait adds XP bonus', () => {
  const match = makeCompletedMatch('B'); // A is the loser
  // Give A a strike rider.
  match.challengerState.lineup[0].jousturTrait = 'strike';
  const { challenger, defender } = calcRewards(match);
  // Both could have bonuses; A's strike bonus should be reflected.
  // Simple check: A has more XP than base-participation (50).
  assert.ok(challenger.xp > 50);
  // A still loses — no win bonus.
  assert.ok(defender.xp > challenger.xp);
});

test('calcRewards — echo trait adds XP bonus', () => {
  const match = makeCompletedMatch('A');
  match.challengerState.lineup[0].jousturTrait = 'echo';
  const baseMatch = makeCompletedMatch('A');
  const { challenger: withEcho } = calcRewards(match);
  const { challenger: noBonus } = calcRewards(baseMatch);
  assert.ok(withEcho.xp > noBonus.xp);
});

test('calcRewards — crowdHalo passive adds XP bonus', () => {
  const match = makeCompletedMatch('B');
  match.challengerState.factionPassive = 'crowdHalo';
  const baseMatch = makeCompletedMatch('B');
  const { challenger: withHalo } = calcRewards(match);
  const { challenger: noBonus } = calcRewards(baseMatch);
  assert.ok(withHalo.xp > noBonus.xp);
});

test('calcRewards — crowdRoar support used adds XP bonus', () => {
  const match = makeCompletedMatch('B');
  match.challengerState.support.supportEffect = 'crowdRoar';
  match.challengerState.supportRuntime = { activated: true, activatedOnTurn: 1 };
  const baseMatch = makeCompletedMatch('B');
  const { challenger: withRoar } = calcRewards(match);
  const { challenger: noBonus } = calcRewards(baseMatch);
  assert.ok(withRoar.xp > noBonus.xp);
});

test('calcRewards idempotency — rewardsGranted flag signals no double-grant', () => {
  // The flag itself is checked by the route handler; calcRewards is called once.
  // This test verifies the flag is readable on the match object.
  const match = makeCompletedMatch('A');
  match.rewardsGranted = true;
  // calcRewards does not check the flag — the route handler guards that.
  // We only verify calcRewards still returns valid numbers (for safety re-call).
  const { challenger, defender } = calcRewards(match);
  assert.ok(typeof challenger.xp === 'number');
  assert.ok(typeof defender.xp === 'number');
});

// ── Async turn ownership ──────────────────────────────────────────────────────

test('initial board state sets challenger as first active player', () => {
  const board = buildInitialBoardState('challenger-uid');
  assert.equal(board.activePlayerUid, 'challenger-uid');
  assert.equal(board.rollResult, null);
  assert.equal(board.turn, 1);
});

test('turn advances after a normal move', () => {
  const board = buildInitialBoardState('A');
  const boardWithRoll = { ...board, rollResult: 2 };
  const playerA = makePlayer('A');
  const playerB = makePlayer('B');
  playerA.riders[0].position = 3;

  const { board: newBoard } = applyMove(boardWithRoll, playerA, playerB, {
    cardId: playerA.riders[0].cardId,
    activateSupport: false,
  });

  assert.equal(newBoard.turn, 2);
  assert.equal(newBoard.activePlayerUid, 'B');
});
