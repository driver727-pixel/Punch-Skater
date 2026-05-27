/**
 * Mission run phase state machine.
 *
 * Separates the four distinct stages of a round-trip Missions run so that
 * outbound travel, encounter resolution, POI fork resolution, and inbound
 * travel can be reasoned about and persisted explicitly. Only successful
 * returns mutate the player card; that mutation is intentionally deferred
 * to PR 4 (#633) and is NOT performed by this module.
 */

export const MISSION_PHASE = Object.freeze({
  IDLE_AT_BASE: 'IDLE_AT_BASE',
  TRAVELING_OUTBOUND: 'TRAVELING_OUTBOUND',
  ENCOUNTER_RESOLUTION: 'ENCOUNTER_RESOLUTION',
  AT_POI_FORK: 'AT_POI_FORK',
  TRAVELING_INBOUND: 'TRAVELING_INBOUND',
  MISSION_COMPLETE: 'MISSION_COMPLETE',
  MISSION_FAILED: 'MISSION_FAILED',
});

export const MISSION_PHASES = Object.freeze(Object.values(MISSION_PHASE));

/**
 * Legacy phase strings persisted by earlier mission PRs. New persisted runs
 * always use the canonical MISSION_PHASE values, but legacy records are
 * normalized on read so refresh-safe restoration works across the change.
 */
const LEGACY_PHASE_MAP = Object.freeze({
  outbound: MISSION_PHASE.TRAVELING_OUTBOUND,
  at_poi: MISSION_PHASE.AT_POI_FORK,
  returning: MISSION_PHASE.TRAVELING_INBOUND,
  complete: MISSION_PHASE.MISSION_COMPLETE,
  failed: MISSION_PHASE.MISSION_FAILED,
});

/**
 * Adjacency list of allowed transitions between phases.
 *
 * IDLE_AT_BASE -> TRAVELING_OUTBOUND          (launch run)
 * TRAVELING_OUTBOUND -> ENCOUNTER_RESOLUTION  (encounter interrupts outbound)
 * TRAVELING_OUTBOUND -> AT_POI_FORK           (reached contract POI)
 * ENCOUNTER_RESOLUTION -> TRAVELING_OUTBOUND  (encounter resolved, was outbound)
 * ENCOUNTER_RESOLUTION -> TRAVELING_INBOUND   (encounter resolved, was inbound)
 * AT_POI_FORK -> TRAVELING_INBOUND            (POI fork resolved, heading home)
 * TRAVELING_INBOUND -> ENCOUNTER_RESOLUTION   (encounter interrupts inbound)
 * TRAVELING_INBOUND -> MISSION_COMPLETE       (reached Workshop)
 *
 * MISSION_COMPLETE is terminal.
 */
const ALLOWED_TRANSITIONS = Object.freeze({
  [MISSION_PHASE.IDLE_AT_BASE]: Object.freeze([MISSION_PHASE.TRAVELING_OUTBOUND]),
  [MISSION_PHASE.TRAVELING_OUTBOUND]: Object.freeze([
    MISSION_PHASE.ENCOUNTER_RESOLUTION,
    MISSION_PHASE.AT_POI_FORK,
  ]),
  [MISSION_PHASE.ENCOUNTER_RESOLUTION]: Object.freeze([
    MISSION_PHASE.TRAVELING_OUTBOUND,
    MISSION_PHASE.TRAVELING_INBOUND,
  ]),
  [MISSION_PHASE.AT_POI_FORK]: Object.freeze([MISSION_PHASE.TRAVELING_INBOUND]),
  [MISSION_PHASE.TRAVELING_INBOUND]: Object.freeze([
    MISSION_PHASE.ENCOUNTER_RESOLUTION,
    MISSION_PHASE.MISSION_COMPLETE,
  ]),
  [MISSION_PHASE.MISSION_COMPLETE]: Object.freeze([]),
  [MISSION_PHASE.MISSION_FAILED]: Object.freeze([]),
});

export function isMissionPhase(value) {
  return typeof value === 'string' && MISSION_PHASES.includes(value);
}

/**
 * Normalize a phase value from any source (legacy record, new record, or
 * undefined) into a canonical MISSION_PHASE. Unknown / missing values fall
 * back to IDLE_AT_BASE so that callers can rely on a non-null phase.
 */
export function normalizePhase(value) {
  if (isMissionPhase(value)) return value;
  if (typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_PHASE_MAP, value)) {
    return LEGACY_PHASE_MAP[value];
  }
  return MISSION_PHASE.IDLE_AT_BASE;
}

export function isTerminalPhase(phase) {
  const normalized = normalizePhase(phase);
  return normalized === MISSION_PHASE.MISSION_COMPLETE || normalized === MISSION_PHASE.MISSION_FAILED;
}

/**
 * @returns {boolean} true when `to` is a permitted next phase from `from`.
 *   A phase is never allowed to transition to itself.
 */
export function canTransition(from, to) {
  const fromPhase = normalizePhase(from);
  if (!isMissionPhase(to)) return false;
  const allowed = ALLOWED_TRANSITIONS[fromPhase] ?? [];
  return allowed.includes(to);
}

export function allowedNextPhases(from) {
  return [...(ALLOWED_TRANSITIONS[normalizePhase(from)] ?? [])];
}

/**
 * Apply a phase transition. Throws an Error with a stable `code` of
 * `INVALID_TRANSITION` and an HTTP-friendly `statusCode` of 409 when the
 * requested transition is not permitted by the machine.
 */
export function transition(from, to) {
  const fromPhase = normalizePhase(from);
  if (!canTransition(fromPhase, to)) {
    const error = new Error(
      `Invalid mission phase transition: ${fromPhase} -> ${to}`,
    );
    error.code = 'INVALID_TRANSITION';
    error.statusCode = 409;
    error.fromPhase = fromPhase;
    error.toPhase = to;
    throw error;
  }
  return to;
}
