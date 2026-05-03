import type { Rarity } from "./types";

export const RARITY_COLORS: Record<Rarity, string> = {
  "Punch Skater": "#aa9988",
  Apprentice: "#44ddaa",
  Master: "#cc44ff",
  Rare: "#4488ff",
  Legendary: "#ffaa00",
};

const FRAME_DESIGNATOR_RARITIES = new Set<Rarity>(["Apprentice", "Master", "Rare"]);

export function hasBuiltInFrameDesignator(rarity: Rarity): boolean {
  return FRAME_DESIGNATOR_RARITIES.has(rarity);
}

export function shouldRenderInsetNeonTube(rarity: Rarity): boolean {
  return FRAME_DESIGNATOR_RARITIES.has(rarity);
}
