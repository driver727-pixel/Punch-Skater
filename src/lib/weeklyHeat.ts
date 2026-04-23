/**
 * weeklyHeat.ts — Weekly "Heat" card system + weather quest rotation.
 *
 * Each week (Monday 00:00 UTC → Sunday 23:59 UTC) features:
 *  - A unique Legendary "Heat" card that can only be forged during that week
 *  - A rotating district weather quest with cosmetic rewards
 *  - Weekly leaderboard snapshot
 *
 * The Heat card is themed around the featured district and archetype.
 */

import type { Archetype, District, Faction, Rarity } from "./types";

export interface WeeklyHeatCard {
  weekId: string;
  name: string;
  description: string;
  district: District;
  archetype: Archetype;
  faction: Faction;
  rarity: Rarity;
  accentColor: string;
  startsAt: string;
  expiresAt: string;
  frameVariant: string;
}

export interface WeeklyWeatherQuest {
  weekId: string;
  title: string;
  description: string;
  district: District;
  objective: string;
  target: number;
  rewardLabel: string;
  rewardXp: number;
}

const HEAT_ROTATION: Omit<WeeklyHeatCard, "weekId" | "startsAt" | "expiresAt">[] = [
  { name: "Nightshade Phantom", description: "A shadowy Legendary forged from Nightshade's darkest tunnels. Only available this week.", district: "Nightshade", archetype: "D4rk $pider", faction: "D4rk $pider", rarity: "Legendary", accentColor: "#8b00ff", frameVariant: "heat-nightshade" },
  { name: "Grid Runner X", description: "A chrome-plated Legendary born in The Grid's surveillance corridors. 7 days only.", district: "The Grid", archetype: "Ne0n Legion", faction: "Ne0n Legion", rarity: "Legendary", accentColor: "#00ffff", frameVariant: "heat-grid" },
  { name: "Airaway Ace", description: "A sky-forged Legendary from Airaway's upper platforms. This week's exclusive.", district: "Airaway", archetype: "Qu111s", faction: "Qu111s (Quills)", rarity: "Legendary", accentColor: "#ff6600", frameVariant: "heat-airaway" },
  { name: "Battery King", description: "A heavy-duty Legendary charged by Batteryville's industrial core. Limited drop.", district: "Batteryville", archetype: "Iron Curtains", faction: "Iron Curtains", rarity: "Legendary", accentColor: "#ffcc00", frameVariant: "heat-battery" },
  { name: "Glass Sovereign", description: "A crystalline Legendary sculpted in Glass City's tower forges. One week only.", district: "Glass City", archetype: "The Knights Technarchy", faction: "The Knights Technarchy", rarity: "Legendary", accentColor: "#00ff88", frameVariant: "heat-glass" },
  { name: "Forest Wraith", description: "A wild Legendary emerged from The Forest's root bridges. Forge before it vanishes.", district: "The Forest", archetype: "The Asclepians", faction: "The Asclepians", rarity: "Legendary", accentColor: "#33cc33", frameVariant: "heat-forest" },
];

const WEATHER_QUESTS: Omit<WeeklyWeatherQuest, "weekId">[] = [
  { title: "Nightshade Courier Run", description: "Brave the floods and deliver in Nightshade.", district: "Nightshade", objective: "Complete delivery missions in Nightshade", target: 3, rewardLabel: "Nightshade Frame", rewardXp: 200 },
  { title: "Grid Surveillance Run", description: "Navigate The Grid's cameras and checkpoints.", district: "The Grid", objective: "Complete delivery missions in The Grid", target: 3, rewardLabel: "Grid Frame", rewardXp: 200 },
  { title: "Airaway Sky Dash", description: "Race through Airaway's sky-city checkpoints.", district: "Airaway", objective: "Complete delivery missions in Airaway", target: 3, rewardLabel: "Airaway Frame", rewardXp: 200 },
  { title: "Battery Freight Haul", description: "Move cargo through Batteryville's freight yards.", district: "Batteryville", objective: "Complete delivery missions in Batteryville", target: 2, rewardLabel: "Battery Frame", rewardXp: 250 },
  { title: "Glass City Express", description: "Speed-deliver across Glass City's tower network.", district: "Glass City", objective: "Complete delivery missions in Glass City", target: 2, rewardLabel: "Glass Frame", rewardXp: 250 },
  { title: "Forest Root Run", description: "Survive The Forest's root bridges and timber routes.", district: "The Forest", objective: "Complete delivery missions in The Forest", target: 2, rewardLabel: "Forest Frame", rewardXp: 250 },
];

export function getWeekId(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay();
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - ((dayOfWeek + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function getWeekBounds(weekId: string): { startsAt: string; expiresAt: string } {
  const start = new Date(weekId + "T00:00:00Z");
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return {
    startsAt: start.toISOString(),
    expiresAt: end.toISOString(),
  };
}

export function getWeekIndex(weekId: string): number {
  const epoch = new Date("2024-01-01T00:00:00Z");
  const current = new Date(weekId + "T00:00:00Z");
  const diffWeeks = Math.floor((current.getTime() - epoch.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return Math.abs(diffWeeks);
}

export function getCurrentHeatCard(date?: Date): WeeklyHeatCard {
  const weekId = getWeekId(date);
  const idx = getWeekIndex(weekId) % HEAT_ROTATION.length;
  const template = HEAT_ROTATION[idx];
  const bounds = getWeekBounds(weekId);
  return { weekId, ...template, ...bounds };
}

export function getCurrentWeatherQuest(date?: Date): WeeklyWeatherQuest {
  const weekId = getWeekId(date);
  const idx = getWeekIndex(weekId) % WEATHER_QUESTS.length;
  return { weekId, ...WEATHER_QUESTS[idx] };
}

export function isHeatCardActive(heatCard: WeeklyHeatCard, now: Date = new Date()): boolean {
  return now >= new Date(heatCard.startsAt) && now < new Date(heatCard.expiresAt);
}

export function getHeatCardTimeRemaining(heatCard: WeeklyHeatCard, now: Date = new Date()): number {
  const expires = new Date(heatCard.expiresAt).getTime();
  return Math.max(0, expires - now.getTime());
}

export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "Expired";
  const totalHours = Math.floor(ms / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}
