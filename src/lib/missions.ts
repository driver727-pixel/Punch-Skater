/**
 * missions.ts — Typed mission template library and pure logic helpers.
 *
 * Nothing here touches Firestore. All Firestore operations live in
 * src/services/missions.ts.
 *
 * @sprint 1 @owner gamma
 */

import { createSeededRandom } from "./prng";
import type { Archetype, District } from "./types";
import type { Mission, MissionEvent, MissionStat, MissionType } from "./sharedTypes";

// ── Template shape ────────────────────────────────────────────────────────────

/**
 * Blueprint for a daily mission. One template can generate many `Mission`
 * documents — the per-user state lives in Firestore; the template is static.
 */
export interface MissionTemplate {
  /** Stable identifier used as a seed component and Firestore sub-key. */
  templateId: string;
  type: MissionType;
  title: string;
  description: string;
  target: number;
  rewardXp: number;
  rewardOzzies: number;
  district?: District;
  archetype?: Archetype;
  stat?: MissionStat;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const MISSION_TEMPLATES: MissionTemplate[] = [
  {
    templateId: "forge_any_1",
    type: "forge_card",
    title: "First Run",
    description: "Forge any card. Every courier starts somewhere.",
    target: 1,
    rewardXp: 100,
    rewardOzzies: 50,
  },
  {
    templateId: "forge_any_3",
    type: "forge_card",
    title: "Triple Forge",
    description: "Forge three cards in a single session. The underground respects output.",
    target: 3,
    rewardXp: 250,
    rewardOzzies: 120,
  },
  {
    templateId: "forge_technarchy_1",
    type: "forge_archetype",
    title: "Technarchy Contract",
    description:
      "Forge a Knights Technarchy card. They move packages between hidden temples " +
      "and few dare to open them.",
    target: 1,
    rewardXp: 150,
    rewardOzzies: 75,
    archetype: "The Knights Technarchy",
  },
  {
    templateId: "forge_neon_legion_1",
    type: "forge_archetype",
    title: "Ghost Protocol",
    description:
      "Forge a Ne0n Legion card. They strike fast, vanish before the fallout, " +
      "and sell what they find.",
    target: 1,
    rewardXp: 150,
    rewardOzzies: 75,
    archetype: "Ne0n Legion",
  },
  {
    templateId: "forge_iron_curtains_1",
    type: "forge_archetype",
    title: "Iron Circuit Training",
    description:
      "Forge an Iron Curtains card. Disciplined, methodical — they plan routes " +
      "like operations, with contingencies for every checkpoint.",
    target: 1,
    rewardXp: 150,
    rewardOzzies: 75,
    archetype: "Iron Curtains",
  },
  {
    templateId: "win_battle_3",
    type: "win_battle",
    title: "Battle the Streets",
    description: "Win three arena battles. Reputation is built one defeated opponent at a time.",
    target: 3,
    rewardXp: 225,
    rewardOzzies: 150,
  },
  {
    templateId: "district_run_nightshade",
    type: "complete_district_run",
    title: "Package Run: Nightshade",
    description:
      "Complete a run in Nightshade. Nobody owns the Murk — but the crews will " +
      "know your name if you skate it right.",
    target: 1,
    rewardXp: 120,
    rewardOzzies: 60,
    district: "Nightshade",
  },
  {
    templateId: "district_run_the_grid",
    type: "complete_district_run",
    title: "Stealth Run: The Grid",
    description:
      "Complete a run through The Grid. Every step is logged by Cascade Technologies' " +
      "AI. You don't run here without a plan.",
    target: 1,
    rewardXp: 150,
    rewardOzzies: 80,
    district: "The Grid",
  },
  {
    templateId: "stat_grit_7",
    type: "achieve_stat_threshold",
    title: "Batteryville Endurance",
    description:
      "Forge a card with Grit ≥ 7. Batteryville builds couriers the way it builds " +
      "everything else — through punishment.",
    target: 7,
    rewardXp: 175,
    rewardOzzies: 90,
    stat: "grit",
  },
  {
    templateId: "stat_speed_8",
    type: "achieve_stat_threshold",
    title: "Courier Speed Test",
    description:
      "Forge a card with Speed ≥ 8. The Voltage Saints say those who move fastest " +
      "are most aligned with the city's flow.",
    target: 8,
    rewardXp: 200,
    rewardOzzies: 100,
    stat: "speed",
  },
  {
    templateId: "daily_login_7",
    type: "daily_login",
    title: "Daily Login Streak",
    description:
      "Log in 7 days in a row. Consistency is the courier's most underrated skill.",
    target: 7,
    rewardXp: 350,
    rewardOzzies: 200,
  },
  {
    templateId: "trade_card_1",
    type: "trade_card",
    title: "Open Market Trade",
    description:
      "Complete a card trade with another player. Scratch talks; corps walk.",
    target: 1,
    rewardXp: 100,
    rewardOzzies: 50,
  },
];

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Deterministically picks `count` distinct mission templates for a given uid
 * and calendar date string ("YYYY-MM-DD"). Uses a seeded PRNG so the same
 * uid+date always returns the same selection without a DB read.
 */
export function pickDailyMissions(uid: string, date: string, count = 3): Mission[] {
  const rng = createSeededRandom(`${uid}::${date}`);
  const templates = rng.pickN(MISSION_TEMPLATES, Math.min(count, MISSION_TEMPLATES.length));

  const expiresAt = `${date}T23:59:59.999Z`;
  const createdAt = new Date().toISOString();

  return templates.map((tpl) => ({
    id: `${uid}_${date}_${tpl.templateId}`,
    uid,
    title: tpl.title,
    description: tpl.description,
    // Legacy string field kept for backwards compatibility
    type: tpl.type,
    missionType: tpl.type,
    target: tpl.target,
    progress: 0,
    status: "active" as const,
    rewardXp: tpl.rewardXp,
    rewardOzzies: tpl.rewardOzzies,
    createdAt,
    expiresAt,
    ...(tpl.district ? { district: tpl.district } : {}),
    ...(tpl.archetype ? { archetype: tpl.archetype } : {}),
    ...(tpl.stat ? { stat: tpl.stat } : {}),
  }));
}

/** Returns true when a mission's progress has reached or exceeded its target. */
export function isMissionComplete(mission: Mission): boolean {
  return mission.progress >= mission.target;
}

/**
 * Returns a new `Mission` with progress updated for the given event.
 * Does not mutate the input. Returns the mission unchanged if the event does
 * not match this mission type, or the mission is already completed / expired.
 */
export function applyMissionProgress(mission: Mission, event: MissionEvent): Mission {
  const missionType = (mission.missionType ?? mission.type) as MissionType;

  if (mission.status !== "active") return mission;

  let matched = false;

  switch (event.type) {
    case "forge_card":
      matched = missionType === "forge_card";
      break;
    case "forge_archetype":
      matched =
        missionType === "forge_archetype" &&
        mission.archetype === event.archetype;
      break;
    case "win_battle":
      matched = missionType === "win_battle";
      break;
    case "complete_district_run":
      matched =
        missionType === "complete_district_run" &&
        mission.district === event.district;
      break;
    case "achieve_stat_threshold":
      matched =
        missionType === "achieve_stat_threshold" &&
        mission.stat === event.stat &&
        event.value >= mission.target;
      break;
    case "daily_login":
      matched = missionType === "daily_login";
      break;
    case "trade_card":
      matched = missionType === "trade_card";
      break;
    case "build_deck":
      matched = missionType === "build_deck";
      break;
  }

  if (!matched) return mission;

  // For threshold missions, a single matching event completes the mission.
  const newProgress =
    missionType === "achieve_stat_threshold"
      ? mission.target
      : Math.min(mission.progress + 1, mission.target);

  const nowComplete = newProgress >= mission.target;

  return {
    ...mission,
    progress: newProgress,
    status: nowComplete ? "completed" : "active",
    ...(nowComplete && !mission.completedAt
      ? { completedAt: new Date().toISOString() }
      : {}),
  };
}
