/**
 * Mission run phase state machine (client mirror of server/lib/missionPhaseMachine.js).
 *
 * Used by Missions UI to label the active phase, gate animations to the
 * correct travel state, and recognize terminal runs. The authoritative
 * transition logic lives on the server; this module is for display and
 * client-side guards only.
 */

export const MISSION_PHASE = {
  IDLE_AT_BASE: "IDLE_AT_BASE",
  TRAVELING_OUTBOUND: "TRAVELING_OUTBOUND",
  ENCOUNTER_RESOLUTION: "ENCOUNTER_RESOLUTION",
  AT_POI_FORK: "AT_POI_FORK",
  TRAVELING_INBOUND: "TRAVELING_INBOUND",
  MISSION_COMPLETE: "MISSION_COMPLETE",
} as const;

export type MissionPhase = (typeof MISSION_PHASE)[keyof typeof MISSION_PHASE];

const MISSION_PHASES = Object.values(MISSION_PHASE) as MissionPhase[];

const LEGACY_PHASE_MAP: Record<string, MissionPhase> = {
  outbound: MISSION_PHASE.TRAVELING_OUTBOUND,
  at_poi: MISSION_PHASE.AT_POI_FORK,
  returning: MISSION_PHASE.TRAVELING_INBOUND,
  complete: MISSION_PHASE.MISSION_COMPLETE,
  failed: MISSION_PHASE.MISSION_COMPLETE,
};

const ALLOWED_TRANSITIONS: Record<MissionPhase, readonly MissionPhase[]> = {
  [MISSION_PHASE.IDLE_AT_BASE]: [MISSION_PHASE.TRAVELING_OUTBOUND],
  [MISSION_PHASE.TRAVELING_OUTBOUND]: [
    MISSION_PHASE.ENCOUNTER_RESOLUTION,
    MISSION_PHASE.AT_POI_FORK,
  ],
  [MISSION_PHASE.ENCOUNTER_RESOLUTION]: [
    MISSION_PHASE.TRAVELING_OUTBOUND,
    MISSION_PHASE.TRAVELING_INBOUND,
  ],
  [MISSION_PHASE.AT_POI_FORK]: [MISSION_PHASE.TRAVELING_INBOUND],
  [MISSION_PHASE.TRAVELING_INBOUND]: [
    MISSION_PHASE.ENCOUNTER_RESOLUTION,
    MISSION_PHASE.MISSION_COMPLETE,
  ],
  [MISSION_PHASE.MISSION_COMPLETE]: [],
};

export function isMissionPhase(value: unknown): value is MissionPhase {
  return typeof value === "string" && (MISSION_PHASES as string[]).includes(value);
}

export function normalizeMissionPhase(value: unknown): MissionPhase {
  if (isMissionPhase(value)) return value;
  if (typeof value === "string" && Object.prototype.hasOwnProperty.call(LEGACY_PHASE_MAP, value)) {
    return LEGACY_PHASE_MAP[value];
  }
  return MISSION_PHASE.IDLE_AT_BASE;
}

export function canTransitionMissionPhase(from: unknown, to: MissionPhase): boolean {
  const fromPhase = normalizeMissionPhase(from);
  return ALLOWED_TRANSITIONS[fromPhase].includes(to);
}

export function isTerminalMissionPhase(phase: unknown): boolean {
  return normalizeMissionPhase(phase) === MISSION_PHASE.MISSION_COMPLETE;
}

export const MISSION_PHASE_LABELS: Record<MissionPhase, string> = {
  [MISSION_PHASE.IDLE_AT_BASE]: "■ AT WORKSHOP",
  [MISSION_PHASE.TRAVELING_OUTBOUND]: "▶ OUTBOUND",
  [MISSION_PHASE.ENCOUNTER_RESOLUTION]: "! ENCOUNTER",
  [MISSION_PHASE.AT_POI_FORK]: "◆ AT CONTRACT",
  [MISSION_PHASE.TRAVELING_INBOUND]: "◀ RETURNING",
  [MISSION_PHASE.MISSION_COMPLETE]: "✓ COMPLETE",
};
