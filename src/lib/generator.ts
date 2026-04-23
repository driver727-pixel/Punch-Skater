import type { CardPayload, CardPrompts, Rarity } from './types';
import { buildForgedCard } from './skaterBoardSynthesis';
import { DEFAULT_BOARD_CONFIG } from './boardBuilder';

export { buildCharacterSeed } from './skaterBoardSynthesis';

/** Rarities that unlock conlang/lore overlays on card display. */
export const HIGH_RARITY_TIERS: ReadonlySet<Rarity> = new Set<Rarity>(["Rare", "Legendary"]);

/** Human-readable pack labels keyed by storagePackStyle. */
export const STORAGE_PACK_LABELS: Record<string, string> = {
  "shopping-bag":  "🛍️ Light load — quick courier carry",
  "backpack":      "🎒 Standard kit — everyday courier gear",
  "cardboard-box": "📦 Heavy haul — bulk cargo run",
  "duffel-bag":    "🧳 Long run — overstuffed courier bag",
};

// ── Stat constants ─────────────────────────────────────────────────────────────

/** Minimum value for a single card stat. */
export const MIN_SINGLE_STAT = 1;

/** Maximum value for a single stat on the live card scale. */
export const MAX_SINGLE_STAT = 10;

/** Historic single-stat ceiling used by older saved cards. */
export const LEGACY_MAX_SINGLE_STAT = 200;

export function clampCardStat(value: number): number {
  return Math.max(MIN_SINGLE_STAT, Math.min(MAX_SINGLE_STAT, Math.round(value)));
}

export function normalizeLegacyCardStat(value: number): number {
  if (!Number.isFinite(value)) {
    return MIN_SINGLE_STAT;
  }

  if (value <= MAX_SINGLE_STAT) {
    return clampCardStat(value);
  }

  const scaled = MIN_SINGLE_STAT
    + ((value - MIN_SINGLE_STAT) * (MAX_SINGLE_STAT - MIN_SINGLE_STAT))
      / (LEGACY_MAX_SINGLE_STAT - MIN_SINGLE_STAT);

  return clampCardStat(scaled);
}

export function normalizeCardStats<T extends Record<string, number>>(stats: T): T {
  return Object.fromEntries(
    Object.entries(stats).map(([key, value]) => [key, normalizeLegacyCardStat(value)]),
  ) as T;
}

interface GenerateCardOptions {
  idNonce?: string;
}

/**
 * generateCard is now a thin wrapper around buildForgedCard.
 * Uses DEFAULT_BOARD_CONFIG because generateCard callers (EditCard, quick
 * previews) don't need a customised board — the full forge flow in
 * useForgeGeneration already passes a user-selected boardConfig directly to
 * buildForgedCard via the synthesis layer.
 */
export const generateCard = (prompts: CardPrompts, options: GenerateCardOptions = {}): CardPayload => {
  return buildForgedCard({
    prompts,
    boardConfig: DEFAULT_BOARD_CONFIG,
    idNonce: options.idNonce,
  });
};
