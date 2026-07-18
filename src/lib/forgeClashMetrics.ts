import type { CardPayload, StatKey } from "./types";

const RARITY_STEP_BONUS = 2;
const LEGENDARY_EXTRA_BONUS = 1;

export const RARITY_BONUS: Record<CardPayload["prompts"]["rarity"], number> = {
  "Punch Skater™": RARITY_STEP_BONUS,
  Apprentice: RARITY_STEP_BONUS * 2,
  Master: RARITY_STEP_BONUS * 3,
  Rare: RARITY_STEP_BONUS * 4,
  Legendary: RARITY_STEP_BONUS * 5 + LEGENDARY_EXTRA_BONUS,
};

export function toFiniteNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== "number" && typeof value !== "string") return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  const numericValue = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, numericValue));
}

export function getCardStat(card: Pick<CardPayload, "stats">, stat: StatKey): number {
  return toFiniteNumber(card.stats[stat]);
}

export function getCardRarityBonus(
  card: Pick<CardPayload, "prompts">,
  rarityBonuses: Partial<Record<CardPayload["prompts"]["rarity"], unknown>> = RARITY_BONUS,
): number {
  return toFiniteNumber(rarityBonuses[card.prompts.rarity]);
}
