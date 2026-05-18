import type { Rarity } from "./types";

export const PROCEDURAL_FRAME_RARITIES = [
  "Punch Skater",
  "Apprentice",
  "Master",
  "Rare",
  "Legendary",
] as const satisfies readonly Rarity[];

const PROCEDURAL_FRAME_RARITY_SET = new Set<Rarity>(PROCEDURAL_FRAME_RARITIES);

export function hasProceduralFrame(rarity: Rarity): boolean {
  return PROCEDURAL_FRAME_RARITY_SET.has(rarity);
}
