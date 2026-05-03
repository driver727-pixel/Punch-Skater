import type { Rarity } from "./types";

export const CLASS_MULTIPLIERS: Record<Rarity, number> = {
  "Punch Skater": 1.0,
  Apprentice: 1.0,
  Master: 1.25,
  Rare: 1.5,
  Legendary: 2.0,
};

export const CLASS_BADGE_LABELS: Record<Rarity, string> = {
  "Punch Skater": "Punch Skater",
  Apprentice: "Apprentice",
  Master: "Master",
  Rare: "Rare",
  Legendary: "Legendary",
};

export function getClassMultiplier(rarity: Rarity): number {
  return CLASS_MULTIPLIERS[rarity];
}

export function getClassBadgeLabel(rarity: Rarity): string {
  return CLASS_BADGE_LABELS[rarity];
}
