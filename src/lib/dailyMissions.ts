/**
 * dailyMissions.ts — Daily mission system.
 *
 * Each day, 3 missions are selected from a template pool via a date-seeded
 * PRNG so every player sees the same set. Missions track progress locally
 * and reward XP + Ozzies on completion.
 */

import type { MissionStatus } from "./sharedTypes";

export interface MissionTemplate {
  id: string;
  title: string;
  description: string;
  type: "forge" | "battle" | "trade" | "mission" | "collection";
  target: number;
  rewardXp: number;
  rewardOzzies: number;
}

export interface DailyMission {
  id: string;
  templateId: string;
  title: string;
  description: string;
  type: MissionTemplate["type"];
  target: number;
  progress: number;
  status: MissionStatus;
  rewardXp: number;
  rewardOzzies: number;
  dateKey: string;
}

export const MISSION_TEMPLATES: MissionTemplate[] = [
  { id: "forge_1",       title: "Forge a Card",              description: "Create any card in the Card Forge.",                   type: "forge",      target: 1,  rewardXp: 50,  rewardOzzies: 15 },
  { id: "forge_2",       title: "Forge 2 Cards",             description: "Create 2 cards in the Card Forge.",                    type: "forge",      target: 2,  rewardXp: 100, rewardOzzies: 30 },
  { id: "battle_1",      title: "Win a Battle",              description: "Win a battle in the Arena.",                           type: "battle",     target: 1,  rewardXp: 75,  rewardOzzies: 25 },
  { id: "battle_2",      title: "Enter 2 Battles",           description: "Participate in 2 battles.",                            type: "battle",     target: 2,  rewardXp: 100, rewardOzzies: 35 },
  { id: "trade_1",       title: "Send a Trade",              description: "Offer a card on the Community Market.",                type: "trade",      target: 1,  rewardXp: 50,  rewardOzzies: 20 },
  { id: "trade_2",       title: "Complete a Trade",          description: "Have a trade accepted or accept an incoming trade.",    type: "trade",      target: 1,  rewardXp: 75,  rewardOzzies: 30 },
  { id: "mission_1",     title: "Complete a Delivery Run",   description: "Finish any delivery mission successfully.",             type: "mission",    target: 1,  rewardXp: 75,  rewardOzzies: 25 },
  { id: "mission_2",     title: "Complete 2 Delivery Runs",  description: "Finish 2 delivery missions.",                          type: "mission",    target: 2,  rewardXp: 120, rewardOzzies: 40 },
  { id: "collection_1",  title: "Save to Collection",        description: "Save a card to your Collection.",                      type: "collection", target: 1,  rewardXp: 50,  rewardOzzies: 15 },
  { id: "collection_2",  title: "Grow Your Collection",      description: "Save 3 cards to your Collection.",                     type: "collection", target: 3,  rewardXp: 100, rewardOzzies: 40 },
];

const MISSIONS_PER_DAY = 3;
const STORAGE_KEY = "skpd_daily_missions";

function dateSeed(dateKey: string): number {
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = ((hash << 5) - hash + dateKey.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function selectDailyTemplates(dateKey: string): MissionTemplate[] {
  const seed = dateSeed(dateKey);
  const pool = [...MISSION_TEMPLATES];
  const selected: MissionTemplate[] = [];
  const usedTypes = new Set<string>();

  for (let i = 0; i < MISSIONS_PER_DAY && pool.length > 0; i++) {
    const eligibleIndices = pool
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => !usedTypes.has(t.type));
    const candidates = eligibleIndices.length > 0 ? eligibleIndices : pool.map((t, idx) => ({ t, idx }));
    const pick = candidates[(seed + i * 7 + i * i) % candidates.length];
    selected.push(pick.t);
    usedTypes.add(pick.t.type);
    pool.splice(pick.idx, 1);
  }

  return selected;
}

export function getDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

interface StoredMissions {
  dateKey: string;
  missions: DailyMission[];
}

function loadStoredMissions(): StoredMissions | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredMissions;
  } catch {
    return null;
  }
}

function saveStoredMissions(data: StoredMissions): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getDailyMissions(dateKey?: string): DailyMission[] {
  const today = dateKey ?? getDateKey();
  const stored = loadStoredMissions();

  if (stored && stored.dateKey === today) {
    return stored.missions;
  }

  const templates = selectDailyTemplates(today);
  const missions: DailyMission[] = templates.map((t) => ({
    id: `${today}_${t.id}`,
    templateId: t.id,
    title: t.title,
    description: t.description,
    type: t.type,
    target: t.target,
    progress: 0,
    status: "active" as MissionStatus,
    rewardXp: t.rewardXp,
    rewardOzzies: t.rewardOzzies,
    dateKey: today,
  }));

  saveStoredMissions({ dateKey: today, missions });
  return missions;
}

export function advanceMissionProgress(
  missionId: string,
  increment: number = 1,
): DailyMission | null {
  const today = getDateKey();
  const stored = loadStoredMissions();
  if (!stored || stored.dateKey !== today) return null;

  const mission = stored.missions.find((m) => m.id === missionId);
  if (!mission || mission.status !== "active") return null;

  mission.progress = Math.min(mission.progress + increment, mission.target);
  if (mission.progress >= mission.target) {
    mission.status = "completed";
  }

  saveStoredMissions(stored);
  return { ...mission };
}

export function advanceMissionsByType(
  type: MissionTemplate["type"],
  increment: number = 1,
): DailyMission[] {
  const today = getDateKey();
  const stored = loadStoredMissions();
  if (!stored || stored.dateKey !== today) return [];

  const updated: DailyMission[] = [];
  for (const mission of stored.missions) {
    if (mission.type === type && mission.status === "active") {
      mission.progress = Math.min(mission.progress + increment, mission.target);
      if (mission.progress >= mission.target) {
        mission.status = "completed";
      }
      updated.push({ ...mission });
    }
  }

  if (updated.length > 0) {
    saveStoredMissions(stored);
  }
  return updated;
}
