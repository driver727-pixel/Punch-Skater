import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_PHASE,
  MISSION_PHASES,
  allowedNextPhases,
  canTransition,
  isMissionPhase,
  isTerminalPhase,
  normalizePhase,
  transition,
} from '../lib/missionPhaseMachine.js';

test('exports the six canonical mission phases', () => {
  assert.deepEqual(new Set(MISSION_PHASES), new Set([
    'IDLE_AT_BASE',
    'TRAVELING_OUTBOUND',
    'ENCOUNTER_RESOLUTION',
    'AT_POI_FORK',
    'TRAVELING_INBOUND',
    'MISSION_COMPLETE',
  ]));
});

test('normalizePhase maps legacy persisted strings to canonical phases', () => {
  assert.equal(normalizePhase('outbound'), MISSION_PHASE.TRAVELING_OUTBOUND);
  assert.equal(normalizePhase('at_poi'), MISSION_PHASE.AT_POI_FORK);
  assert.equal(normalizePhase('returning'), MISSION_PHASE.TRAVELING_INBOUND);
  assert.equal(normalizePhase('complete'), MISSION_PHASE.MISSION_COMPLETE);
  assert.equal(normalizePhase('failed'), MISSION_PHASE.MISSION_COMPLETE);
});

test('normalizePhase passes through canonical phases and defaults unknown to IDLE_AT_BASE', () => {
  for (const phase of MISSION_PHASES) {
    assert.equal(normalizePhase(phase), phase);
  }
  assert.equal(normalizePhase(undefined), MISSION_PHASE.IDLE_AT_BASE);
  assert.equal(normalizePhase(null), MISSION_PHASE.IDLE_AT_BASE);
  assert.equal(normalizePhase('not-a-phase'), MISSION_PHASE.IDLE_AT_BASE);
});

test('isMissionPhase strictly matches canonical phase strings only', () => {
  assert.equal(isMissionPhase(MISSION_PHASE.TRAVELING_OUTBOUND), true);
  assert.equal(isMissionPhase('outbound'), false);
  assert.equal(isMissionPhase(''), false);
  assert.equal(isMissionPhase(null), false);
});

test('isTerminalPhase identifies MISSION_COMPLETE and legacy terminal strings', () => {
  assert.equal(isTerminalPhase(MISSION_PHASE.MISSION_COMPLETE), true);
  assert.equal(isTerminalPhase('complete'), true);
  assert.equal(isTerminalPhase('failed'), true);
  assert.equal(isTerminalPhase(MISSION_PHASE.TRAVELING_OUTBOUND), false);
});

test('canTransition enforces the explicit transition table', () => {
  // Happy-path transitions for a round-trip run.
  assert.equal(canTransition(MISSION_PHASE.IDLE_AT_BASE, MISSION_PHASE.TRAVELING_OUTBOUND), true);
  assert.equal(canTransition(MISSION_PHASE.TRAVELING_OUTBOUND, MISSION_PHASE.AT_POI_FORK), true);
  assert.equal(canTransition(MISSION_PHASE.TRAVELING_OUTBOUND, MISSION_PHASE.ENCOUNTER_RESOLUTION), true);
  assert.equal(canTransition(MISSION_PHASE.ENCOUNTER_RESOLUTION, MISSION_PHASE.TRAVELING_OUTBOUND), true);
  assert.equal(canTransition(MISSION_PHASE.ENCOUNTER_RESOLUTION, MISSION_PHASE.TRAVELING_INBOUND), true);
  assert.equal(canTransition(MISSION_PHASE.AT_POI_FORK, MISSION_PHASE.TRAVELING_INBOUND), true);
  assert.equal(canTransition(MISSION_PHASE.TRAVELING_INBOUND, MISSION_PHASE.ENCOUNTER_RESOLUTION), true);
  assert.equal(canTransition(MISSION_PHASE.TRAVELING_INBOUND, MISSION_PHASE.MISSION_COMPLETE), true);
});

test('canTransition refuses illegal shortcuts and self-loops', () => {
  // Reaching the POI must NOT equal mission completion.
  assert.equal(canTransition(MISSION_PHASE.AT_POI_FORK, MISSION_PHASE.MISSION_COMPLETE), false);
  // Cannot skip the POI fork on outbound travel.
  assert.equal(canTransition(MISSION_PHASE.TRAVELING_OUTBOUND, MISSION_PHASE.TRAVELING_INBOUND), false);
  // Cannot relaunch a terminated run.
  assert.equal(canTransition(MISSION_PHASE.MISSION_COMPLETE, MISSION_PHASE.TRAVELING_OUTBOUND), false);
  // Self-loops are never allowed.
  for (const phase of MISSION_PHASES) {
    assert.equal(canTransition(phase, phase), false, `self-loop refused for ${phase}`);
  }
});

test('transition throws an INVALID_TRANSITION error with HTTP 409 for illegal moves', () => {
  assert.throws(
    () => transition(MISSION_PHASE.AT_POI_FORK, MISSION_PHASE.MISSION_COMPLETE),
    (err) => err.code === 'INVALID_TRANSITION' && err.statusCode === 409,
  );
});

test('transition returns the target phase for legal moves', () => {
  assert.equal(
    transition(MISSION_PHASE.IDLE_AT_BASE, MISSION_PHASE.TRAVELING_OUTBOUND),
    MISSION_PHASE.TRAVELING_OUTBOUND,
  );
});

test('allowedNextPhases enumerates the legal next states', () => {
  assert.deepEqual(allowedNextPhases(MISSION_PHASE.TRAVELING_OUTBOUND), [
    MISSION_PHASE.ENCOUNTER_RESOLUTION,
    MISSION_PHASE.AT_POI_FORK,
  ]);
  assert.deepEqual(allowedNextPhases(MISSION_PHASE.MISSION_COMPLETE), []);
});
